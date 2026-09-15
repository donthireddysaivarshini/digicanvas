import { prisma } from "@/lib/db";
import { AuthenticatedUser } from "@/lib/auth/session";
import { assertOrganizationAccess } from "@/lib/auth/guards";
import {
  ApproveContentInput,
  RequestChangesInput,
  ClientCaptionEditInput,
  SubmitForApprovalInput,
  approveContentSchema,
  requestChangesSchema,
  clientCaptionEditSchema,
  submitForApprovalSchema,
} from "@/lib/validation/approval";
import { Role, ApprovalStatus, ApprovalAction, NotificationType } from "@prisma/client";
import {
  NotFoundError,
  ValidationError,
  TenantMismatchError,
  UnauthorizedError,
} from "@/lib/errors";
import { logger } from "@/lib/logger";
import { getContentById } from "@/lib/services/content-service";

/**
 * Client workflow: Approves a content item.
 * Creates an immutable Approval history record and logs activity.
 * Strict client role & tenant isolation enforced.
 * PublishingStatus remains completely independent and untouched.
 */
export async function approveContent(
  input: ApproveContentInput,
  user: AuthenticatedUser
) {
  const parsed = approveContentSchema.parse(input);

  // 1. Role verification: Only clients can approve
  if (user.role !== Role.CLIENT) {
    throw new UnauthorizedError("Only client users are authorized to approve content.");
  }

  if (!user.organizationId) {
    throw new TenantMismatchError("Client user lacks organization association.");
  }

  // 2. Fetch content and verify existence & active state
  const content = await prisma.content.findUnique({
    where: { id: parsed.contentId },
  });

  if (!content || content.archivedAt !== null) {
    throw new NotFoundError(`Active content with ID "${parsed.contentId}" not found.`);
  }

  // 3. Strict tenant isolation
  if (content.organizationId !== user.organizationId) {
    throw new TenantMismatchError("You do not have permission to access or approve this content.");
  }

  // 4. Transactional approval update + Approval audit record + Activity log
  await prisma.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: parsed.contentId },
      data: {
        approvalStatus: ApprovalStatus.APPROVED,
        updatedById: user.id,
      },
    });

    await tx.approval.create({
      data: {
        contentId: parsed.contentId,
        organizationId: user.organizationId!,
        userId: user.id,
        action: ApprovalAction.APPROVE,
        notes: null,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: user.organizationId!,
        actorId: user.id,
        action: "CONTENT_APPROVED",
        entityType: "CONTENT",
        entityId: parsed.contentId,
        metadata: {
          title: content.title,
          approvedBy: user.name,
        },
      },
    });

    // Create notification for agency/admins
    await tx.notification.create({
      data: {
        organizationId: user.organizationId!,
        userId: null,
        type: NotificationType.APPROVED,
        title: "Content Approved",
        message: `${user.name} approved "${content.title}".`,
        contentId: parsed.contentId,
        isRead: false,
      },
    });
  });

  logger.info("Content approved by client", {
    contentId: parsed.contentId,
    clientId: user.id,
    organizationId: user.organizationId,
  });

  return await getContentById(parsed.contentId, user);
}

/**
 * Client workflow: Requests changes on a content item.
 * Requires non-empty reason/notes.
 * Creates an immutable Approval history record (action: REQUEST_CHANGES) and logs activity.
 * Strict client role & tenant isolation enforced.
 * PublishingStatus remains completely independent and untouched.
 */
export async function requestChanges(
  input: RequestChangesInput,
  user: AuthenticatedUser
) {
  const parsed = requestChangesSchema.parse(input);

  // 1. Role verification: Only clients can request changes
  if (user.role !== Role.CLIENT) {
    throw new UnauthorizedError("Only client users are authorized to request changes.");
  }

  if (!user.organizationId) {
    throw new TenantMismatchError("Client user lacks organization association.");
  }

  const trimmedNotes = parsed.notes.trim();
  if (trimmedNotes.length === 0) {
    throw new ValidationError("Please provide notes explaining what changes are requested.");
  }

  // 2. Fetch content and verify existence & active state
  const content = await prisma.content.findUnique({
    where: { id: parsed.contentId },
  });

  if (!content || content.archivedAt !== null) {
    throw new NotFoundError(`Active content with ID "${parsed.contentId}" not found.`);
  }

  // 3. Strict tenant isolation
  if (content.organizationId !== user.organizationId) {
    throw new TenantMismatchError("You do not have permission to access or request changes for this content.");
  }

  // 4. Transactional update + Approval history record + Activity log
  await prisma.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: parsed.contentId },
      data: {
        approvalStatus: ApprovalStatus.CHANGES_REQUESTED,
        updatedById: user.id,
      },
    });

    await tx.approval.create({
      data: {
        contentId: parsed.contentId,
        organizationId: user.organizationId!,
        userId: user.id,
        action: ApprovalAction.REQUEST_CHANGES,
        notes: trimmedNotes,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: user.organizationId!,
        actorId: user.id,
        action: "CONTENT_CHANGES_REQUESTED",
        entityType: "CONTENT",
        entityId: parsed.contentId,
        metadata: {
          title: content.title,
          notes: trimmedNotes,
          requestedBy: user.name,
        },
      },
    });

    // Create notification for agency/admins
    await tx.notification.create({
      data: {
        organizationId: user.organizationId!,
        userId: null,
        type: NotificationType.CHANGES_REQUESTED,
        title: "Changes Requested",
        message: `${user.name} requested changes on "${content.title}": "${trimmedNotes}"`,
        contentId: parsed.contentId,
        isRead: false,
      },
    });
  });

  logger.info("Content change request submitted by client", {
    contentId: parsed.contentId,
    clientId: user.id,
    organizationId: user.organizationId,
  });

  return await getContentById(parsed.contentId, user);
}

