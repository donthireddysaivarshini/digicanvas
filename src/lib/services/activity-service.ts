import { prisma } from "@/lib/db";
import { AuthenticatedUser } from "@/lib/auth/session";
import { ActivityFilterInput, activityFilterSchema } from "@/lib/validation/activity";
import { getTimezoneRangeBoundaries } from "@/lib/date-utils";
import { Role, Prisma } from "@prisma/client";
import { UnauthorizedError } from "@/lib/errors";

export interface ActivityLogsResult {
  items: {
    id: string;
    action: string;
    entityType: string;
    entityId: string;
    metadata: unknown;
    createdAt: Date;
    actor: {
      id: string;
      name: string;
      email: string;
      role: Role;
    };
    organization: {
      id: string;
      name: string;
      slug: string;
      timezone: string;
    };
  }[];
  total: number;
  page: number;
  totalPages: number;
  limit: number;
}

/**
 * Retrieves paginated, filtered activity logs for authorized Admin users.
 * Clients are strictly blocked from accessing audit logs.
 */
export async function listActivityLogs(
  user: AuthenticatedUser,
  filters: Partial<ActivityFilterInput> = {}
): Promise<ActivityLogsResult> {
  // 1. Strict Role Authorization
  if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
    throw new UnauthorizedError("Only admin users are authorized to access activity history.");
  }

  const parsed = activityFilterSchema.parse(filters);

  // 2. Build where filter
  const whereClause: Prisma.ActivityLogWhereInput = {};

  // Organization filter
  if (user.organizationId) {
    whereClause.organizationId = user.organizationId;
  } else if (parsed.organizationId) {
    whereClause.organizationId = parsed.organizationId;
  }

  // Action filter
  if (parsed.action && parsed.action.trim().length > 0) {
    whereClause.action = parsed.action.trim();
  }

  // Entity Type filter
  if (parsed.entityType && parsed.entityType.trim().length > 0) {
    whereClause.entityType = parsed.entityType.trim();
  }

  // Date Range filter
  if (parsed.startDate || parsed.endDate) {
    // Lookup timezone of filtered organization if available, else default to Asia/Kolkata
    let timezone = "Asia/Kolkata";
    if (whereClause.organizationId && typeof whereClause.organizationId === "string") {
      const org = await prisma.organization.findUnique({
        where: { id: whereClause.organizationId },
        select: { timezone: true },
      });
      if (org?.timezone) timezone = org.timezone;
    }

    const start = parsed.startDate || "2020-01-01";
    const end = parsed.endDate || "2099-12-31";
    const { startUtc, endUtc } = getTimezoneRangeBoundaries(start, end, timezone);

    whereClause.createdAt = {
      gte: startUtc,
      lte: endUtc,
    };
  }

  // 3. Query with deterministic descending order & pagination
  const skip = (parsed.page - 1) * parsed.limit;

  const [items, total] = await Promise.all([
    prisma.activityLog.findMany({
      where: whereClause,
      include: {
        actor: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        organization: {
          select: {
            id: true,
            name: true,
            slug: true,
            timezone: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: parsed.limit,
      skip,
    }),
    prisma.activityLog.count({ where: whereClause }),
  ]);

  const totalPages = Math.ceil(total / parsed.limit) || 1;

  return {
    items: items as ActivityLogsResult["items"],
    total,
    page: parsed.page,
    totalPages,
    limit: parsed.limit,
  };
}
