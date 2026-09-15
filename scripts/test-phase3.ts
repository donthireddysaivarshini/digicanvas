import {
  PrismaClient,
  Role,
  UserStatus,
  ContentType,
  Platform,
  ApprovalStatus,
  PublishingStatus,
  ApprovalAction,
} from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  createContent,
  archiveContent,
  getContentById,
} from "../src/lib/services/content-service";
import {
  approveContent,
  requestChanges,
  updateCaptionByClient,
  submitForApproval,
} from "../src/lib/services/approval-service";
import { createClient } from "../src/lib/services/client-service";
import {
  TenantMismatchError,
  ValidationError,
  NotFoundError,
  UnauthorizedError,
} from "../src/lib/errors";

const prisma = new PrismaClient();

let passedTests = 0;
let totalTests = 0;

function assert(condition: boolean, testName: string) {
  totalTests++;
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedTests++;
  } else {
    console.error(`  ✗ FAIL: ${testName}`);
    throw new Error(`Test failed: ${testName}`);
  }
}

async function runPhase3Tests() {
  console.log("\n=======================================================");
  console.log("🛡️ DigiCanvas Phase 3: Approval Workflow & Security Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();

  // Setup: Create an Admin and two Client organizations (Client A and Client B)
  const adminPasswordHash = await hashPassword("AdminPass123!");
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-p3-${timestamp}@digicanvas.agency`,
      name: "Phase 3 Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const clientAData = await createClient(
    {
      name: `Kura Phase 3 Org ${timestamp}`,
      slug: `kura-p3-${timestamp}`,
      contactEmail: `contact@kura-p3-${timestamp}.com`,
      timezone: "Asia/Kolkata",
      userName: "Kura Client User",
      userEmail: `client-kura-p3-${timestamp}@kura.com`,
    },
    adminUser.id
  );

  const clientBData = await createClient(
    {
      name: `Apex Phase 3 Org ${timestamp}`,
      slug: `apex-p3-${timestamp}`,
      contactEmail: `contact@apex-p3-${timestamp}.com`,
      timezone: "America/New_York",
      userName: "Apex Client User",
      userEmail: `client-apex-p3-${timestamp}@apex.com`,
    },
    adminUser.id
  );

  const adminAuthUser = {
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: Role.ADMIN,
    status: "ACTIVE" as const,
    organizationId: null,
  };

  const clientAAuthUser = {
    id: clientAData.user.id,
    email: clientAData.user.email,
    name: clientAData.user.name,
    role: Role.CLIENT,
    status: "ACTIVE" as const,
    organizationId: clientAData.organization.id,
  };

  const clientBAuthUser = {
    id: clientBData.user.id,
    email: clientBData.user.email,
    name: clientBData.user.name,
    role: Role.CLIENT,
    status: "ACTIVE" as const,
    organizationId: clientBData.organization.id,
  };

  // Helper: Create sample content for Client A
  const sampleContentA = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Kura Monsoon Promotion Reel",
      contentType: ContentType.REEL,
      platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
      scheduledDate: "2026-10-15",
      scheduledTime: "14:30",
      driveUrl: "https://drive.google.com/file/d/sample-kura-asset/view",
      caption: "Experience monsoon living with 20% savings. Book your tour today! #MonsoonVillas",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  // Helper: Create sample content for Client B
  const sampleContentB = await createContent(
    {
      organizationId: clientBData.organization.id,
      title: "Apex Fall Collection Launch",
      contentType: ContentType.POST,
      platforms: [Platform.LINKEDIN, Platform.X],
      scheduledDate: "2026-10-20",
      scheduledTime: "10:00",
      driveUrl: "https://drive.google.com/file/d/sample-apex-asset/view",
      caption: "Introducing our Fall 2026 apparel lineup.",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  console.log("--- 1. Client Approval Workflow Tests ---");

  // Test 1: Client A successfully approves Client A's content
  const approvedContentA = await approveContent(
    { contentId: sampleContentA.id },
    clientAAuthUser
  );
  assert(
    approvedContentA.approvalStatus === ApprovalStatus.APPROVED,
    "1. Client A successfully approves content and status transitions to APPROVED"
  );

  // Test 2: Approval audit record is created
  const approvalsA = await prisma.approval.findMany({
    where: { contentId: sampleContentA.id },
  });
  assert(
    approvalsA.length === 1 &&
      approvalsA[0].action === ApprovalAction.APPROVE &&
      approvalsA[0].userId === clientAAuthUser.id &&
      approvalsA[0].organizationId === clientAData.organization.id,
    "2. An immutable Approval audit record is created with action: APPROVE and actor userId"
  );

  // Test 3: Publishing status remains completely untouched during approval
  assert(
    approvedContentA.publishingStatus === PublishingStatus.SCHEDULED,
    "3. Publishing status remains completely independent and unmodified during approval"
  );

  // Test 4: ActivityLog entry is created for approval
  const approvalActivityLog = await prisma.activityLog.findFirst({
    where: {
      entityId: sampleContentA.id,
      action: "CONTENT_APPROVED",
    },
  });
  assert(
    approvalActivityLog !== null &&
      approvalActivityLog.actorId === clientAAuthUser.id &&
      approvalActivityLog.organizationId === clientAData.organization.id,
    "4. An ActivityLog audit entry is generated for the approval action"
  );

  console.log("\n--- 2. Client Request Changes Workflow Tests ---");

  // Helper content for change request tests
  const contentForChanges = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Kura Weekend Spotlight",
      contentType: ContentType.POST,
      platforms: [Platform.INSTAGRAM],
      scheduledDate: "2026-10-18",
      scheduledTime: "16:00",
      driveUrl: "https://drive.google.com/file/d/sample-spotlight/view",
      caption: "Discover the luxury amenities at Kura Villas.",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  // Test 5: Client requests changes with valid notes
  const requestedChangesContent = await requestChanges(
    {
      contentId: contentForChanges.id,
      notes: "Please change the headline font to Serif and mention the infinity pool explicitly.",
    },
    clientAAuthUser
  );
  assert(
    requestedChangesContent.approvalStatus === ApprovalStatus.CHANGES_REQUESTED,
    "5. Client requests changes and status transitions to CHANGES_REQUESTED"
  );

  // Test 6: Approval record stores client's change request notes
  const changeApprovalRecord = await prisma.approval.findFirst({
    where: {
      contentId: contentForChanges.id,
      action: ApprovalAction.REQUEST_CHANGES,
    },
  });
  assert(
    changeApprovalRecord !== null &&
      changeApprovalRecord.notes ===
        "Please change the headline font to Serif and mention the infinity pool explicitly." &&
      changeApprovalRecord.userId === clientAAuthUser.id,
    "6. Approval record stores the client's change request notes accurately"
  );

  // Test 7: Reject empty or whitespace-only change request notes
  let emptyNotesRejected = false;
  try {
    await requestChanges(
      {
        contentId: contentForChanges.id,
        notes: "   ",
      },
      clientAAuthUser
    );
  } catch (err) {
    emptyNotesRejected = true;
  }
  assert(
    emptyNotesRejected,
    "7. Submitting empty or whitespace-only change request notes is strictly rejected"
  );

  // Test 8: Publishing status remains untouched during request changes
  assert(
    requestedChangesContent.publishingStatus === PublishingStatus.SCHEDULED,
    "8. Publishing status remains completely untouched during change request"
  );

  console.log("\n--- 3. Approval History Preservation & Resubmission Tests ---");

  // Test 9: Admin resubmits content for client review (CHANGES_REQUESTED -> AWAITING_APPROVAL)
  const resubmittedContent = await submitForApproval(
    { contentId: contentForChanges.id },
    adminAuthUser
  );
  assert(
    resubmittedContent.approvalStatus === ApprovalStatus.AWAITING_APPROVAL,
    "9. Admin can transition content from CHANGES_REQUESTED back to AWAITING_APPROVAL"
  );

  // Test 10: Client now approves the resubmitted content
  await approveContent({ contentId: contentForChanges.id }, clientAAuthUser);
  const allApprovals = await prisma.approval.findMany({
    where: { contentId: contentForChanges.id },
    orderBy: { createdAt: "asc" },
  });
  assert(
    allApprovals.length === 2 &&
      allApprovals[0].action === ApprovalAction.REQUEST_CHANGES &&
      allApprovals[1].action === ApprovalAction.APPROVE,
    "10. Historical Approval audit timeline is fully preserved across multiple workflow cycles"
  );

  console.log("\n--- 4. Client Caption Editing & Versioning Invariants ---");

  // Helper content for caption editing
  const captionTestContent = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Kura Caption Versioning Demo",
      contentType: ContentType.POST,
      platforms: [Platform.INSTAGRAM],
      scheduledDate: "2026-10-22",
      scheduledTime: "11:00",
      driveUrl: "https://drive.google.com/file/d/demo/view",
      caption: "Original caption written by agency admin (v1).",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  // Test 11: Content creation created CaptionVersion v1
  const initialVersions = await prisma.captionVersion.findMany({
    where: { contentId: captionTestContent.id },
  });
  assert(
    initialVersions.length === 1 &&
      initialVersions[0].versionNumber === 1 &&
      initialVersions[0].caption === "Original caption written by agency admin (v1).",
    "11. Initial content creation creates CaptionVersion v1"
  );

  // Test 12: Client edits caption -> creates CaptionVersion v2
  const updatedByClient = await updateCaptionByClient(
    {
      contentId: captionTestContent.id,
      caption: "Client updated this caption with revised contact details (v2).",
    },
    clientAAuthUser
  );
  const versionsAfterEdit = await prisma.captionVersion.findMany({
    where: { contentId: captionTestContent.id },
    orderBy: { versionNumber: "asc" },
  });
  assert(
    versionsAfterEdit.length === 2 &&
      versionsAfterEdit[1].versionNumber === 2 &&
      versionsAfterEdit[1].caption === "Client updated this caption with revised contact details (v2)." &&
      versionsAfterEdit[1].editedById === clientAAuthUser.id,
    "12. Client caption edit creates CaptionVersion v2 with client user as editedById"
  );

  // Test 13: Invariant check: Content.caption === latest CaptionVersion.caption
  assert(
    updatedByClient.caption === versionsAfterEdit[1].caption,
    "13. Invariant holds: Content.caption strictly matches latest CaptionVersion.caption"
  );

  // Test 14: Client caption edit preserves administrative fields
  assert(
    updatedByClient.title === captionTestContent.title &&
      updatedByClient.contentType === captionTestContent.contentType &&
      updatedByClient.driveUrl === captionTestContent.driveUrl &&
      updatedByClient.publishingStatus === captionTestContent.publishingStatus,
    "14. Client caption edit strictly modifies ONLY the caption and leaves all administrative fields intact"
  );

  // Test 15: Deduplication check: Identical caption submission does NOT create a redundant version
  await updateCaptionByClient(
    {
      contentId: captionTestContent.id,
      caption: "Client updated this caption with revised contact details (v2).",
    },
    clientAAuthUser
  );
  const versionsAfterDuplicate = await prisma.captionVersion.findMany({
    where: { contentId: captionTestContent.id },
  });
  assert(
    versionsAfterDuplicate.length === 2,
    "15. Submitting identical caption text does NOT create an unnecessary duplicate CaptionVersion"
  );

  console.log("\n--- 5. Strict Multi-Tenant Isolation & Cross-Tenant Protection ---");

  // Test 16: Client A cannot approve Client B's content
  let crossTenantApproveBlocked = false;
  try {
    await approveContent({ contentId: sampleContentB.id }, clientAAuthUser);
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      crossTenantApproveBlocked = true;
    }
  }
  assert(
    crossTenantApproveBlocked,
    "16. Client A attempting to approve Client B's content is blocked with TenantMismatchError"
  );

  // Test 17: Client A cannot request changes on Client B's content
  let crossTenantChangeBlocked = false;
  try {
    await requestChanges(
      {
        contentId: sampleContentB.id,
        notes: "Attempted cross-tenant change request",
      },
      clientAAuthUser
    );
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      crossTenantChangeBlocked = true;
    }
  }
  assert(
    crossTenantChangeBlocked,
    "17. Client A attempting to request changes on Client B's content is blocked with TenantMismatchError"
  );

  // Test 18: Client A cannot edit Client B's caption
  let crossTenantCaptionBlocked = false;
  try {
    await updateCaptionByClient(
      {
        contentId: sampleContentB.id,
        caption: "Malicious caption modification",
      },
      clientAAuthUser
    );
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      crossTenantCaptionBlocked = true;
    }
  }
  assert(
    crossTenantCaptionBlocked,
    "18. Client A attempting to edit Client B's caption is blocked with TenantMismatchError"
  );

  // Test 19: Client A cannot read Client B's content details
  let crossTenantReadBlocked = false;
  try {
    await getContentById(sampleContentB.id, clientAAuthUser);
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      crossTenantReadBlocked = true;
    }
  }
  assert(
    crossTenantReadBlocked,
    "19. Client A attempting to read Client B's content details is blocked with TenantMismatchError"
  );

  console.log("\n--- 6. Role Authorization & Privilege Protection ---");

  // Test 20: Admin user cannot directly invoke client approveContent
  let adminClientApproveBlocked = false;
  try {
    await approveContent({ contentId: sampleContentA.id }, adminAuthUser);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      adminClientApproveBlocked = true;
    }
  }
  assert(
    adminClientApproveBlocked,
    "20. Admin user cannot invoke client approveContent (strictly client-only role guard)"
  );

  // Test 21: Admin user cannot directly invoke client requestChanges
  let adminClientChangesBlocked = false;
  try {
    await requestChanges(
      {
        contentId: sampleContentA.id,
        notes: "Admin notes",
      },
      adminAuthUser
    );
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      adminClientChangesBlocked = true;
    }
  }
  assert(
    adminClientChangesBlocked,
    "21. Admin user cannot invoke client requestChanges (strictly client-only role guard)"
  );

  // Test 22: Client user cannot invoke admin submitForApproval
  let clientSubmitApprovalBlocked = false;
  try {
    await submitForApproval({ contentId: sampleContentA.id }, clientAAuthUser);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      clientSubmitApprovalBlocked = true;
    }
  }
  assert(
    clientSubmitApprovalBlocked,
    "22. Client user cannot invoke admin submitForApproval (strictly admin-only role guard)"
  );

  console.log("\n--- 7. Non-Destructive Archiving & Workflow Protection ---");

  // Helper content for archiving tests
  const contentToArchive = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Content to be archived",
      contentType: ContentType.STORY,
      platforms: [Platform.INSTAGRAM],
      scheduledDate: "2026-10-25",
      scheduledTime: "09:00",
      caption: "Story before archiving",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  await archiveContent(contentToArchive.id, adminUser.id);

  // Test 23: Archived content cannot be approved
  let archivedApproveBlocked = false;
  try {
    await approveContent({ contentId: contentToArchive.id }, clientAAuthUser);
  } catch (err) {
    if (err instanceof NotFoundError) {
      archivedApproveBlocked = true;
    }
  }
  assert(
    archivedApproveBlocked,
    "23. Archived content cannot be approved (returns NotFoundError)"
  );

  // Test 24: Archived content cannot have changes requested
  let archivedChangesBlocked = false;
  try {
    await requestChanges(
      { contentId: contentToArchive.id, notes: "Try requesting changes" },
      clientAAuthUser
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      archivedChangesBlocked = true;
    }
  }
  assert(
    archivedChangesBlocked,
    "24. Archived content cannot have changes requested (returns NotFoundError)"
  );

  // Test 25: Archived content cannot have caption edited
  let archivedCaptionBlocked = false;
  try {
    await updateCaptionByClient(
      { contentId: contentToArchive.id, caption: "New caption" },
      clientAAuthUser
    );
  } catch (err) {
    if (err instanceof NotFoundError) {
      archivedCaptionBlocked = true;
    }
  }
  assert(
    archivedCaptionBlocked,
    "25. Archived content cannot have its caption edited (returns NotFoundError)"
  );

  // Test 26: History for archived content remains intact in database
  const archivedCaptionVersions = await prisma.captionVersion.findMany({
    where: { contentId: contentToArchive.id },
  });
  const archivedActivityLogs = await prisma.activityLog.findMany({
    where: { entityId: contentToArchive.id },
  });
  assert(
    archivedCaptionVersions.length === 1 && archivedActivityLogs.length >= 2,
    "26. CaptionVersion and ActivityLog histories remain intact in database after non-destructive archiving"
  );

  console.log("\n=======================================================");
  console.log(`🎉 All ${passedTests}/${totalTests} Phase 3 Approval Workflow Tests PASSED!`);
  console.log("=======================================================\n");
}

runPhase3Tests()
  .catch((err) => {
    console.error("Test execution encountered an unhandled error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
