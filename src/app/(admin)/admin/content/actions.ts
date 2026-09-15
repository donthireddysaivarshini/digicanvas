"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import {
  createContentSchema,
  updateContentSchema,
  rescheduleContentSchema,
} from "@/lib/validation/content";
import {
  createContent,
  updateContent,
  archiveContent,
  rescheduleContent,
} from "@/lib/services/content-service";
import { Platform, ContentType, PublishingStatus, ApprovalStatus } from "@prisma/client";
import { ValidationError, AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface ContentActionState<T = unknown> {
  success?: boolean;
  error?: string;
  fieldErrors?: Record<string, string[]>;
  data?: T;
}

export async function createContentAction(
  prevState: ContentActionState | null,
  formData: FormData
): Promise<ContentActionState> {
  const session = await requireAdmin();

  const platformsRaw = formData.getAll("platforms") as Platform[];
  const rawData = {
    organizationId: formData.get("organizationId") as string,
    title: formData.get("title") as string,
    contentType: formData.get("contentType") as ContentType,
    platforms: platformsRaw,
    scheduledDate: formData.get("scheduledDate") as string,
    scheduledTime: (formData.get("scheduledTime") as string) || "12:00",
    driveUrl: (formData.get("driveUrl") as string) || "",
    caption: (formData.get("caption") as string) || "",
    publishingStatus:
      (formData.get("publishingStatus") as PublishingStatus) || PublishingStatus.SCHEDULED,
    approvalStatus:
      (formData.get("approvalStatus") as ApprovalStatus) || ApprovalStatus.AWAITING_APPROVAL,
  };

  const parsed = createContentSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted form errors.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const created = await createContent(parsed.data, session.user.id);
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");
    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    return { success: true, data: created };
  } catch (error) {
    if (error instanceof ValidationError) {
      return { success: false, error: error.message, fieldErrors: error.errors };
    }
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to create content", error);
    return { success: false, error: "An unexpected error occurred while creating content." };
  }
}

export async function updateContentAction(
  prevState: ContentActionState | null,
  formData: FormData
): Promise<ContentActionState> {
  const session = await requireAdmin();

  const platformsRaw = formData.getAll("platforms") as Platform[];
  const rawData = {
    id: formData.get("id") as string,
    title: formData.get("title") as string,
    contentType: formData.get("contentType") as ContentType,
    platforms: platformsRaw,
    scheduledDate: formData.get("scheduledDate") as string,
    scheduledTime: (formData.get("scheduledTime") as string) || "12:00",
    driveUrl: (formData.get("driveUrl") as string) || "",
    caption: (formData.get("caption") as string) || "",
    publishingStatus:
      (formData.get("publishingStatus") as PublishingStatus) || PublishingStatus.SCHEDULED,
    approvalStatus:
      (formData.get("approvalStatus") as ApprovalStatus) || ApprovalStatus.AWAITING_APPROVAL,
  };

  const parsed = updateContentSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Please correct the highlighted form errors.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    const updated = await updateContent(parsed.data, session.user.id);
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");
    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to update content", error);
    return { success: false, error: "An unexpected error occurred while updating content." };
  }
}

export async function archiveContentAction(formData: FormData): Promise<void> {
  const session = await requireAdmin();
  const contentId = formData.get("contentId") as string;

  if (!contentId) {
    throw new Error("Missing content ID for archiving.");
  }

  await archiveContent(contentId, session.user.id);
  revalidatePath("/admin/content");
  revalidatePath("/admin/calendar");
  revalidatePath("/portal");
  revalidatePath("/portal/calendar");
}

export async function rescheduleContentAction(
  prevState: ContentActionState | null,
  formData: FormData
): Promise<ContentActionState> {
  const session = await requireAdmin();

  const rawData = {
    id: formData.get("id") as string,
    scheduledDate: formData.get("scheduledDate") as string,
    scheduledTime: formData.get("scheduledTime") as string,
  };

  const parsed = rescheduleContentSchema.safeParse(rawData);
  if (!parsed.success) {
    return {
      success: false,
      error: "Invalid date or time provided.",
      fieldErrors: parsed.error.flatten().fieldErrors,
    };
  }

  try {
    await rescheduleContent(parsed.data, session.user.id);
    revalidatePath("/admin/content");
    revalidatePath("/admin/calendar");
    revalidatePath("/portal");
    revalidatePath("/portal/calendar");
    return { success: true };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to reschedule content", error);
    return { success: false, error: "Failed to reschedule content." };
  }
}
