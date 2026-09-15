import { z } from "zod";

export const activityFilterSchema = z.object({
  organizationId: z.string().optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  startDate: z.string().optional(), // YYYY-MM-DD
  endDate: z.string().optional(), // YYYY-MM-DD
  page: z.coerce.number().min(1).default(1),
  limit: z.coerce.number().min(1).max(100).default(25),
});

export type ActivityFilterInput = z.infer<typeof activityFilterSchema>;
