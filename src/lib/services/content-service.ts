import { prisma } from "@/lib/db";
import {
  CreateContentInput,
  UpdateContentInput,
  RescheduleContentInput,
  CalendarFilterInput,
} from "@/lib/validation/content";
import { AuthenticatedUser } from "@/lib/auth/session";
import { assertOrganizationAccess, getTenantScopedFilter } from "@/lib/auth/guards";
import {
  combineDateAndTimeInTimezone,
  getTimezoneRangeBoundaries,
  getDateStringInTimezone,
} from "@/lib/date-utils";
import { Role, ContentType, Platform, ApprovalStatus, PublishingStatus } from "@prisma/client";
import { NotFoundError, ValidationError, TenantMismatchError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Creates a new content item with normalized platform associations,
 * initial caption versioning (v1), and activity logging inside a transaction.
 */
export async function createContent(input: CreateContentInput, adminUserId: string) {
  // 1. Verify organization exists and is active
  const organization = await prisma.organization.findUnique({
    where: { id: input.organizationId },
  });

  if (!organization) {
    throw new NotFoundError(`Client organization with ID "${input.organizationId}" not found.`);
  }

  // 2. Compute UTC scheduledAt timestamp using organization's configured timezone
  const scheduledAt = combineDateAndTimeInTimezone(
    input.scheduledDate,
    input.scheduledTime,
    organization.timezone
  );

  // 3. Atomically create Content, ContentPlatform, initial CaptionVersion, and ActivityLog
  const createdContent = await prisma.$transaction(async (tx) => {
    const content = await tx.content.create({
      data: {
        organizationId: input.organizationId,
        title: input.title,
        contentType: input.contentType,
        scheduledAt,
        driveUrl: input.driveUrl || null,
        caption: input.caption || null,
        approvalStatus: input.approvalStatus || ApprovalStatus.AWAITING_APPROVAL,
        publishingStatus: input.publishingStatus || PublishingStatus.SCHEDULED,
        createdById: adminUserId,
        archivedAt: null,
      },
    });

    // Create normalized platform relations
    if (input.platforms.length > 0) {
      await tx.contentPlatform.createMany({
        data: input.platforms.map((p) => ({
          contentId: content.id,
          platform: p,
        })),
      });
    }

    // Create initial CaptionVersion (v1) if caption is provided
    if (input.caption && input.caption.trim().length > 0) {
      await tx.captionVersion.create({
        data: {
          contentId: content.id,
          versionNumber: 1,
          caption: input.caption.trim(),
          editedById: adminUserId,
        },
      });
    }

    // Log creation activity
    await tx.activityLog.create({
      data: {
        organizationId: input.organizationId,
        actorId: adminUserId,
        action: "CONTENT_CREATED",
        entityType: "CONTENT",
        entityId: content.id,
        metadata: {
          title: content.title,
          contentType: content.contentType,
          platforms: input.platforms,
          scheduledAt: content.scheduledAt.toISOString(),
        },
      },
    });

    return content;
  });

  logger.info("Content created successfully", {
    contentId: createdContent.id,
    organizationId: input.organizationId,
    adminUserId,
  });

  return await getContentById(createdContent.id, {
    id: adminUserId,
    email: "",
    name: "",
    role: Role.ADMIN,
    status: "ACTIVE",
    organizationId: null,
  });
}

/**
 * Updates an existing content item.
 * Preserves caption history: only creates a new CaptionVersion if caption text was actually altered.
 */
export async function updateContent(input: UpdateContentInput, adminUserId: string) {
  const existing = await prisma.content.findUnique({
    where: { id: input.id },
    include: {
      organization: true,
      captionVersions: { orderBy: { versionNumber: "desc" }, take: 1 },
    },
  });

  if (!existing || existing.archivedAt !== null) {
    throw new NotFoundError(`Content with ID "${input.id}" not found.`);
  }

  // Compute UTC scheduledAt timestamp
  const scheduledAt = combineDateAndTimeInTimezone(
    input.scheduledDate,
    input.scheduledTime,
    existing.organization.timezone
  );

  const trimmedNewCaption = input.caption?.trim() || "";
  const trimmedOldCaption = existing.caption?.trim() || "";
  const captionChanged = trimmedNewCaption !== trimmedOldCaption;

  await prisma.$transaction(async (tx) => {
    // 1. Update platforms: delete old relations and recreate new ones
    await tx.contentPlatform.deleteMany({ where: { contentId: input.id } });
    if (input.platforms.length > 0) {
      await tx.contentPlatform.createMany({
        data: input.platforms.map((p) => ({
          contentId: input.id,
          platform: p,
        })),
      });
    }

    // 2. Transactional caption versioning: only create next version if text changed
    if (captionChanged && trimmedNewCaption.length > 0) {
      const latestVersion = existing.captionVersions[0]?.versionNumber ?? 0;
      await tx.captionVersion.create({
        data: {
          contentId: input.id,
          versionNumber: latestVersion + 1,
          caption: trimmedNewCaption,
          editedById: adminUserId,
        },
      });
    }

    // 3. Update main Content record
    await tx.content.update({
      where: { id: input.id },
      data: {
        title: input.title,
        contentType: input.contentType,
        scheduledAt,
        driveUrl: input.driveUrl || null,
        caption: input.caption || null,
        approvalStatus: input.approvalStatus,
        publishingStatus: input.publishingStatus,
        updatedById: adminUserId,
      },
    });

    // 4. Log update activity
    await tx.activityLog.create({
      data: {
        organizationId: existing.organizationId,
        actorId: adminUserId,
        action: "CONTENT_UPDATED",
        entityType: "CONTENT",
        entityId: input.id,
        metadata: {
          title: input.title,
          captionChanged,
          scheduledAt: scheduledAt.toISOString(),
        },
      },
    });
  });

  logger.info("Content updated", { contentId: input.id, adminUserId });

  return await getContentById(input.id, {
    id: adminUserId,
    email: "",
    name: "",
    role: Role.ADMIN,
    status: "ACTIVE",
    organizationId: null,
  });
}

/**
 * Non-destructively archives content by setting `archivedAt: new Date()`.
 * Preserves all historical CaptionVersions and ActivityLogs.
 * Idempotent: returns cleanly if already archived.
 */
export async function archiveContent(id: string, adminUserId: string) {
  const existing = await prisma.content.findUnique({
    where: { id },
  });

  if (!existing) {
    throw new NotFoundError(`Content with ID "${id}" not found.`);
  }

  if (existing.archivedAt !== null) {
    return existing; // Already archived
  }

  const archived = await prisma.$transaction(async (tx) => {
    const updated = await tx.content.update({
      where: { id },
      data: {
        archivedAt: new Date(),
        updatedById: adminUserId,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: existing.organizationId,
        actorId: adminUserId,
        action: "CONTENT_ARCHIVED",
        entityType: "CONTENT",
        entityId: id,
        metadata: { title: existing.title },
      },
    });

    return updated;
  });

  logger.info("Content archived", { contentId: id, adminUserId });
  return archived;
}

/**
 * Reschedules content date and time.
 */
export async function rescheduleContent(
  input: RescheduleContentInput,
  adminUserId: string
) {
  const existing = await prisma.content.findUnique({
    where: { id: input.id },
    include: { organization: true },
  });

  if (!existing || existing.archivedAt !== null) {
    throw new NotFoundError(`Content with ID "${input.id}" not found.`);
  }

  const newScheduledAt = combineDateAndTimeInTimezone(
    input.scheduledDate,
    input.scheduledTime,
    existing.organization.timezone
  );

  const updated = await prisma.$transaction(async (tx) => {
    const res = await tx.content.update({
      where: { id: input.id },
      data: {
        scheduledAt: newScheduledAt,
        updatedById: adminUserId,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: existing.organizationId,
        actorId: adminUserId,
        action: "CONTENT_RESCHEDULED",
        entityType: "CONTENT",
        entityId: input.id,
        metadata: {
          previousScheduledAt: existing.scheduledAt.toISOString(),
          newScheduledAt: newScheduledAt.toISOString(),
        },
      },
    });

    return res;
  });

  logger.info("Content rescheduled", { contentId: input.id, newScheduledAt, adminUserId });
  return updated;
}

/**
 * Retrieves a single active content item with relations.
 * Enforces server-side tenant authorization for CLIENT users.
 */
export async function getContentById(id: string, user: AuthenticatedUser) {
  const content = await prisma.content.findUnique({
    where: { id },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
          status: true,
        },
      },
      platforms: {
        select: {
          platform: true,
        },
      },
      createdBy: {
        select: {
          id: true,
          name: true,
          email: true,
        },
      },
      captionVersions: {
        orderBy: { versionNumber: "desc" },
        select: {
          id: true,
          versionNumber: true,
          caption: true,
          createdAt: true,
          editedBy: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
      approvals: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          action: true,
          notes: true,
          createdAt: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              role: true,
            },
          },
        },
      },
    },
  });

  if (!content || content.archivedAt !== null) {
    throw new NotFoundError(`Content with ID "${id}" not found.`);
  }

  // Strict tenant authorization
  assertOrganizationAccess(content.organizationId, user);

  return content;
}

