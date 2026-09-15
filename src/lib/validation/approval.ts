import { z } from "zod";

export const approveContentSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
});

export const requestChangesSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  notes: z
    .string()
    .trim()
    .min(1, "Please provide notes/reason explaining what changes are requested.")
    .max(2000, "Notes cannot exceed 2000 characters."),
});

export const clientCaptionEditSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
  caption: z.string(),
});

export const submitForApprovalSchema = z.object({
  contentId: z.string().min(1, "Content ID is required"),
});

export type ApproveContentInput = z.infer<typeof approveContentSchema>;
export type RequestChangesInput = z.infer<typeof requestChangesSchema>;
export type ClientCaptionEditInput = z.infer<typeof clientCaptionEditSchema>;
export type SubmitForApprovalInput = z.infer<typeof submitForApprovalSchema>;