/**
 * Client workflow: Edits ONLY the caption for a content item.
 * Clients are strictly prevented from altering administrative fields.
 * Transactionally updates Content.caption, creates the next CaptionVersion,
 * and maintains the invariant: Content.caption === latest CaptionVersion.caption.
 * Deduplicates: If the new caption is identical to the current caption, no new CaptionVersion is created.
 */
export async function updateCaptionByClient(
  input: ClientCaptionEditInput,
  user: AuthenticatedUser
) {
  const parsed = clientCaptionEditSchema.parse(input);

  // 1. Role verification: Only clients can use this client-caption edit workflow
  if (user.role !== Role.CLIENT) {
    throw new UnauthorizedError("Only client users can use the client caption edit workflow.");
  }

  if (!user.organizationId) {
    throw new TenantMismatchError("Client user lacks organization association.");
  }

  // 2. Fetch content with latest caption version
  const content = await prisma.content.findUnique({
    where: { id: parsed.contentId },
    include: {
      captionVersions: {
        orderBy: { versionNumber: "desc" },
        take: 1,
      },
    },
  });

  if (!content || content.archivedAt !== null) {
    throw new NotFoundError(`Active content with ID "${parsed.contentId}" not found.`);
  }

  // 3. Strict tenant isolation
  if (content.organizationId !== user.organizationId) {
    throw new TenantMismatchError("You do not have permission to edit this content's caption.");
  }

  const trimmedNewCaption = parsed.caption.trim();
  const trimmedOldCaption = (content.caption || "").trim();

  // Deduplication check: do not create redundant version if caption text hasn't changed
  if (trimmedNewCaption === trimmedOldCaption) {
    logger.info("Client caption edit identical to existing caption; skipping version creation", {
      contentId: parsed.contentId,
    });
    return await getContentById(parsed.contentId, user);
  }

  // 4. Transactional caption version increment + content update + activity log + notification
  const latestVersionNumber = content.captionVersions[0]?.versionNumber ?? 0;
  const nextVersionNumber = latestVersionNumber + 1;

  await prisma.$transaction(async (tx) => {
    // Create new sequential CaptionVersion
    await tx.captionVersion.create({
      data: {
        contentId: parsed.contentId,
        versionNumber: nextVersionNumber,
        caption: trimmedNewCaption,
        editedById: user.id,
      },
    });

    // Update Content record ONLY (preserving all other administrative fields)
    await tx.content.update({
      where: { id: parsed.contentId },
      data: {
        caption: parsed.caption,
        updatedById: user.id,
      },
    });

    // Log activity
    await tx.activityLog.create({
      data: {
        organizationId: user.organizationId!,
        actorId: user.id,
        action: "CAPTION_UPDATED_BY_CLIENT",
        entityType: "CONTENT",
        entityId: parsed.contentId,
        metadata: {
          title: content.title,
          versionNumber: nextVersionNumber,
          editedBy: user.name,
        },
      },
    });

    // Create notification for agency/admins
    await tx.notification.create({
      data: {
        organizationId: user.organizationId!,
        userId: null,
        type: NotificationType.INFO,
        title: "Caption Updated by Client",
        message: `${user.name} updated the caption for "${content.title}" (version ${nextVersionNumber}).`,
        contentId: parsed.contentId,
        isRead: false,
      },
    });
  });

  logger.info("Client caption updated successfully", {
    contentId: parsed.contentId,
    versionNumber: nextVersionNumber,
    clientId: user.id,
  });

  return await getContentById(parsed.contentId, user);
}

/**
 * Admin workflow: Submits or resubmits content for client review (moves to AWAITING_APPROVAL).
 * Used when content is DRAFT or after changes were requested and resolved.
 */
export async function submitForApproval(
  input: SubmitForApprovalInput,
  user: AuthenticatedUser
) {
  const parsed = submitForApprovalSchema.parse(input);

  // 1. Role verification: Only Admins can submit/resubmit content for approval
  if (user.role !== Role.ADMIN && user.role !== Role.SUPER_ADMIN) {
    throw new UnauthorizedError("Only admin users can submit content for approval.");
  }

  const content = await prisma.content.findUnique({
    where: { id: parsed.contentId },
  });

  if (!content || content.archivedAt !== null) {
    throw new NotFoundError(`Active content with ID "${parsed.contentId}" not found.`);
  }

  // Verify admin has access if scoped
  assertOrganizationAccess(content.organizationId, user);

  await prisma.$transaction(async (tx) => {
    await tx.content.update({
      where: { id: parsed.contentId },
      data: {
        approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
        updatedById: user.id,
      },
    });

    await tx.activityLog.create({
      data: {
        organizationId: content.organizationId,
        actorId: user.id,
        action: "CONTENT_SUBMITTED_FOR_APPROVAL",
        entityType: "CONTENT",
        entityId: parsed.contentId,
        metadata: {
          title: content.title,
          previousStatus: content.approvalStatus,
        },
      },
    });

    // Create notification for the client organization
    await tx.notification.create({
      data: {
        organizationId: content.organizationId,
        userId: null,
        type: NotificationType.APPROVAL_REQUIRED,
        title: "Content Ready for Review",
        message: `Content "${content.title}" is ready for your review and approval.`,
        contentId: parsed.contentId,
        isRead: false,
      },
    });
  });

  logger.info("Content submitted for approval by admin", {
    contentId: parsed.contentId,
    adminId: user.id,
  });

  return await getContentById(parsed.contentId, user);
}
