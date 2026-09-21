import { PrismaClient, Role, UserStatus, OrganizationStatus, ContentType, Platform, ApprovalStatus, PublishingStatus, ApprovalAction, NotificationType } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resetClientPassword, listClients, getClientById } from "../src/lib/services/client-service";
import { createContent, updateContent, getContentById } from "../src/lib/services/content-service";
import { approveContent, requestChanges, updateCaptionByClient, submitForApproval } from "../src/lib/services/approval-service";
import { listNotifications, getUnreadNotificationCount } from "../src/lib/services/notification-service";
import { listActivityLogs } from "../src/lib/services/activity-service";
import { ValidationError, UnauthorizedError, TenantMismatchError } from "../src/lib/errors";

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 12);
}

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

async function runCorrectionsTests() {
  console.log("\n=======================================================");
  console.log(" DigiCanvas — UX & Workflow Corrections Test Suite");
  console.log("=======================================================\n");

  // Setup test tenant and admin
  const testSuffix = Date.now().toString().slice(-6);
  const adminPasswordHash = await hashPassword("AdminPass123!");
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-corr-${testSuffix}@agency.local`,
      name: "Corrections Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const clientOrg = await prisma.organization.create({
    data: {
      name: `Kura Corr ${testSuffix}`,
      slug: `kura-corr-${testSuffix}`,
      contactEmail: `contact@kuracorr${testSuffix}.com`,
      timezone: "Asia/Kolkata",
      status: OrganizationStatus.ACTIVE,
    },
  });

  const initialClientPassword = "InitialClientPass123!";
  const clientUser = await prisma.user.create({
    data: {
      email: `bob-${testSuffix}@kuracorr.local`,
      name: "Bob Client",
      passwordHash: await hashPassword(initialClientPassword),
      role: Role.CLIENT,
      status: UserStatus.ACTIVE,
      organizationId: clientOrg.id,
    },
  });

  // Create an active session for clientUser
  const activeSession = await prisma.session.create({
    data: {
      sessionToken: `token-client-${testSuffix}`,
      userId: clientUser.id,
      expiresAt: new Date(Date.now() + 86400000),
    },
  });

  const adminSessionUser = {
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    organizationId: null,
  };

  const clientSessionUser = {
    id: clientUser.id,
    email: clientUser.email,
    name: clientUser.name,
    role: Role.CLIENT,
    status: UserStatus.ACTIVE,
    organizationId: clientOrg.id,
  };

  try {
    // -------------------------------------------------------------
    // SECTION 1: Client Credentials & Password Reset Security
    // -------------------------------------------------------------
    console.log("\n[Section 1: Client Credentials & Password Reset Security]");

    // Test 1: listClients does not expose passwordHash
    const clientsList = await listClients();
    const targetOrg = clientsList.find((c) => c.id === clientOrg.id);
    assert(targetOrg !== undefined, "1. Client organization found in listClients");
    const userInList = targetOrg?.users[0] as any;
    assert(userInList?.passwordHash === undefined, "2. listClients does NOT leak passwordHash in user records");

    // Test 2: getClientById does not expose passwordHash
    const singleClient = await getClientById(clientOrg.id) as any;
    assert(singleClient?.users[0]?.passwordHash === undefined, "3. getClientById does NOT leak passwordHash in user records");

    // Test 3: Admin resets client password
    const resetResult = await resetClientPassword(clientOrg.id, adminUser.id);
    assert(typeof resetResult.temporaryPassword === "string" && resetResult.temporaryPassword.length >= 10, "4. resetClientPassword returns ephemeral temporary password");
    assert(resetResult.user.email === clientUser.email, "5. resetClientPassword targets correct client user");

    // Test 4: New password authenticates and old password fails
    const updatedUserInDb = await prisma.user.findUniqueOrThrow({ where: { id: clientUser.id } });
    const oldPasswordMatches = await bcrypt.compare(initialClientPassword, updatedUserInDb.passwordHash);
    const newPasswordMatches = await bcrypt.compare(resetResult.temporaryPassword, updatedUserInDb.passwordHash);
    assert(!oldPasswordMatches, "6. Old password can no longer authenticate after password reset");
    assert(newPasswordMatches, "7. Newly generated temporary password successfully authenticates against stored hash");

    // Test 5: Sessions invalidated on password reset
    const oldSessionInDb = await prisma.session.findUnique({ where: { id: activeSession.id } });
    assert(oldSessionInDb === null, "8. Existing active sessions for user are terminated upon password reset");

    // Test 6: Audit log created for password reset
    const resetAuditLog = await prisma.activityLog.findFirst({
      where: { organizationId: clientOrg.id, action: "CLIENT_PASSWORD_RESET" },
    });
    assert(resetAuditLog !== null, "9. CLIENT_PASSWORD_RESET ActivityLog audit entry created");
    assert(resetAuditLog?.actorId === adminUser.id, "10. CLIENT_PASSWORD_RESET correctly attributes admin as actor");

    // -------------------------------------------------------------
    // SECTION 2: Request Changes Workflow & Duplicate Prevention
    // -------------------------------------------------------------
    console.log("\n[Section 2: Request Changes Workflow & Server Guards]");

    // Create content in AWAITING_APPROVAL
    const content = await createContent(
      {
        organizationId: clientOrg.id,
        title: `Villa Launch Reel ${testSuffix}`,
        contentType: ContentType.REEL,
        scheduledDate: "2026-10-15",
        scheduledTime: "18:00",
        driveUrl: "https://drive.google.com/file/d/v1-asset/view",
        caption: "Initial caption for Villa Launch Reel.",
        platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
        approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
        publishingStatus: PublishingStatus.NOT_SCHEDULED,
      },
      adminUser.id
    );
    assert(content.approvalStatus === ApprovalStatus.AWAITING_APPROVAL, "11. Content created in AWAITING_APPROVAL status");

    // Client requests changes
    const changeNotes = "Please change the background banner to crimson red.";
    const afterChangeRequest = await requestChanges(
      { contentId: content.id, notes: changeNotes },
      clientSessionUser
    );
    assert(afterChangeRequest.approvalStatus === ApprovalStatus.CHANGES_REQUESTED, "12. Content status transitioned to CHANGES_REQUESTED");

    // Verify Approval audit record
    const changeApprovalRecord = await prisma.approval.findFirst({
      where: { contentId: content.id, action: ApprovalAction.REQUEST_CHANGES },
    });
    assert(changeApprovalRecord !== null && changeApprovalRecord.notes === changeNotes, "13. Approval record created with exact change notes");

    // Verify Admin notification contains client org name and change notes
    const adminNotification = await prisma.notification.findFirst({
      where: { contentId: content.id, type: NotificationType.CHANGES_REQUESTED },
    });
    assert(adminNotification !== null, "14. Admin notification generated for CHANGES_REQUESTED");
    assert(Boolean(adminNotification?.message.includes(clientOrg.name)), "15. Admin notification message includes client organization name");
    assert(Boolean(adminNotification?.message.includes(changeNotes)), "16. Admin notification message includes client change notes");

    // Test Duplicate Change Request Rejection: Client cannot submit another change request while in CHANGES_REQUESTED
    let duplicateRejected = false;
    try {
      await requestChanges(
        { contentId: content.id, notes: "Another change note before admin fixes it" },
        clientSessionUser
      );
    } catch (err) {
      if (err instanceof ValidationError) {
        duplicateRejected = true;
      }
    }
    assert(duplicateRejected, "17. Server rejects duplicate change request while content is already in CHANGES_REQUESTED");

    // -------------------------------------------------------------
    // SECTION 3: Admin Creative Updates & Single Resubmission Flow
    // -------------------------------------------------------------
    console.log("\n[Section 3: Admin Creative Updates & Single Resubmission Workflow]");

    // Admin updates the Google Drive creative URL
    const updatedDriveUrl = "https://drive.google.com/file/d/v2-crimson-asset/view";
    await updateContent(
      {
        id: content.id,
        title: `Villa Launch Reel ${testSuffix}`,
        contentType: ContentType.REEL,
        scheduledDate: "2026-10-15",
        scheduledTime: "18:00",
        driveUrl: updatedDriveUrl,
        caption: "Initial caption for Villa Launch Reel.",
        platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
        approvalStatus: ApprovalStatus.CHANGES_REQUESTED, // Still in changes requested before resubmission
        publishingStatus: PublishingStatus.NOT_SCHEDULED,
      },
      adminUser.id
    );

    // Verify CREATIVE_UPDATED activity log
    const creativeUpdatedLog = await prisma.activityLog.findFirst({
      where: { entityId: content.id, action: "CREATIVE_UPDATED" },
    });
    assert(creativeUpdatedLog !== null, "18. CREATIVE_UPDATED ActivityLog created when Google Drive link changes");

    // Content preview uses new Drive URL
    const freshContent = await getContentById(content.id, adminSessionUser);
    assert(freshContent.driveUrl === updatedDriveUrl, "19. Content record contains updated Google Drive URL");

    // Admin performs authoritative resubmission via submitForApproval
    const resubmittedContent = await submitForApproval(
      { contentId: content.id },
      adminSessionUser
    );
    assert(resubmittedContent.approvalStatus === ApprovalStatus.AWAITING_APPROVAL, "20. Content status transitioned back to AWAITING_APPROVAL");

    // Verify CONTENT_RESUBMITTED activity log
    const resubmittedActivityLog = await prisma.activityLog.findFirst({
      where: { entityId: content.id, action: "CONTENT_RESUBMITTED" },
    });
    assert(resubmittedActivityLog !== null, "21. CONTENT_RESUBMITTED ActivityLog recorded upon resubmission");

    // Verify Client notification for Content Resubmission
    const clientResubmitNotification = await prisma.notification.findFirst({
      where: {
        contentId: content.id,
        title: "Content Resubmitted",
      },
    });
    assert(clientResubmitNotification !== null, "22. Client received 'Content Resubmitted' notification");
    assert(Boolean(clientResubmitNotification?.message.includes("We've updated")), "23. Resubmission notification body is client-appropriate");

    // Verify original change request remains intact in Approval history
    const allApprovalsForContent = await prisma.approval.findMany({
      where: { contentId: content.id },
    });
    assert(allApprovalsForContent.length >= 1, "24. Previous change request remains intact in Approval history table (never overwritten)");

    // Client can now approve the resubmitted content
    const approvedContent = await approveContent(
      { contentId: content.id },
      clientSessionUser
    );
    assert(approvedContent.approvalStatus === ApprovalStatus.APPROVED, "25. Client successfully approves content after admin resubmission");

    // -------------------------------------------------------------
    // SECTION 4: Role-Specific Notifications & No Self-Action Pollution
    // -------------------------------------------------------------
    console.log("\n[Section 4: Role-Specific Notifications & No Self-Action Notifications]");

    // Client edits caption
    await updateCaptionByClient(
      { contentId: content.id, caption: "Updated final caption by Bob." },
      clientSessionUser
    );

    // Verify caption edit notification was created for Admin (userId: null) with organization name
    const captionNotif = await prisma.notification.findFirst({
      where: { contentId: content.id, type: NotificationType.INFO },
      orderBy: { createdAt: "desc" },
    });
    assert(captionNotif !== null, "26. Notification created for caption update");
    assert(Boolean(captionNotif?.message.includes(clientOrg.name)), "27. Caption update notification identifies client organization");
    assert(captionNotif?.userId === null, "28. Client did NOT receive a self-notification for their own caption edit");

    console.log(`\n=======================================================`);
    console.log(`🎉 ALL ${passedTests}/${totalTests} CORRECTIONS TESTS PASSED!`);
    console.log(`=======================================================\n`);
  } finally {
    // Clean up test data
    await prisma.activityLog.deleteMany({ where: { organizationId: clientOrg.id } });
    await prisma.notification.deleteMany({ where: { organizationId: clientOrg.id } });
    await prisma.approval.deleteMany({ where: { organizationId: clientOrg.id } });
    await prisma.captionVersion.deleteMany({ where: { content: { organizationId: clientOrg.id } } });
    await prisma.contentPlatform.deleteMany({ where: { content: { organizationId: clientOrg.id } } });
    await prisma.content.deleteMany({ where: { organizationId: clientOrg.id } });
    await prisma.session.deleteMany({ where: { user: { email: { contains: testSuffix } } } });
    await prisma.user.deleteMany({ where: { email: { contains: testSuffix } } });
    await prisma.organization.deleteMany({ where: { id: clientOrg.id } });
    await prisma.$disconnect();
  }
}

runCorrectionsTests().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
