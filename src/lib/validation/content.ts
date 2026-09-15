import { z } from "zod";
import { ContentType, Platform, ApprovalStatus, PublishingStatus } from "@prisma/client";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
const timeRegex = /^\d{2}:\d{2}$/;

export const createContentSchema = z.object({
  organizationId: z.string().min(1, "Please select a client organization"),
  title: z
    .string({ required_error: "Title / Topic is required" })
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(250, "Title cannot exceed 250 characters"),
  contentType: z.nativeEnum(ContentType, {
    errorMap: () => ({ message: "Please select a valid content type" }),
  }),
  platforms: z
    .array(z.nativeEnum(Platform))
    .min(1, "Please select at least one social media platform"),
  scheduledDate: z
    .string({ required_error: "Scheduled date is required" })
    .regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  scheduledTime: z
    .string()
    .regex(timeRegex, "Time must be in HH:mm format")
    .default("12:00"),
  driveUrl: z
    .string()
    .trim()
    .url("Please enter a valid URL (e.g. https://drive.google.com/...)")
    .optional()
    .or(z.literal("")),
  caption: z
    .string()
    .max(5000, "Caption cannot exceed 5000 characters")
    .optional()
    .or(z.literal("")),
  publishingStatus: z
    .nativeEnum(PublishingStatus)
    .default(PublishingStatus.SCHEDULED),
  approvalStatus: z
    .nativeEnum(ApprovalStatus)
    .default(ApprovalStatus.AWAITING_APPROVAL),
});

export type CreateContentInput = z.infer<typeof createContentSchema>;

export const updateContentSchema = z.object({
  id: z.string().min(1, "Content ID is required"),
  title: z
    .string({ required_error: "Title / Topic is required" })
    .trim()
    .min(2, "Title must be at least 2 characters")
    .max(250),
  contentType: z.nativeEnum(ContentType),
  platforms: z
    .array(z.nativeEnum(Platform))
    .min(1, "Please select at least one social media platform"),
  scheduledDate: z
    .string({ required_error: "Scheduled date is required" })
    .regex(dateRegex),
  scheduledTime: z
    .string()
    .regex(timeRegex)
    .default("12:00"),
  driveUrl: z
    .string()
    .trim()
    .url("Please enter a valid URL")
    .optional()
    .or(z.literal("")),
  caption: z
    .string()
    .max(5000)
    .optional()
    .or(z.literal("")),
  publishingStatus: z.nativeEnum(PublishingStatus).default(PublishingStatus.SCHEDULED),
  approvalStatus: z.nativeEnum(ApprovalStatus).default(ApprovalStatus.AWAITING_APPROVAL),
});

export type UpdateContentInput = z.infer<typeof updateContentSchema>;

export const rescheduleContentSchema = z.object({
  id: z.string().min(1, "Content ID is required"),
  scheduledDate: z.string().regex(dateRegex, "Date must be in YYYY-MM-DD format"),
  scheduledTime: z.string().regex(timeRegex, "Time must be in HH:mm format"),
});

export type RescheduleContentInput = z.infer<typeof rescheduleContentSchema>;

export const calendarFilterSchema = z.object({
  startDate: z.string(),
  endDate: z.string(),
  organizationId: z.string().optional().nullable(),
  platform: z.nativeEnum(Platform).optional().nullable(),
  contentType: z.nativeEnum(ContentType).optional().nullable(),
  approvalStatus: z.nativeEnum(ApprovalStatus).optional().nullable(),
  publishingStatus: z.nativeEnum(PublishingStatus).optional().nullable(),
});

export type CalendarFilterInput = z.infer<typeof calendarFilterSchema>;
