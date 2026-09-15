"use server";

import { requireAdmin } from "@/lib/auth/guards";
import { listActivityLogs, ActivityLogsResult } from "@/lib/services/activity-service";
import { ActivityFilterInput, activityFilterSchema } from "@/lib/validation/activity";
import { AppError } from "@/lib/errors";
import { logger } from "@/lib/logger";

export interface ActivityActionResponse {
  success: boolean;
  error?: string;
  data?: ActivityLogsResult;
}

/**
 * Server action to fetch paginated activity logs for Admin users.
 */
export async function getActivityLogsAction(
  filters: Partial<ActivityFilterInput> = {}
): Promise<ActivityActionResponse> {
  try {
    const session = await requireAdmin();
    const parsed = activityFilterSchema.parse(filters);
    const result = await listActivityLogs(session.user, parsed);
    return { success: true, data: result };
  } catch (error) {
    if (error instanceof AppError) {
      return { success: false, error: error.message };
    }
    logger.error("Failed to list activity logs", error);
    return { success: false, error: "Unable to retrieve activity history." };
  }
}
