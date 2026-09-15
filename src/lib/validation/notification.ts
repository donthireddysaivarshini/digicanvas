import { z } from "zod";
import { NotificationType } from "@prisma/client";

export const markNotificationAsReadSchema = z.object({
  notificationId: z.string().min(1, "Notification ID is required"),
});

export const listNotificationsSchema = z.object({
  limit: z.coerce.number().min(1).max(100).default(20),
  offset: z.coerce.number().min(0).default(0),
  unreadOnly: z
    .union([z.boolean(), z.string().transform((v) => v === "true")])
    .optional(),
});

export const createNotificationSchema = z.object({
  organizationId: z.string().min(1, "Organization ID is required"),
  userId: z.string().nullable().optional(),
  title: z.string().min(1, "Notification title is required").max(150),
  message: z.string().min(1, "Notification message is required").max(1000),
  type: z.nativeEnum(NotificationType).default(NotificationType.INFO),
  contentId: z.string().nullable().optional(),
});

export type MarkNotificationAsReadInput = z.infer<typeof markNotificationAsReadSchema>;
export type ListNotificationsInput = z.infer<typeof listNotificationsSchema>;
export type CreateNotificationInput = z.infer<typeof createNotificationSchema>;
