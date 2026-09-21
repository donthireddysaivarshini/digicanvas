"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { createClientSchema, updateClientSchema } from "@/lib/validation/client";
import {
  createClient,
  updateClient,
  toggleClientStatus,
  resetClientPassword,
  CreateClientResult,
  ResetPasswordResult,
} from "@/lib/services/client-service";
import { OrganizationStatus } from "@prisma/client";
import { ValidationError, AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface ActionState<T = unknown> {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

export async function createClientAction(
  prevState: ActionState<CreateClientResult> | null,
  formData: FormData
): Promise<ActionState<CreateClientResult>> {
  const session = await requireAdmin();

  const rawData = {
    name: formData.get("name") as string,
    slug: (formData.get("slug") as string)?.toLowerCase().trim(),
    contactEmail: formData.get("contactEmail") as string,
    contactPhone: formData.get("contactPhone") as string,
    timezone: formData.get("timezone") as string || "Asia/Kolkata",
    userName: formData.get("userName") as string,
    userEmail: (formData.get("userEmail") as string)?.toLowerCase().trim(),
  };

  const parsed = createClientSchema.safeParse(rawData);
  if (!parsed.success) {
    const fieldErrors = parsed.error.flatten().fieldErrors;
    return {
      success: false,
      error: "Please correct the highlighted errors.",
      fieldErrors,
    };
  }

  try {
    const result = await createClient(parsed.data, session.user.id);
    revalidatePath("/admin/clients");
    return {
      success: true,
      data: result,
    };
  } catch (error) {
    if (error instanceof ValidationError) {
      return {
        success: false,
        error: error.message,
        fieldErrors: error.errors,
      };
    }
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to create client", error);
    return { success: false, error: "An unexpected error occurred while creating client." };
  }
}

export async function updateClientAction(
  prevState: ActionState | null,
  formData: FormData
): Promise<ActionState> {
  const session = await requireAdmin();

  const rawData = {
    id: formData.get("id") as string,
    name: formData.get("name") as string,
    contactEmail: formData.get("contactEmail") as string,
    contactPhone: formData.get("contactPhone") as string,
    timezone: formData.get("timezone") as string || "Asia/Kolkata",
    status: (formData.get("status") as OrganizationStatus) || "ACTIVE",
  };

  const parsed = updateClientSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Validation failed.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await updateClient(parsed.data, session.user.id);
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${parsed.data.id}/edit`);
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to update client", error);
    return { success: false, error: "Failed to update client organization." };
  }
}

export async function toggleClientStatusAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const organizationId = formData.get("organizationId") as string;
  const targetStatus = formData.get("status") as OrganizationStatus;

  if (!organizationId || !targetStatus) {
    throw new Error("Missing parameters for status toggle.");
  }

  await toggleClientStatus(organizationId, targetStatus, session.user.id);
  revalidatePath("/admin/clients");
}

export async function resetClientPasswordAction(organizationId: string): Promise<ActionState<ResetPasswordResult>> {
  const session = await requireAdmin();

  if (!organizationId) {
    return { success: false, error: "Missing organization ID." };
  }

  try {
    const result = await resetClientPassword(organizationId, session.user.id);
    revalidatePath("/admin/clients");
    revalidatePath(`/admin/clients/${organizationId}/edit`);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to reset client password", error);
    return { success: false, error: "Failed to generate new client password." };
  }
}

