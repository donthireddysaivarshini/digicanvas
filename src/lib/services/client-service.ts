import crypto from "crypto";
import { prisma } from "@/lib/db";
import { hashPassword } from "@/lib/auth/password";
import { CreateClientInput, UpdateClientInput } from "@/lib/validation/client";
import { Role, UserStatus, OrganizationStatus } from "@prisma/client";
import { ValidationError, NotFoundError } from "@/lib/errors";
import { logger } from "@/lib/logger";

/**
 * Generates a high-entropy, human-friendly temporary password.
 * Format: 3 random words/characters with symbols and numbers (e.g., "Kura#78xP!92M")
 */
export function generateTemporaryPassword(): string {
  const chars = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789!@#$%&*";
  const bytes = crypto.randomBytes(14);
  let result = "";
  for (let i = 0; i < bytes.length; i++) {
    result += chars[bytes[i] % chars.length];
  }
  return result;
}

/**
 * Lists all client organizations for the Admin portal.
 */
export async function listClients() {
  return await prisma.organization.findMany({
    orderBy: { createdAt: "desc" },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          lastLoginAt: true,
        },
      },
      _count: {
        select: {
          contents: true,
          users: true,
        },
      },
    },
  });
}

/**
 * Retrieves a single client organization by ID.
 */
export async function getClientById(id: string) {
  const org = await prisma.organization.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          status: true,
          lastLoginAt: true,
          createdAt: true,
        },
      },
      _count: {
        select: {
          contents: true,
        },
      },
    },
  });

  if (!org) {
    throw new NotFoundError(`Client organization with ID "${id}" not found.`);
  }

  return org;
}

export interface CreateClientResult {
  organization: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string | null;
    contactPhone: string | null;
    timezone: string;
    status: OrganizationStatus;
  };
  user: {
    id: string;
    email: string;
    name: string;
  };
  temporaryPassword: string;
}

/**
 * Creates a new Client organization and its initial primary user atomically.
 * Automatically generates a secure temporary password and hashes it before storage.
 */
export async function createClient(
  input: CreateClientInput,
  adminUserId: string
): Promise<CreateClientResult> {
  // 1. Check for duplicate slug
  const existingSlug = await prisma.organization.findUnique({
    where: { slug: input.slug },
  });
  if (existingSlug) {
    throw new ValidationError("A client organization with this slug already exists.", {
      slug: ["Slug must be unique across all clients."],
    });
  }

  // 2. Check for duplicate user email
  const existingEmail = await prisma.user.findUnique({
    where: { email: input.userEmail },
  });
  if (existingEmail) {
    throw new ValidationError("A user with this email address already exists.", {
      userEmail: ["Email address is already in use."],
    });
  }

  // 3. Generate and hash temporary password
  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  // 4. Atomic transaction
  const result = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.create({
      data: {
        name: input.name,
        slug: input.slug,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        timezone: input.timezone || "Asia/Kolkata",
        status: OrganizationStatus.ACTIVE,
      },
    });

    const user = await tx.user.create({
      data: {
        name: input.userName,
        email: input.userEmail,
        passwordHash,
        role: Role.CLIENT,
        status: UserStatus.ACTIVE,
        organizationId: org.id,
      },
    });

    // Record activity log
    await tx.activityLog.create({
      data: {
        organizationId: org.id,
        actorId: adminUserId,
        action: "CLIENT_CREATED",
        entityType: "ORGANIZATION",
        entityId: org.id,
        metadata: {
          clientName: org.name,
          slug: org.slug,
          primaryUserEmail: user.email,
        },
      },
    });

    return { org, user };
  });

  logger.info("Client organization created successfully", {
    organizationId: result.org.id,
    adminUserId,
  });

  return {
    organization: result.org,
    user: {
      id: result.user.id,
      email: result.user.email,
      name: result.user.name,
    },
    temporaryPassword,
  };
}

/**
 * Updates an existing client organization's metadata.
 */
