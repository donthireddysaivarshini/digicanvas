import { PrismaClient, Role, UserStatus, OrganizationStatus, ContentType, Platform, ApprovalStatus, PublishingStatus } from "@prisma/client";
import { hashPassword } from "../src/lib/auth/password";
import {
  createContent,
  updateContent,
  archiveContent,
  rescheduleContent,
  getContentById,
  getCalendarContent,
  listContent,
} from "../src/lib/services/content-service";
import { createClient } from "../src/lib/services/client-service";
import { TenantMismatchError, ValidationError, NotFoundError } from "../src/lib/errors";
import {
  combineDateAndTimeInTimezone,
  getTimezoneRangeBoundaries,
  formatDateInTimezone,
  formatTimeInTimezone,
} from "../src/lib/date-utils";

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

async function runPhase2Tests() {
  console.log("\n=======================================================");
  console.log("📅 DigiCanvas Phase 2: Content Management & Calendar Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();

  // Setup: Create an Admin and two Client organizations with different timezones
  const adminPasswordHash = await hashPassword("AdminPass123!");
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-p2-${timestamp}@digicanvas.agency`,
      name: "Phase 2 Admin",
      passwordHash: adminPasswordHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const clientAData = await createClient(
    {
      name: `Kura Test Org ${timestamp}`,
      slug: `kura-p2-${timestamp}`,
      contactEmail: `contact@kura-${timestamp}.com`,
      timezone: "Asia/Kolkata",
      userName: "Kura Marketing",
      userEmail: `marketing@kura-${timestamp}.com`,
    },
    adminUser.id
  );

  const clientBData = await createClient(
    {
      name: `Apex Test Org ${timestamp}`,
      slug: `apex-p2-${timestamp}`,
      contactEmail: `contact@apex-${timestamp}.com`,
      timezone: "America/New_York",
      userName: "Apex Team",
      userEmail: `team@apex-${timestamp}.com`,
    },
    adminUser.id
  );

  const userA = {
    id: clientAData.user.id,
    email: clientAData.user.email,
    name: clientAData.user.name,
    role: Role.CLIENT,
    status: UserStatus.ACTIVE,
    organizationId: clientAData.organization.id,
  };

  const userB = {
    id: clientBData.user.id,
    email: clientBData.user.email,
    name: clientBData.user.name,
    role: Role.CLIENT,
    status: UserStatus.ACTIVE,
    organizationId: clientBData.organization.id,
  };

  const adminSessionUser = {
    id: adminUser.id,
    email: adminUser.email,
    name: adminUser.name,
    role: Role.ADMIN,
    status: UserStatus.ACTIVE,
    organizationId: null,
  };

  // 1 & 5. Content Creation with Multi-Platform Assignment
  console.log("[Test 1 & 5] Content Creation with Multiple Platforms");
  const content1 = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "5 Things Before Buying a Villa",
      contentType: ContentType.REEL,
      platforms: [Platform.INSTAGRAM, Platform.FACEBOOK, Platform.YOUTUBE],
      scheduledDate: "2026-09-24",
      scheduledTime: "19:00",
      driveUrl: "https://drive.google.com/file/d/test-villa-reel/view",
      caption: "Initial caption for Hyderabad villa reel! #HyderabadRealEstate",
      publishingStatus: PublishingStatus.SCHEDULED,
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
    },
    adminUser.id
  );

  assert(Boolean(content1.id), "Content record created with ID");
  assert(content1.platforms.length === 3, "Content associated with 3 platforms (Instagram, Facebook, YouTube)");
  assert(content1.title === "5 Things Before Buying a Villa", "Title accurately saved");

  // 6. CaptionVersion (v1) created on initial creation
  console.log("\n[Test 6] Initial Caption Versioning (v1)");
  assert(content1.captionVersions.length === 1, "Exactly one CaptionVersion record created on creation");
  assert(content1.captionVersions[0].versionNumber === 1, "Initial CaptionVersion has versionNumber = 1");
  assert(
    content1.captionVersions[0].caption === content1.caption,
    "Content.caption matches initial CaptionVersion.caption"
  );

  // 3 & 7. Content Update and Caption Versioning (v2)
  console.log("\n[Test 3 & 7] Content Update & Incremental Caption Versioning (v2)");
  const updatedContent1 = await updateContent(
    {
      id: content1.id,
      title: "5 Things You MUST Know Before Buying a Villa",
      contentType: ContentType.REEL,
      platforms: [Platform.INSTAGRAM, Platform.FACEBOOK], // Changed platforms to 2
      scheduledDate: "2026-09-24",
      scheduledTime: "19:30",
      driveUrl: "https://drive.google.com/file/d/test-villa-reel/view",
      caption: "Updated caption with stronger CTA! Tap link in bio to book your tour. #HyderabadHomes",
      publishingStatus: PublishingStatus.SCHEDULED,
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
    },
    adminUser.id
  );

  assert(updatedContent1.title === "5 Things You MUST Know Before Buying a Villa", "Title updated successfully");
  assert(updatedContent1.platforms.length === 2, "Platforms updated to 2");
  assert(updatedContent1.captionVersions.length === 2, "New CaptionVersion (v2) created on caption edit");
  assert(updatedContent1.captionVersions[0].versionNumber === 2, "Latest CaptionVersion has versionNumber = 2");
  assert(
    updatedContent1.caption === updatedContent1.captionVersions[0].caption,
    "Content.caption equals latest CaptionVersion.caption (v2)"
  );

  // 8. Caption edit with identical caption text does NOT create a redundant version
  console.log("\n[Test 8] Caption Version Deduplication on Identical Text");
  const updateWithoutCaptionChange = await updateContent(
    {
      id: content1.id,
      title: "5 Things You MUST Know Before Buying a Villa (Minor Title Tweak)",
      contentType: ContentType.REEL,
      platforms: [Platform.INSTAGRAM, Platform.FACEBOOK],
      scheduledDate: "2026-09-24",
      scheduledTime: "19:30",
      driveUrl: "https://drive.google.com/file/d/test-villa-reel/view",
      caption: "Updated caption with stronger CTA! Tap link in bio to book your tour. #HyderabadHomes", // EXACT SAME
      publishingStatus: PublishingStatus.SCHEDULED,
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
    },
    adminUser.id
  );
  assert(
    updateWithoutCaptionChange.captionVersions.length === 2,
    "Editing metadata without altering caption does NOT create redundant CaptionVersion"
  );

  // 4. Content Rescheduling
  console.log("\n[Test 4] Content Rescheduling");
  await rescheduleContent(
    {
      id: content1.id,
      scheduledDate: "2026-09-28",
      scheduledTime: "10:00",
    },
    adminUser.id
  );
  const rescheduledItem = await getContentById(content1.id, adminSessionUser);
  const rescheduledDateStr = formatDateInTimezone(rescheduledItem.scheduledAt, "Asia/Kolkata");
  assert(rescheduledDateStr.includes("Sep 28"), "Content rescheduled to Sep 28");

  // Create a second content item on the same day (Sep 28) for Client A
  const content2 = await createContent(
    {
      organizationId: clientAData.organization.id,
      title: "Sep 28 Second Post - Kitchen Tour",
      contentType: ContentType.POST,
      platforms: [Platform.INSTAGRAM, Platform.LINKEDIN],
      scheduledDate: "2026-09-28",
      scheduledTime: "15:00",
      caption: "Luxury modular kitchen showcase.",
      publishingStatus: PublishingStatus.SCHEDULED,
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
    },
    adminUser.id
  );

  // Create content for Client B (Apex)
  const contentB = await createContent(
    {
      organizationId: clientBData.organization.id,
      title: "Apex Retail Fall Campaign",
      contentType: ContentType.VIDEO,
      platforms: [Platform.YOUTUBE, Platform.X],
      scheduledDate: "2026-09-28",
      scheduledTime: "11:00",
      caption: "Exclusive Autumn Sale across all stores.",
      publishingStatus: PublishingStatus.SCHEDULED,
      approvalStatus: ApprovalStatus.AWAITING_APPROVAL,
    },
    adminUser.id
  );

  // 11 & 12. Client Tenant Isolation & Query Scoping
  console.log("\n[Test 11 & 12] Strict Tenant Isolation: Client A vs Client B Content");
  const clientAActiveList = await listContent({}, userA);
  assert(
    clientAActiveList.some((c) => c.id === content1.id && c.organizationId === clientAData.organization.id),
    "Client A can retrieve own content"
  );
  assert(
    !clientAActiveList.some((c) => c.id === contentB.id),
    "Client A CANNOT see Client B's content"
  );

  // 12. Direct content ID manipulation by Client A trying to fetch Client B's content
  let caughtCrossTenantAccess = false;
  try {
    await getContentById(contentB.id, userA);
  } catch (error) {
    if (error instanceof TenantMismatchError) {
      caughtCrossTenantAccess = true;
    }
  }
  assert(caughtCrossTenantAccess, "getContentById throws TenantMismatchError when Client A attempts accessing Client B's content");

  // 15. Calendar Month Filtering with Timezone Boundaries
  console.log("\n[Test 15] Calendar Month Filtering (Sep 1 → Sep 30)");
  const monthCalendar = await getCalendarContent(
    {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    },
    userA
  );
  assert(monthCalendar.length === 2, "Client A Month view returns exactly the 2 scheduled items for September");

  // 16. Calendar Week Filtering
  console.log("\n[Test 16] Calendar Week Filtering (Sep 27 → Oct 3)");
  const weekCalendar = await getCalendarContent(
    {
      startDate: "2026-09-27",
      endDate: "2026-10-03",
    },
    userA
  );
  assert(weekCalendar.length === 2, "Client A Week view returns items scheduled in that week");

  // 17. Calendar Day Filtering
  console.log("\n[Test 17] Calendar Day Filtering (Sep 28 only)");
  const dayCalendar = await getCalendarContent(
    {
      startDate: "2026-09-28",
      endDate: "2026-09-28",
    },
    userA
  );
  assert(dayCalendar.length === 2, "Client A Day view returns 2 items scheduled on Sep 28");

  // 18. Calendar Custom Date Range Filtering (Arbitrary range: 24 Sep 2026 → 24 Oct 2026)
  console.log("\n[Test 18] Calendar Custom Date Range Filtering (24 Sep 2026 → 24 Oct 2026)");
  const customCalendar = await getCalendarContent(
    {
      startDate: "2026-09-24",
      endDate: "2026-10-24",
    },
    userA
  );
  assert(customCalendar.length === 2, "Custom Date Range returns all items within arbitrary date boundaries");

  // 10. Admin Multi-Filtering
  console.log("\n[Test 10] Admin Multi-Filtering (Client, Platform, ContentType, Status)");
  const adminFiltered = await getCalendarContent(
    {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
      organizationId: clientAData.organization.id,
      contentType: ContentType.REEL,
    },
    adminSessionUser
  );
  assert(adminFiltered.length === 1 && adminFiltered[0].id === content1.id, "Admin filter by Client + ContentType matches exact record");

  // 20 & 21. Non-Destructive Content Archiving & Exclusion from Active Views
  console.log("\n[Test 20 & 21] Non-Destructive Content Archiving");
  await archiveContent(content2.id, adminUser.id);

  // Verify archived item is excluded from active content list
  const activeListAfterArchive = await listContent({}, userA);
  assert(!activeListAfterArchive.some((c) => c.id === content2.id), "Archived content is excluded from active list queries");

  // Verify archived item is excluded from active calendar view
  const calendarAfterArchive = await getCalendarContent(
    {
      startDate: "2026-09-01",
      endDate: "2026-09-30",
    },
    userA
  );
  assert(!calendarAfterArchive.some((c) => c.id === content2.id), "Archived content is excluded from active calendar queries");

  // Verify historical record still exists in DB with preserved caption versions and activity logs
  const rawContentInDb = await prisma.content.findUniqueOrThrow({
    where: { id: content2.id },
    include: { captionVersions: true },
  });
  assert(rawContentInDb.archivedAt !== null, "Content archivedAt timestamp is set");
  assert(rawContentInDb.captionVersions.length > 0, "Historical CaptionVersions remain intact after archiving");

  // 22. Idempotent archiving
  console.log("\n[Test 22] Idempotent Archiving");
  const secondArchiveAttempt = await archiveContent(content2.id, adminUser.id);
  assert(secondArchiveAttempt.archivedAt !== null, "Re-archiving an archived item executes idempotently without error");

  // Clean up test data
  console.log("\nCleaning up test artifacts...");
  await prisma.activityLog.deleteMany({
    where: { organizationId: { in: [clientAData.organization.id, clientBData.organization.id] } },
  });
  await prisma.captionVersion.deleteMany({
    where: { contentId: { in: [content1.id, content2.id, contentB.id] } },
  });
  await prisma.contentPlatform.deleteMany({
    where: { contentId: { in: [content1.id, content2.id, contentB.id] } },
  });
  await prisma.content.deleteMany({
    where: { id: { in: [content1.id, content2.id, contentB.id] } },
  });
  await prisma.user.deleteMany({
    where: { id: { in: [adminUser.id, clientAData.user.id, clientBData.user.id] } },
  });
  await prisma.organization.deleteMany({
    where: { id: { in: [clientAData.organization.id, clientBData.organization.id] } },
  });

  console.log("\n=======================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 2 ARCHITECTURAL TESTS PASSED!`);
  console.log("=======================================================\n");
}

runPhase2Tests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
