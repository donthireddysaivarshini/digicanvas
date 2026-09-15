"use server";

import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/db";
import { verifyPassword } from "@/lib/auth/password";
import { createSession, destroyCurrentSession } from "@/lib/auth/session";
import { loginSchema } from "@/lib/validation/auth";
import { Role, UserStatus, OrganizationStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

export interface FormState {
  error?: string;
  success?: boolean;
}

export async function loginAction(
  prevState: FormState | null,
  formData: FormData
): Promise<FormState> {
  const rawEmail = formData.get("email") as string;
  const rawPassword = formData.get("password") as string;

  const parsed = loginSchema.safeParse({ email: rawEmail, password: rawPassword });
  if (!parsed.success) {
    return {
      error: parsed.error.errors[0]?.message || "Invalid credentials provided.",
    };
  }

  const { email, password } = parsed.data;

  try {
    const user = await prisma.user.findUnique({
      where: { email },
      include: {
        organization: true,
      },
    });

    if (!user) {
      // Intentionally generic error to prevent user enumeration
      return { error: "Invalid email or password." };
    }

    // 1. Enforce user active status server-side
    if (user.status !== UserStatus.ACTIVE) {
      logger.warn("Login attempt blocked for inactive user", { userId: user.id });
      return { error: "This account has been deactivated. Please contact your agency administrator." };
    }

    // 2. Enforce organization active status for client users server-side
    if (user.role === Role.CLIENT) {
      if (!user.organization || user.organization.status !== OrganizationStatus.ACTIVE) {
        logger.warn("Login attempt blocked for user belonging to inactive organization", {
          userId: user.id,
          organizationId: user.organizationId,
        });
        return { error: "Your client organization account is currently inactive." };
      }
    }

    // 3. Verify password hash
    const isPasswordValid = await verifyPassword(password, user.passwordHash);
    if (!isPasswordValid) {
      logger.warn("Failed login attempt with incorrect password", { userId: user.id });
      return { error: "Invalid email or password." };
    }

    // 4. Create database-backed session
    const headersList = headers();
    const userAgent = headersList.get("user-agent") || undefined;
    const ipAddress = headersList.get("x-forwarded-for") || undefined;

    await createSession(user.id, userAgent, ipAddress);

    // Redirect to appropriate shell based on role
    const redirectPath = user.role === Role.CLIENT ? "/portal" : "/admin";
    redirect(redirectPath);
  } catch (err: unknown) {
    if (err && typeof err === "object" && "digest" in err) {
      // Next.js redirect thrown error, rethrow
      throw err;
    }
    logger.error("Unexpected error during login", err);
    return { error: "An unexpected error occurred during login. Please try again." };
  }
}

export async function logoutAction(): Promise<void> {
  await destroyCurrentSession();
  redirect("/login");
}
