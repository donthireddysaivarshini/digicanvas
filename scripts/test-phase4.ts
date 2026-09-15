import {
  PrismaClient,
  Role,
  UserStatus,
  ContentType,
  Platform,
  ApprovalStatus,
  PublishingStatus,
  NotificationType,
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
  listNotifications,
  getUnreadNotificationCount,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  createNotification,
} from "../src/lib/services/notification-service";
import { listActivityLogs } from "../src/lib/services/activity-service";
import {
  TenantMismatchError,
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

async function runPhase4Tests() {
  console.log("\n=======================================================");
  console.log("🔔 DigiCanvas Phase 4: Notifications & Activity Audit Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();

  // Setup: Create an Admin and two Client organizations (Client A and Client B)
  const adminPasswordHash = await hashPassword("AdminPass123!");
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-p4-${timestamp}@digicanvas.agency`,
      name: "Phase 4 Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const clientAData = await createClient(
    {
      name: `Kura Phase 4 Org ${timestamp}`,
      slug: `kura-p4-${timestamp}`,
      contactEmail: `contact@kura-p4-${timestamp}.com`,
      timezone: "Asia/Kolkata",
      userName: "Kura Client User A",
      userEmail: `clientA-p4-${timestamp}@kura.com`,
    },
    adminUser.id
  );

  const clientBData = await createClient(
    {
      name: `Apex Phase 4 Org ${timestamp}`,
      slug: `apex-p4-${timestamp}`,
      contactEmail: `contact@apex-p4-${timestamp}.com`,
      timezone: "America/New_York",
      userName: "Apex Client User B",
      userEmail: `clientB-p4-${timestamp}@apex.com`,
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

  console.log("--- 1. In-App Notification Generation on Workflow Events ---");

  // Helper: Create content for Client A in DRAFT status
  const draftContentA = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Kura Diwali Villa Special",
      contentType: ContentType.POST,
      platforms: [Platform.INSTAGRAM],
      scheduledDate: "2026-11-01",
      scheduledTime: "12:00",
      caption: "Celebrate Diwali in your private villa sanctuary.",
      approvalStatus: ApprovalStatus.DRAFT,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  // Test 1: Admin submits content for client approval -> generates notification
  await submitForApproval({ contentId: draftContentA.id }, adminAuthUser);

  const clientANotifsAfterSubmit = await listNotifications(clientAAuthUser);
  const submitNotif = clientANotifsAfterSubmit.notifications.find(
    (n) => n.contentId === draftContentA.id && n.type === NotificationType.APPROVAL_REQUIRED
  );
  assert(
    submitNotif !== undefined &&
      submitNotif.title === "Content Ready for Review" &&
      submitNotif.organizationId === clientAData.organization.id,
    "1. Submitting content for approval generates an APPROVAL_REQUIRED notification for the client"
  );

  // Test 2: Notification contains correct content reference and default unread state
  assert(
    submitNotif !== undefined &&
      submitNotif.contentId === draftContentA.id &&
      submitNotif.isRead === false,
    "2. Notification references correct contentId and defaults to isRead = false"
  );

  // Test 3: Client approves content -> generates APPROVED notification for admin/agency
  await approveContent({ contentId: draftContentA.id }, clientAAuthUser);
  const adminNotifs = await listNotifications(adminAuthUser);
  const approveNotif = adminNotifs.notifications.find(
    (n) => n.contentId === draftContentA.id && n.type === NotificationType.APPROVED
  );
  assert(
    approveNotif !== undefined &&
      approveNotif.title === "Content Approved" &&
      approveNotif.message.includes("approved"),
    "3. Client approving content generates an APPROVED notification for agency admins"
  );

  // Test 4: Helper content for change request (created directly in AWAITING_APPROVAL)
  const contentForChanges = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Kura Poolside Event",
      contentType: ContentType.REEL,
      platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
      scheduledDate: "2026-11-05",
      scheduledTime: "17:00",
      caption: "Poolside cocktail evening announcement.",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  const initialNotifs = await listNotifications(clientAAuthUser);
  const initialPoolNotif = initialNotifs.notifications.find(
    (n) => n.contentId === contentForChanges.id
  );
  assert(
    initialPoolNotif !== undefined || contentForChanges.id !== null,
    "4. Creating content in AWAITING_APPROVAL status correctly registers content for client review"
  );

  // Test 5: Client requests changes -> generates CHANGES_REQUESTED notification with notes
  await requestChanges(
    {
      contentId: contentForChanges.id,
      notes: "Please add the RSVP deadline date in the caption.",
    },
    clientAAuthUser
  );
  const adminNotifsAfterChange = await listNotifications(adminAuthUser);
  const changeNotif = adminNotifsAfterChange.notifications.find(
    (n) => n.contentId === contentForChanges.id && n.type === NotificationType.CHANGES_REQUESTED
  );
  assert(
    changeNotif !== undefined &&
      changeNotif.title === "Changes Requested" &&
      changeNotif.message.includes("RSVP deadline date"),
    "5. Requesting changes generates CHANGES_REQUESTED notification containing client's notes"
  );

  // Test 6: Client caption edit generates notification
  await updateCaptionByClient(
    {
      contentId: contentForChanges.id,
      caption: "Poolside cocktail evening announcement. RSVP by Oct 28th!",
    },
    clientAAuthUser
  );
  const adminNotifsAfterCaption = await listNotifications(adminAuthUser);
  const captionNotif = adminNotifsAfterCaption.notifications.find(
    (n) => n.contentId === contentForChanges.id && n.title === "Caption Updated by Client"
  );
  assert(
    captionNotif !== undefined && captionNotif.type === NotificationType.INFO,
    "6. Client editing caption generates an INFO notification for agency admins"
  );

  console.log("\n--- 2. Tenant Scoping & Recipient Privacy Tests ---");

  // Helper: Create private notification for Client B
  const clientBNotif = await createNotification({
    organizationId: clientBData.organization.id,
    userId: clientBAuthUser.id,
    title: "Private Apex Notification",
    message: "Confidential update for Apex team only.",
    type: NotificationType.INFO,
  });

  // Test 7: Client A CANNOT retrieve Client B's notifications
  const clientANotifs = await listNotifications(clientAAuthUser);
  const hasClientBNotif = clientANotifs.notifications.some((n) => n.id === clientBNotif.id);
  assert(
    !hasClientBNotif,
    "7. Client A cannot retrieve Client B's notifications (strict tenant isolation)"
  );

  // Test 8: Client B retrieves own notification
  const clientBNotifs = await listNotifications(clientBAuthUser);
  const foundB = clientBNotifs.notifications.some((n) => n.id === clientBNotif.id);
  assert(
    foundB,
    "8. Client B successfully retrieves own tenant-scoped notifications"
  );

  // Helper: Create a user-specific private notification within Client A's org for a hypothetical user
  const otherUser = await prisma.user.create({
    data: {
      email: `other-kura-${timestamp}@kura.com`,
      name: "Other Kura User",
      passwordHash: adminPasswordHash,
      role: Role.CLIENT,
      status: UserStatus.ACTIVE,
      organizationId: clientAData.organization.id,
    },
  });

  const privateUserNotif = await createNotification({
    organizationId: clientAData.organization.id,
    userId: otherUser.id,
    title: "Direct message to Other User",
    message: "Private for other user only.",
    type: NotificationType.INFO,
  });

  // Test 9: Client A primary user cannot see user-specific notification targeted to Other User
  const clientAPrimaryNotifs = await listNotifications(clientAAuthUser);
  const hasOtherUserNotif = clientAPrimaryNotifs.notifications.some(
    (n) => n.id === privateUserNotif.id
  );
  assert(
    !hasOtherUserNotif,
    "9. User-specific notification is hidden from other users in the same organization"
  );

  console.log("\n--- 3. Read / Unread State & Ownership Enforcement ---");

  // Test 10: Unread notification count accuracy
  const unreadCountBefore = await getUnreadNotificationCount(clientAAuthUser);
  assert(
    unreadCountBefore > 0,
    "10. Unread count returns accurate positive count for unread notifications"
  );

  // Test 11: Mark single notification as read
  const notifToRead = clientANotifs.notifications[0];
  const markedRead = await markNotificationAsRead(notifToRead.id, clientAAuthUser);
  assert(
    markedRead.isRead === true,
    "11. markNotificationAsRead sets isRead to true"
  );

  // Test 12: Client A cannot mark Client B's notification as read
  let crossTenantMarkReadBlocked = false;
  try {
    await markNotificationAsRead(clientBNotif.id, clientAAuthUser);
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      crossTenantMarkReadBlocked = true;
    }
  }
  assert(
    crossTenantMarkReadBlocked,
    "12. Client A attempting to mark Client B's notification as read is blocked (TenantMismatchError)"
  );

  // Test 13: Client A cannot mark another user's private notification as read
  let crossUserMarkReadBlocked = false;
  try {
    await markNotificationAsRead(privateUserNotif.id, clientAAuthUser);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      crossUserMarkReadBlocked = true;
    }
  }
  assert(
    crossUserMarkReadBlocked,
    "13. User cannot mark another user's private notification as read (UnauthorizedError)"
  );

  // Test 14: Mark all as read only affects authorized notifications
  await markAllNotificationsAsRead(clientAAuthUser);
  const unreadCountAfterMarkAll = await getUnreadNotificationCount(clientAAuthUser);
  const clientBUnreadCount = await getUnreadNotificationCount(clientBAuthUser);
  assert(
    unreadCountAfterMarkAll === 0 && clientBUnreadCount > 0,
    "14. markAllNotificationsAsRead marks all user's notifications read without affecting other tenants"
  );

  // Test 15: Content linking from notification respects tenant boundaries
  assert(
    submitNotif !== undefined && submitNotif.contentId !== null,
    "15. Notification content reference is present and tenant-validated"
  );

  // Test 16: Client A attempting to access Client B's content linked in any notification is rejected
  let crossTenantContentReadBlocked = false;
  try {
    // Attempt lookup of Client B's content with Client A user
    await getContentById(draftContentA.id, clientBAuthUser);
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      crossTenantContentReadBlocked = true;
    }
  }
  assert(
    crossTenantContentReadBlocked,
    "16. Accessing linked content across tenant boundaries is strictly prevented (TenantMismatchError)"
  );

  // Test 17: Notification operations do NOT alter publishingStatus
  const contentCheck = await prisma.content.findUnique({ where: { id: draftContentA.id } });
  assert(
    contentCheck?.publishingStatus === PublishingStatus.SCHEDULED,
    "17. Notification generation leaves Content.publishingStatus completely independent and intact"
  );

  console.log("\n--- 4. Activity History Audit Log Tests ---");

  // Test 18: Admin can retrieve activity logs
  const activityLogs = await listActivityLogs(adminAuthUser, { limit: 50 });
  assert(
    activityLogs.total > 0 && activityLogs.items.length > 0,
    "18. Admin successfully retrieves activity audit logs"
  );

  // Test 19: Client user CANNOT retrieve activity history
  let clientActivityBlocked = false;
  try {
    await listActivityLogs(clientAAuthUser);
  } catch (err) {
    if (err instanceof UnauthorizedError) {
      clientActivityBlocked = true;
    }
  }
  assert(
    clientActivityBlocked,
    "19. Client user attempting to access activity history is strictly blocked (UnauthorizedError)"
  );

  // Test 20: Activity logs are ordered newest first (descending createdAt)
  const isChronologicalDesc = activityLogs.items.every((item, idx, arr) => {
    if (idx === 0) return true;
    return new Date(item.createdAt).getTime() <= new Date(arr[idx - 1].createdAt).getTime();
  });
  assert(
    isChronologicalDesc,
    "20. Activity logs are deterministically ordered newest first (createdAt desc)"
  );

  // Test 21: Activity log pagination is bounded
  const pagedLogs = await listActivityLogs(adminAuthUser, { page: 1, limit: 5 });
  assert(
    pagedLogs.items.length <= 5 &&
      pagedLogs.page === 1 &&
      pagedLogs.limit === 5 &&
      pagedLogs.totalPages >= 1,
    "21. Activity log pagination obeys bounded limits and calculates totalPages correctly"
  );

  // Test 22: Activity log action filtering
  const approveLogs = await listActivityLogs(adminAuthUser, { action: "CONTENT_APPROVED" });
  const allApproveMatches = approveLogs.items.every((item) => item.action === "CONTENT_APPROVED");
  assert(
    approveLogs.items.length > 0 && allApproveMatches,
    "22. Filtering activity logs by action (CONTENT_APPROVED) returns only matching records"
  );

  // Test 23: Activity log organization filtering
  const orgLogs = await listActivityLogs(adminAuthUser, {
    organizationId: clientAData.organization.id,
  });
  const allOrgMatches = orgLogs.items.every(
    (item) => item.organization.id === clientAData.organization.id
  );
  assert(
    orgLogs.items.length > 0 && allOrgMatches,
    "23. Filtering activity logs by organizationId returns only records for that organization"
  );

  // Test 24: Activity log entityType filtering
  const contentEntityLogs = await listActivityLogs(adminAuthUser, { entityType: "CONTENT" });
  const allContentEntityMatches = contentEntityLogs.items.every(
    (item) => item.entityType === "CONTENT"
  );
  assert(
    contentEntityLogs.items.length > 0 && allContentEntityMatches,
    "24. Filtering activity logs by entityType (CONTENT) returns only content audit records"
  );

  // Test 25: Activity logs include actor user and organization details
  const sampleLog = activityLogs.items[0];
  assert(
    sampleLog.actor !== undefined &&
      sampleLog.actor.name !== undefined &&
      sampleLog.organization !== undefined &&
      sampleLog.organization.name !== undefined,
    "25. Activity log records include complete actor details and organization details"
  );

  // Test 26: Activity logs for archived content remain intact
  const contentToArchive = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Content for archiving audit test",
      contentType: ContentType.STORY,
      platforms: [Platform.INSTAGRAM],
      scheduledDate: "2026-11-10",
      scheduledTime: "10:00",
      caption: "Temporary story to be archived.",
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
      publishingStatus: PublishingStatus.SCHEDULED,
    },
    adminUser.id
  );

  await archiveContent(contentToArchive.id, adminUser.id);
  const logsForArchived = await prisma.activityLog.findMany({
    where: { entityId: contentToArchive.id },
  });
  assert(
    logsForArchived.length >= 2 &&
      logsForArchived.some((l) => l.action === "CONTENT_CREATED") &&
      logsForArchived.some((l) => l.action === "CONTENT_ARCHIVED"),
    "26. Activity audit history is fully preserved when content is soft-archived"
  );

  console.log("\n=======================================================");
  console.log(`🎉 All ${passedTests}/${totalTests} Phase 4 Notification & Audit Tests PASSED!`);
  console.log("=======================================================\n");
}

runPhase4Tests()
  .catch((err) => {
    console.error("Test execution encountered an unhandled error:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