/**
 * Fetches content for calendar views (Month, Week, Day, and Custom Date Ranges).
 * Handles timezone conversion of calendar boundaries to UTC before querying.
 */
export async function getCalendarContent(
  filters: CalendarFilterInput,
  user: AuthenticatedUser
) {
  // Determine effective organization ID
  let effectiveOrgId: string | undefined = undefined;
  if (user.role === Role.CLIENT) {
    if (!user.organizationId) {
      throw new TenantMismatchError("Client user lacks organization association.");
    }
    effectiveOrgId = user.organizationId;
  } else {
    // Admin query: may specify organizationId or view all
    effectiveOrgId = filters.organizationId || undefined;
  }

  // Lookup timezone for boundary calculation
  let timezone = "Asia/Kolkata";
  if (effectiveOrgId) {
    const org = await prisma.organization.findUnique({
      where: { id: effectiveOrgId },
      select: { timezone: true },
    });
    if (org?.timezone) timezone = org.timezone;
  }

  // Calculate UTC boundary timestamps from local date boundaries
  const { startUtc, endUtc } = getTimezoneRangeBoundaries(
    filters.startDate,
    filters.endDate,
    timezone
  );

  const contents = await prisma.content.findMany({
    where: {
      archivedAt: null,
      scheduledAt: {
        gte: startUtc,
        lte: endUtc,
      },
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      ...(filters.contentType ? { contentType: filters.contentType } : {}),
      ...(filters.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
      ...(filters.publishingStatus ? { publishingStatus: filters.publishingStatus } : {}),
      ...(filters.platform ? { platforms: { some: { platform: filters.platform } } } : {}),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
        },
      },
      platforms: {
        select: {
          platform: true,
        },
      },
      createdBy: {
        select: {
          name: true,
        },
      },
    },
    orderBy: {
      scheduledAt: "asc",
    },
  });

  return contents;
}

