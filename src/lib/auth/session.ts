import { cookies } from "next/headers";
import * as React from "react";
import crypto from "crypto";
import { prisma } from "@/lib/db";
import { Role, UserStatus, OrganizationStatus } from "@prisma/client";
import { logger } from "@/lib/logger";

export const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "digicanvas_session";
const SESSION_MAX_AGE_SECONDS = Number(process.env.SESSION_MAX_AGE_SECONDS) || 60 * 60 * 24 * 7; // 7 days

export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  status: UserStatus;
  organizationId: string | null;
  organization?: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
    status: OrganizationStatus;
  } | null;
}

export interface AuthenticatedSession {
  sessionId: string;
  sessionToken: string;
  expiresAt: Date;
  user: AuthenticatedUser;
}

/**
 * Generates a high-entropy cryptographically secure random token (256-bit).
 */
export function generateSessionToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

/**
 * Creates a new database-backed session for a user and sets the HTTP-only cookie.
 */
export async function createSession(
  userId: string,
  userAgent?: string,
  ipAddress?: string
): Promise<AuthenticatedSession> {
  const sessionToken = generateSessionToken();
  const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

  const session = await prisma.session.create({
    data: {
      sessionToken,
      userId,
      expiresAt,
      userAgent: userAgent?.slice(0, 500),
      ipAddress: ipAddress?.slice(0, 100),
    },
    include: {
      user: {
        include: {
          organization: true,
        },
      },
    },
  });

  // Update user's lastLoginAt timestamp
  await prisma.user.update({
    where: { id: userId },
    data: { lastLoginAt: new Date() },
  });

  // Set HTTP-only cookie
  const cookieStore = cookies();
  cookieStore.set(SESSION_COOKIE_NAME, sessionToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
    maxAge: SESSION_MAX_AGE_SECONDS,
  });

  logger.info("Session created successfully", {
    userId: session.user.id,
    userRole: session.user.role,
    organizationId: session.user.organizationId,
  });

  return {
    sessionId: session.id,
    sessionToken: session.sessionToken,
    expiresAt: session.expiresAt,
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      role: session.user.role,
      status: session.user.status,
      organizationId: session.user.organizationId,
      organization: session.user.organization
        ? {
            id: session.user.organization.id,
            name: session.user.organization.name,
            slug: session.user.organization.slug,
            timezone: session.user.organization.timezone,
            status: session.user.organization.status,
          }
        : null,
    },
  };
}

/**
 * Validates a session token string against the database.
 * Enforces:
 * 1. Token exists
 * 2. Session is not expired (auto-deletes expired sessions)
 * 3. User is ACTIVE (rejects inactive users)
 * 4. User's organization is ACTIVE (if CLIENT role)
 */
export async function validateSessionToken(
  sessionToken: string
): Promise<AuthenticatedSession | null> {
  if (!sessionToken || typeof sessionToken !== "string") {
    return null;
  }

  try {
    const session = await prisma.session.findUnique({
      where: { sessionToken },
      include: {
        user: {
          include: {
            organization: true,
          },
        },
      },
    });

    if (!session) {
      return null;
    }

    // 1. Expiration check
    if (Date.now() >= session.expiresAt.getTime()) {
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // 2. User status check (Server-side enforcement of INACTIVE user)
    if (session.user.status !== UserStatus.ACTIVE) {
      logger.warn("Inactive user attempted to access session", { userId: session.user.id });
      // Invalidate session for inactive user
      await prisma.session.delete({ where: { id: session.id } }).catch(() => {});
      return null;
    }

    // 3. Client Organization status check (Server-side enforcement of INACTIVE tenant)
    if (session.user.role === Role.CLIENT) {
      if (!session.user.organization || session.user.organization.status !== OrganizationStatus.ACTIVE) {
        logger.warn("User belonging to inactive organization attempted to access session", {
          userId: session.user.id,
          organizationId: session.user.organizationId,
        });
        return null;
      }
    }

    return {
      sessionId: session.id,
      sessionToken: session.sessionToken,
      expiresAt: session.expiresAt,
      user: {
        id: session.user.id,
        email: session.user.email,
        name: session.user.name,
        role: session.user.role,
        status: session.user.status,
        organizationId: session.user.organizationId,
        organization: session.user.organization
          ? {
              id: session.user.organization.id,
              name: session.user.organization.name,
              slug: session.user.organization.slug,
              timezone: session.user.organization.timezone,
              status: session.user.organization.status,
            }
          : null,
      },
    };
  } catch (error) {
    logger.error("Session validation error", error);
    return null;
  }
}
const cacheWrapper = typeof (React as unknown as { cache?: <T extends (...args: unknown[]) => unknown>(fn: T) => T }).cache === "function"
  ? (React as unknown as { cache: <T extends (...args: unknown[]) => unknown>(fn: T) => T }).cache
  : <T extends (...args: unknown[]) => unknown>(fn: T): T => fn;

/**
 * Retrieves and validates the current active session from the HTTP-only cookie.
 * Request-memoized using React cache() to prevent redundant DB roundtrips across layout/page/guards.
 */
export const getCurrentSession = cacheWrapper(async (): Promise<AuthenticatedSession | null> => {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (!sessionToken) {
    return null;
  }

  return validateSessionToken(sessionToken);
});

/**
 * Logs out the current user by deleting their session from the database and clearing the cookie.
 */
export async function destroyCurrentSession(): Promise<void> {
  const cookieStore = cookies();
  const sessionToken = cookieStore.get(SESSION_COOKIE_NAME)?.value;

  if (sessionToken) {
    await prisma.session.deleteMany({
      where: { sessionToken },
    }).catch(() => {});
  }

  cookieStore.delete(SESSION_COOKIE_NAME);
}

/**
 * Revokes all active sessions for a given user (e.g. on password change or admin deactivation).
 */
export async function revokeAllUserSessions(userId: string): Promise<void> {
  await prisma.session.deleteMany({
    where: { userId },
  });
  logger.info("All user sessions revoked", { userId });
}
