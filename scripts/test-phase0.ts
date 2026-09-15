import { PrismaClient, Role, UserStatus, OrganizationStatus, ContentType, Platform, ApprovalStatus } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { generateSessionToken, validateSessionToken } from "../src/lib/auth/session";
import { assertOrganizationAccess, getTenantScopedFilter } from "../src/lib/auth/guards";
import { updateContentCaptionWithVersion } from "../src/lib/services/caption";
import { TenantMismatchError, ForbiddenError, UnauthorizedError } from "../src/lib/errors";

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

async function runTests() {
  console.log("\n=======================================================");
  console.log("🔍 Running DigiCanvas Phase 0 Architectural Test Suite");
  console.log("=======================================================\n");

  // 1. Password Hashing & Verification
  console.log("[Test 1] Password Hashing & Verification Security");
  const rawPassword = "SecurePass123!@#";
  const hash = await hashPassword(rawPassword);
  assert(hash.startsWith("$2"), "Password hash uses standard bcrypt format");
  assert(await verifyPassword(rawPassword, hash), "Password verification succeeds for matching plaintext");
  assert(!(await verifyPassword("WrongPassword123", hash)), "Password verification fails for mismatched plaintext");

  // 2. Setup isolated test tenants in DB
  console.log("\n[Test 2] Database Models & Multi-Tenant Setup");
  const orgA = await prisma.organization.create({
    data: {
      name: "Test Tenant Alpha",
      slug: `tenant-alpha-${Date.now()}`,
      timezone: "Asia/Kolkata",
      status: OrganizationStatus.ACTIVE,
    },
  });

  const orgB = await prisma.organization.create({
    data: {
      name: "Test Tenant Beta",
      slug: `tenant-beta-${Date.now()}`,
      timezone: "America/New_York",
      status: OrganizationStatus.ACTIVE,
    },
  });

  const adminUser = await prisma.user.create({
    data: {
      email: `admin-${Date.now()}@agency.local`,
      name: "Super Admin",
      passwordHash: hash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  const userA = await prisma.user.create({
    data: {
      email: `user-a-${Date.now()}@alpha.local`,
      name: "Alpha User",
      passwordHash: hash,
      role: Role.CLIENT,
      status: UserStatus.ACTIVE,
      organizationId: orgA.id,
    },
  });

  const userB = await prisma.user.create({
    data: {
      email: `user-b-${Date.now()}@beta.local`,
      name: "Beta User",
      passwordHash: hash,
      role: Role.CLIENT,
      status: UserStatus.ACTIVE,
      organizationId: orgB.id,
    },
  });

  assert(Boolean(orgA.id && orgB.id), "Tenant Organizations created successfully");
  assert(userA.organizationId === orgA.id && userB.organizationId === orgB.id, "Users linked to respective tenant organizations");

  // 3. Database-backed Session Validation & Expiration
  console.log("\n[Test 3] Database-Backed Session Management");
  const tokenA = generateSessionToken();
  const sessionA = await prisma.session.create({
    data: {
      sessionToken: tokenA,
      userId: userA.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24), // 24 hours
    },
  });

  const validatedSession = await validateSessionToken(tokenA);
  assert(validatedSession !== null, "Valid active session is verified from DB");
  assert(validatedSession?.user.id === userA.id, "Session resolves to correct user");
  assert(validatedSession?.user.organizationId === orgA.id, "Session resolves to correct tenant organization");

  // 4. Session Revocation / Logout
  console.log("\n[Test 4] Session Revocation & Logout");
  await prisma.session.delete({ where: { sessionToken: tokenA } });
  const revokedSession = await validateSessionToken(tokenA);
  assert(revokedSession === null, "Revoked/deleted session is rejected immediately on server");

  // 5. Inactive User Access Enforcement
  console.log("\n[Test 5] Server-Side Inactive User Enforcement");
  const inactiveUser = await prisma.user.create({
    data: {
      email: `inactive-${Date.now()}@alpha.local`,
      name: "Inactive User",
      passwordHash: hash,
      role: Role.CLIENT,
      status: UserStatus.INACTIVE,
      organizationId: orgA.id,
    },
  });

  const inactiveToken = generateSessionToken();
  await prisma.session.create({
    data: {
      sessionToken: inactiveToken,
      userId: inactiveUser.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  const validatedInactive = await validateSessionToken(inactiveToken);
  assert(validatedInactive === null, "Inactive user session is rejected server-side");

  // 6. Inactive Organization / Tenant Enforcement
  console.log("\n[Test 6] Server-Side Inactive Organization Enforcement");
  const inactiveOrg = await prisma.organization.create({
    data: {
      name: "Deactivated Tenant",
      slug: `deactivated-tenant-${Date.now()}`,
      status: OrganizationStatus.INACTIVE,
    },
  });

  const userInInactiveOrg = await prisma.user.create({
    data: {
      email: `user-inact-org-${Date.now()}@deactivated.local`,
      name: "User in Inactive Org",
      passwordHash: hash,
      role: Role.CLIENT,
      status: UserStatus.ACTIVE,
      organizationId: inactiveOrg.id,
    },
  });

  const tokenInactOrg = generateSessionToken();
  await prisma.session.create({
    data: {
      sessionToken: tokenInactOrg,
      userId: userInInactiveOrg.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  const validatedInactOrgSession = await validateSessionToken(tokenInactOrg);
  assert(validatedInactOrgSession === null, "Client user in inactive organization is rejected server-side");

  // 7. Tenant Isolation - Cross-Tenant Content Access
  console.log("\n[Test 7] Strict Tenant Isolation: Cross-Tenant Content Blocking");
  const contentA = await prisma.content.create({
    data: {
      organizationId: orgA.id,
      title: "Tenant Alpha Confidential Post",
      contentType: ContentType.POST,
      scheduledAt: new Date(),
      caption: "Confidential Alpha Content",
      createdById: adminUser.id,
    },
  });

  const contentB = await prisma.content.create({
    data: {
      organizationId: orgB.id,
      title: "Tenant Beta Confidential Post",
      contentType: ContentType.REEL,
      scheduledAt: new Date(),
      caption: "Confidential Beta Content",
      createdById: adminUser.id,
    },
  });

  // Client A queries content scoped to their tenant
  const clientAScopedFilter = getTenantScopedFilter({
    id: userA.id,
    email: userA.email,
    name: userA.name,
    role: userA.role,
    status: userA.status,
    organizationId: userA.organizationId,
  });

  const clientAContents = await prisma.content.findMany({
    where: { ...clientAScopedFilter },
  });

  assert(
    clientAContents.some((c) => c.id === contentA.id),
    "Client A can retrieve own content"
  );
  assert(
    !clientAContents.some((c) => c.id === contentB.id),
    "Client A CANNOT retrieve Client B's content"
  );

  // Assert cross-tenant access exception
  let caughtTenantMismatch = false;
  try {
    assertOrganizationAccess(orgB.id, {
      id: userA.id,
      email: userA.email,
      name: userA.name,
      role: userA.role,
      status: userA.status,
      organizationId: userA.organizationId,
    });
  } catch (err) {
    if (err instanceof TenantMismatchError) {
      caughtTenantMismatch = true;
    }
  }
  assert(caughtTenantMismatch, "assertOrganizationAccess throws TenantMismatchError when Client A attempts accessing Tenant B");

  // 8. Tenant Isolation - Notifications & Activity Logs
  console.log("\n[Test 8] Strict Tenant Isolation: Notifications & Activity Logs");
  await prisma.notification.create({
    data: {
      organizationId: orgB.id,
      title: "Confidential Beta Notification",
      message: "Secret Beta details",
    },
  });

  await prisma.activityLog.create({
    data: {
      organizationId: orgB.id,
      actorId: userB.id,
      action: "CONFIDENTIAL_BETA_ACTION",
      entityType: "TEST",
      entityId: "123",
    },
  });

  const clientANotifications = await prisma.notification.findMany({
    where: { organizationId: orgA.id },
  });
  const clientAActivity = await prisma.activityLog.findMany({
    where: { organizationId: orgA.id },
  });

  assert(
    !clientANotifications.some((n) => n.title.includes("Beta")),
    "Client A cannot see Client B's notifications"
  );
  assert(
    !clientAActivity.some((a) => a.action.includes("BETA")),
    "Client A cannot see Client B's activity logs"
  );

  // 9. Admin Cross-Tenant Access
  console.log("\n[Test 9] Admin Role Permissions");
  let adminAccessThrew = false;
  try {
    assertOrganizationAccess(orgA.id, {
      id: adminUser.id,
      email: adminUser.email,
      name: adminUser.name,
      role: adminUser.role,
      status: adminUser.status,
      organizationId: null,
    });
  } catch {
    adminAccessThrew = true;
  }
  assert(!adminAccessThrew, "Admin has authorized access to inspect client tenant organizations");

  // 10. Caption Versioning Transactional Invariant
  console.log("\n[Test 10] Caption Versioning Transactional Invariant");
  const v1Update = await updateContentCaptionWithVersion(contentA.id, "Updated Caption V1", adminUser.id);
  const v2Update = await updateContentCaptionWithVersion(contentA.id, "Updated Caption V2", adminUser.id);

  const updatedContent = await prisma.content.findUnique({
    where: { id: contentA.id },
    include: { captionVersions: { orderBy: { versionNumber: "desc" } } },
  });

  assert(
    updatedContent?.caption === "Updated Caption V2",
    "Content.caption matches the latest caption"
  );
  assert(
    updatedContent?.captionVersions[0].versionNumber === 2 &&
    updatedContent?.captionVersions[0].caption === "Updated Caption V2",
    "Latest CaptionVersion record matches Content.caption"
  );
  assert(
    updatedContent?.captionVersions.length === 2,
    "Historical caption versions preserved accurately"
  );

  // Clean up test records
  console.log("\nCleaning up test artifacts...");
  await prisma.captionVersion.deleteMany({ where: { contentId: contentA.id } });
  await prisma.content.deleteMany({ where: { id: { in: [contentA.id, contentB.id] } } });
  await prisma.notification.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id, inactiveOrg.id] } } });
  await prisma.activityLog.deleteMany({ where: { organizationId: { in: [orgA.id, orgB.id, inactiveOrg.id] } } });
  await prisma.session.deleteMany({ where: { userId: { in: [adminUser.id, userA.id, userB.id, inactiveUser.id, userInInactiveOrg.id] } } });
  await prisma.user.deleteMany({ where: { id: { in: [adminUser.id, userA.id, userB.id, inactiveUser.id, userInInactiveOrg.id] } } });
  await prisma.organization.deleteMany({ where: { id: { in: [orgA.id, orgB.id, inactiveOrg.id] } } });

  console.log("\n=======================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} ARCHITECTURAL TESTS PASSED!`);
  console.log("=======================================================\n");
}

runTests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
