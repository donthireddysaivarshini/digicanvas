"use server";

import { revalidatePath } from "next/cache";
import { requireAuth, requireClient, requireAdmin } from "@/lib/auth/guards";
import {
  approveContent,
  requestChanges,
  updateCaptionByClient,
  submitForApproval,
} from "@/lib/services/approval-service";
import { getContentById } from "@/lib/services/content-service";
import {
  approveContentSchema,
  requestChangesSchema,
  clientCaptionEditSchema,
  submitForApprovalSchema,
} from "@/lib/validation/approval";
import { AppError, ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface ApprovalActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

/**
 * Server action for clients to approve content.
 */
export async function approveContentAction(
  contentId: string
): Promise<ApprovalActionResponse> {
  try {
    const session = await requireClient();

    const parsed = approveContentSchema.safeParse({ contentId });
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid content ID.",
      };
    }

    const updated = await approveContent(parsed.data, session.user);

    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to approve content", error);
    return { success: false, error: "An unexpected error occurred while approving content." };
  }
}

/**
 * Server action for clients to request changes on content.
 */
export async function requestChangesAction(
  contentId: string,
  notes: string
): Promise<ApprovalActionResponse> {
  try {
    const session = await requireClient();

    const parsed = requestChangesSchema.safeParse({ contentId, notes });
    if (!parsed.success) {
      const flat = parsed.error.flatten();
      return {
        success: false,
        error: flat.formErrors[0] || flat.fieldErrors.notes?.[0] || "Please provide valid change request notes.",
        fieldErrors: flat.fieldErrors,
      };
    }

    const updated = await requestChanges(parsed.data, session.user);

    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to submit change request", error);
    return { success: false, error: "An unexpected error occurred while requesting changes." };
  }
}

/**
 * Server action for clients to edit only the caption of content.
 */
export async function updateClientCaptionAction(
  contentId: string,
  caption: string
): Promise<ApprovalActionResponse> {
  try {
    const session = await requireClient();

    const parsed = clientCaptionEditSchema.safeParse({ contentId, caption });
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid caption data.",
      };
    }

    const updated = await updateCaptionByClient(parsed.data, session.user);

    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to update caption", error);
    return { success: false, error: "An unexpected error occurred while updating the caption." };
  }
}

/**
 * Server action for admins to submit or resubmit content for client approval.
 */
export async function submitForApprovalAction(
  contentId: string
): Promise<ApprovalActionResponse> {
  try {
    const session = await requireAdmin();

    const parsed = submitForApprovalSchema.safeParse({ contentId });
    if (!parsed.success) {
      return {
        success: false,
        error: "Invalid content ID.",
      };
    }

    const updated = await submitForApproval(parsed.data, session.user);

    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to submit content for approval", error);
    return { success: false, error: "An unexpected error occurred while submitting for approval." };
  }
}

/**
 * Server action to fetch full content details (including latest live caption versions and approval history).
 */
export async function getContentDetailsAction(
  contentId: string
): Promise<ApprovalActionResponse> {
  try {
    const session = await requireAuth();
    const content = await getContentById(contentId, session.user);
    return { success: true, data: content };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to fetch content details", error);
    return { success: false, error: "Unable to load content details." };
  }
}
