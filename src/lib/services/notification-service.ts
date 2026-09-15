import { prisma } from "@/lib/db";
import { AuthenticatedUser } from "@/lib/auth/session";
import {
  CreateNotificationInput,
  ListNotificationsInput,
  createNotificationSchema,
  listNotificationsSchema,
} from "@/lib/validation/notification";
import { Role, Prisma } from "@prisma/client";
import {
  NotFoundError,
  TenantMismatchError,
  UnauthorizedError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";

type PrismaClientOrTx = Prisma.TransactionClient | typeof prisma;

/**
 * Creates a new notification record.
 * Supports running within an existing Prisma transaction.
 */
export async function createNotification(
  input: CreateNotificationInput,
  tx?: PrismaClientOrTx
) {
  const parsed = createNotificationSchema.parse(input);
  const db = tx || prisma;

  const notification = await db.notification.create({
    data: {
      organizationId: parsed.organizationId,
      userId: parsed.userId || null,
      title: parsed.title,
      message: parsed.message,
      type: parsed.type,
      contentId: parsed.contentId || null,
      isRead: false,
    },
  });

  logger.info("Notification created", {
    notificationId: notification.id,
    organizationId: parsed.organizationId,
    type: parsed.type,
    userId: parsed.userId,
  });

  return notification;
}

/**
 * Retrieves notifications for the authenticated user with server-side tenant scoping.
 * Client users ONLY see notifications for their organization (org-wide or user-targeted).
 */
export async function listNotifications(
  user: AuthenticatedUser,
  input: Partial<ListNotificationsInput> = {}
) {
  const parsed = listNotificationsSchema.parse(input);

  const whereClause: Prisma.NotificationWhereInput = {};

  if (user.role === Role.CLIENT) {
    if (!user.organizationId) {
      throw new TenantMismatchError("Client user lacks organization association.");
    }

    whereClause.organizationId = user.organizationId;
    whereClause.OR = [
      { userId: user.id },
      { userId: null },
    ];
  } else {
    // Admin user: if tenant-scoped admin, filter by org
    if (user.organizationId) {
      whereClause.organizationId = user.organizationId;
    }
  }

  // Filter unread if requested
  const unreadWhereClause: Prisma.NotificationWhereInput = {
    ...whereClause,
    isRead: false,
  };

  if (parsed.unreadOnly) {
    whereClause.isRead = false;
  }

  const [notifications, totalCount, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: whereClause,
      include: {
        organization: {
          select: {
            id: true,
            name: true,
            timezone: true,
          },
        },
        content: {
          select: {
            id: true,
            title: true,
            approvalStatus: true,
            publishingStatus: true,
            archivedAt: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: parsed.limit,
      skip: parsed.offset,
    }),
    prisma.notification.count({ where: whereClause }),
    prisma.notification.count({ where: unreadWhereClause }),
  ]);

  return {
    notifications,
    totalCount,
    unreadCount,
  };
}

/**
 * Retrieves the count of unread notifications for the authenticated user.
 */
export async function getUnreadNotificationCount(user: AuthenticatedUser): Promise<number> {
  const whereClause: Prisma.NotificationWhereInput = {
    isRead: false,
  };

  if (user.role === Role.CLIENT) {
    if (!user.organizationId) return 0;
    whereClause.organizationId = user.organizationId;
    whereClause.OR = [
      { userId: user.id },
      { userId: null },
    ];
  } else if (user.organizationId) {
    whereClause.organizationId = user.organizationId;
  }

  return await prisma.notification.count({
    where: whereClause,
  });
}

/**
 * Marks a single notification as read after strict tenant & recipient verification.
 */
export async function markNotificationAsRead(
  notificationId: string,
  user: AuthenticatedUser
) {
  const notification = await prisma.notification.findUnique({
    where: { id: notificationId },
  });

  if (!notification) {
    throw new NotFoundError(`Notification with ID "${notificationId}" not found.`);
  }

  // Authorization check
  if (user.role === Role.CLIENT) {
    if (notification.organizationId !== user.organizationId) {
      throw new TenantMismatchError("You do not have permission to access this notification.");
    }
    // If notification is explicitly targeted to another specific user, reject
    if (notification.userId !== null && notification.userId !== user.id) {
      throw new UnauthorizedError("You cannot mark another user's private notification as read.");
    }
  }

  return await prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}

/**
 * Marks all authorized notifications as read for the authenticated user.
 */
export async function markAllNotificationsAsRead(user: AuthenticatedUser) {
  const whereClause: Prisma.NotificationWhereInput = {
    isRead: false,
  };

  if (user.role === Role.CLIENT) {
    if (!user.organizationId) {
      throw new TenantMismatchError("Client user lacks organization association.");
    }
    whereClause.organizationId = user.organizationId;
    whereClause.OR = [
      { userId: user.id },
      { userId: null },
    ];
  } else if (user.organizationId) {
    whereClause.organizationId = user.organizationId;
  }

  const result = await prisma.notification.updateMany({
    where: whereClause,
    data: { isRead: true },
  });

  logger.info("Marked all notifications as read", {
    userId: user.id,
    count: result.count,
  });

  return result;
}
