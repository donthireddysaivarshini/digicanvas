"use server";

import { revalidatePath } from "next/cache";
import { requireAuth } from "@/lib/auth/guards";
import {
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from "@/lib/services/notification-service";
import {
  markNotificationAsReadSchema,
  listNotificationsSchema,
} from "@/lib/validation/notification";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface NotificationActionResponse<T = unknown> {
  success: boolean;
  error?: string;
  data?: T;
}

/**
 * Server action to fetch notifications for the authenticated user.
 */
export async function getNotificationsAction(
  options?: { limit?: number; offset?: number; unreadOnly?: boolean }
): Promise<NotificationActionResponse> {
  try {
    const session = await requireAuth();
    const parsed = listNotificationsSchema.parse(options || {});
    const result = await listNotifications(session.user, parsed);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to list notifications", error);
    return { success: false, error: "Unable to retrieve notifications." };
  }
}

/**
 * Server action to fetch unread notification count.
 */
export async function getUnreadCountAction(): Promise<NotificationActionResponse<{ count: number }>> {
  try {
    const session = await requireAuth();
    const count = await getUnreadNotificationCount(session.user);
    return { success: true, data: { count } };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    return { success: false, error: "Unable to retrieve unread count." };
  }
}

/**
 * Server action to mark a single notification as read.
 */
export async function markNotificationAsReadAction(
  notificationId: string
): Promise<NotificationActionResponse> {
  try {
    const session = await requireAuth();
    const parsed = markNotificationAsReadSchema.parse({ notificationId });
    const updated = await markNotificationAsRead(parsed.notificationId, session.user);

    revalidatePath("/admin");
    revalidatePath("/portal");

    return { success: true, data: updated };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to mark notification as read", error);
    return { success: false, error: "Failed to mark notification as read." };
  }
}

/**
 * Server action to mark all notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsReadAction(): Promise<NotificationActionResponse> {
  try {
    const session = await requireAuth();
    const result = await markAllNotificationsAsRead(session.user);

    revalidatePath("/admin");
    revalidatePath("/portal");

    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to mark all notifications as read", error);
    return { success: false, error: "Failed to mark all notifications as read." };
  }
}