/**
 * Lists active content items for Admin and Client content tables.
 */
export async function listContent(
  filters: Partial<CalendarFilterInput>,
  user: AuthenticatedUser
) {
  let effectiveOrgId: string | undefined = undefined;
  if (user.role === Role.CLIENT) {
    if (!user.organizationId) {
      throw new TenantMismatchError("Client user lacks organization association.");
    }
    effectiveOrgId = user.organizationId;
  } else {
    effectiveOrgId = filters.organizationId || undefined;
  }

  return await prisma.content.findMany({
    where: {
      archivedAt: null,
      ...(effectiveOrgId ? { organizationId: effectiveOrgId } : {}),
      ...(filters.contentType ? { contentType: filters.contentType } : {}),
      ...(filters.approvalStatus ? { approvalStatus: filters.approvalStatus } : {}),
      ...(filters.publishingStatus ? { publishingStatus: filters.publishingStatus } : {}),
      ...(filters.platform ? { platforms: { some: { platform: filters.platform } } } : {}),
    },
    include: {
      organization: {
        select: {
          id: true,
          name: true,
          slug: true,
          timezone: true,
        },
      },
      platforms: {
        select: {
          platform: true,
        },
      },
      createdBy: {
        select: {
          name: true,
          email: true,
        },
      },
    },
    orderBy: {
      scheduledAt: "desc",
    },
  });
}

/**
 * Fetches today's content and upcoming content for the Client Portal dashboard.
 */
export async function getTodayAndUpcomingContent(user: AuthenticatedUser, limit: number = 5) {
  if (user.role !== Role.CLIENT || !user.organizationId) {
    throw new TenantMismatchError("Only client users can access the client portal summary.");
  }

  const organization = await prisma.organization.findUniqueOrThrow({
    where: { id: user.organizationId },
    select: { timezone: true },
  });

  const now = new Date();
  const todayStr = getDateStringInTimezone(now, organization.timezone);
  const { startUtc: todayStartUtc, endUtc: todayEndUtc } = getTimezoneRangeBoundaries(
    todayStr,
    todayStr,
    organization.timezone
  );

  // 1. Today's content
  const todayContent = await prisma.content.findMany({
    where: {
      organizationId: user.organizationId,
      archivedAt: null,
      scheduledAt: {
        gte: todayStartUtc,
        lte: todayEndUtc,
      },
    },
    include: {
      platforms: { select: { platform: true } },
      organization: { select: { id: true, timezone: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  // 2. Upcoming content (scheduled after today)
  const upcomingContent = await prisma.content.findMany({
    where: {
      organizationId: user.organizationId,
      archivedAt: null,
      scheduledAt: {
        gt: todayEndUtc,
      },
    },
    take: limit,
    include: {
      platforms: { select: { platform: true } },
      organization: { select: { id: true, timezone: true, name: true } },
    },
    orderBy: { scheduledAt: "asc" },
  });

  return {
    todayStr,
    todayContent,
    upcomingContent,
  };
}