export async function updateClient(
  input: UpdateClientInput,
  adminUserId: string
) {
  const existing = await prisma.organization.findUnique({
    where: { id: input.id },
  });

  if (!existing) {
    throw new NotFoundError(`Client organization with ID "${input.id}" not found.`);
  }

  const isStatusChangingToInactive =
    existing.status === OrganizationStatus.ACTIVE && input.status === OrganizationStatus.INACTIVE;

  const updatedOrg = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: input.id },
      data: {
        name: input.name,
        contactEmail: input.contactEmail || null,
        contactPhone: input.contactPhone || null,
        timezone: input.timezone,
        status: input.status,
      },
    });

    // If deactivating, invalidate all active sessions for this client's users immediately
    if (isStatusChangingToInactive) {
      await tx.session.deleteMany({
        where: {
          user: {
            organizationId: input.id,
          },
        },
      });
    }

    // Record activity log
    await tx.activityLog.create({
      data: {
        organizationId: org.id,
        actorId: adminUserId,
        action: "CLIENT_UPDATED",
        entityType: "ORGANIZATION",
        entityId: org.id,
        metadata: {
          changes: {
            name: input.name,
            status: input.status,
            timezone: input.timezone,
          },
        },
      },
    });

    return org;
  });

  logger.info("Client organization updated", {
    organizationId: updatedOrg.id,
    status: updatedOrg.status,
    adminUserId,
  });

  return updatedOrg;
}

/**
 * Toggles a client organization's status between ACTIVE and INACTIVE.
 * When deactivating, all active sessions are instantly revoked.
 */
export async function toggleClientStatus(
  organizationId: string,
  newStatus: OrganizationStatus,
  adminUserId: string
) {
  const existing = await prisma.organization.findUnique({
    where: { id: organizationId },
  });

  if (!existing) {
    throw new NotFoundError(`Client organization with ID "${organizationId}" not found.`);
  }

  const updatedOrg = await prisma.$transaction(async (tx) => {
    const org = await tx.organization.update({
      where: { id: organizationId },
      data: { status: newStatus },
    });

    // When deactivating, revoke all active sessions for this organization's users immediately
    if (newStatus === OrganizationStatus.INACTIVE) {
      await tx.session.deleteMany({
        where: {
          user: {
            organizationId,
          },
        },
      });
    }

    await tx.activityLog.create({
      data: {
        organizationId,
        actorId: adminUserId,
        action: newStatus === OrganizationStatus.ACTIVE ? "CLIENT_REACTIVATED" : "CLIENT_DEACTIVATED",
        entityType: "ORGANIZATION",
        entityId: organizationId,
        metadata: { previousStatus: existing.status, newStatus },
      },
    });

    return org;
  });

  logger.info("Client organization status changed", {
    organizationId,
    newStatus,
    adminUserId,
  });

  return updatedOrg;
}

export interface ResetPasswordResult {
  organization: {
    id: string;
    name: string;
  };
  user: {
    id: string;
    email: string;
    name: string;
  };
  temporaryPassword: string;
}

/**
 * Generates a new secure temporary password for a client organization's primary user,
 * hashes and updates User.passwordHash, revokes active sessions, and logs an ActivityLog entry.
 */
export async function resetClientPassword(
  organizationId: string,
  adminUserId: string
): Promise<ResetPasswordResult> {
  const org = await prisma.organization.findUnique({
    where: { id: organizationId },
    include: {
      users: {
        where: { role: Role.CLIENT },
        orderBy: { createdAt: "asc" },
        take: 1,
      },
    },
  });

  if (!org) {
    throw new NotFoundError(`Client organization with ID "${organizationId}" not found.`);
  }

  const primaryUser = org.users[0];
  if (!primaryUser) {
    throw new NotFoundError(`No client user found for organization "${org.name}".`);
  }

  const temporaryPassword = generateTemporaryPassword();
  const passwordHash = await hashPassword(temporaryPassword);

  await prisma.$transaction(async (tx) => {
    // 1. Update password hash
    await tx.user.update({
      where: { id: primaryUser.id },
      data: { passwordHash },
    });

    // 2. Invalidate all active sessions for this user
    await tx.session.deleteMany({
      where: { userId: primaryUser.id },
    });

    // 3. Log audit event
    await tx.activityLog.create({
      data: {
        organizationId: org.id,
        actorId: adminUserId,
        action: "CLIENT_PASSWORD_RESET",
        entityType: "USER",
        entityId: primaryUser.id,
        metadata: {
          organizationName: org.name,
          userEmail: primaryUser.email,
        },
      },
    });
  });

  logger.info("Client password reset by admin", {
    organizationId: org.id,
    userId: primaryUser.id,
    adminUserId,
  });

  return {
    organization: {
      id: org.id,
      name: org.name,
    },
    user: {
      id: primaryUser.id,
      email: primaryUser.email,
      name: primaryUser.name,
    },
    temporaryPassword,
  };
}

