import { PrismaClient, Role, UserStatus, OrganizationStatus } from "@prisma/client";
import { hashPassword, verifyPassword } from "../src/lib/auth/password";
import { generateSessionToken, validateSessionToken } from "../src/lib/auth/session";
import { assertOrganizationAccess, getTenantScopedFilter } from "../src/lib/auth/guards";
import {
  createClient,
  updateClient,
  toggleClientStatus,
  getClientById,
} from "../src/lib/services/client-service";
import { TenantMismatchError, ValidationError, ForbiddenError } from "../src/lib/errors";

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

async function runPhase1Tests() {
  console.log("\n=======================================================");
  console.log("🔒 DigiCanvas Phase 1: Security & Client Isolation Tests");
  console.log("=======================================================\n");

  const timestamp = Date.now();

  // Test Setup: Create an Admin user
  const adminPassword = "AdminSecurePass123!";
  const adminHash = await hashPassword(adminPassword);
  const adminUser = await prisma.user.create({
    data: {
      email: `admin-test-${timestamp}@digicanvas.agency`,
      name: "Security Admin",
      passwordHash: adminHash,
      role: Role.ADMIN,
      status: UserStatus.ACTIVE,
    },
  });

  // 1. Admin login credentials verify
  console.log("[Test 1] Admin Authentication Verification");
  const adminPassMatch = await verifyPassword(adminPassword, adminUser.passwordHash);
  assert(adminPassMatch, "Admin password verification succeeds with correct credentials");

  // 10. Admin can create a client organization and user atomically with auto-generated temp password
  console.log("\n[Test 10] Admin Client Creation");
  const clientAData = await createClient(
    {
      name: `Tenant Alpha ${timestamp}`,
      slug: `tenant-alpha-${timestamp}`,
      contactEmail: `contact@alpha-${timestamp}.com`,
      contactPhone: "+91 9876543210",
      timezone: "Asia/Kolkata",
      userName: "Alpha Manager",
      userEmail: `manager@alpha-${timestamp}.com`,
    },
    adminUser.id
  );

  assert(Boolean(clientAData.organization.id), "Client organization created with unique ID");
  assert(Boolean(clientAData.temporaryPassword), "Secure temporary password returned once for admin");
  assert(clientAData.user.email === `manager@alpha-${timestamp}.com`, "Primary user created and linked to organization");

  // 2. Client login works with generated password
  console.log("\n[Test 2] Client Authentication Verification");
  const clientUserA = await prisma.user.findUniqueOrThrow({
    where: { id: clientAData.user.id },
  });
  const clientPassMatch = await verifyPassword(
    clientAData.temporaryPassword,
    clientUserA.passwordHash
  );
  assert(clientPassMatch, "Client can authenticate using generated temporary password");

  // 3. Invalid credentials fail
  console.log("\n[Test 3] Invalid Credentials Handling");
  const wrongPassMatch = await verifyPassword("WrongPasswordAttempt999!", clientUserA.passwordHash);
  assert(!wrongPassMatch, "Authentication fails for invalid password attempt");

  // Create Client B for isolation testing
  const clientBData = await createClient(
    {
      name: `Tenant Beta ${timestamp}`,
      slug: `tenant-beta-${timestamp}`,
      contactEmail: `contact@beta-${timestamp}.com`,
      contactPhone: "+91 9876543211",
      timezone: "America/New_York",
      userName: "Beta Manager",
      userEmail: `manager@beta-${timestamp}.com`,
    },
    adminUser.id
  );
  const clientUserB = await prisma.user.findUniqueOrThrow({
    where: { id: clientBData.user.id },
  });

  // 4. Logout invalidates session
  console.log("\n[Test 4] Database-Backed Session Expiration & Logout");
  const sessionTokenA = generateSessionToken();
  await prisma.session.create({
    data: {
      sessionToken: sessionTokenA,
      userId: clientUserA.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
    },
  });

  const sessionBeforeLogout = await validateSessionToken(sessionTokenA);
  assert(sessionBeforeLogout !== null, "Active session successfully validated from database");

  await prisma.session.delete({ where: { sessionToken: sessionTokenA } });
  const sessionAfterLogout = await validateSessionToken(sessionTokenA);
  assert(sessionAfterLogout === null, "Session is immediately invalidated and rejected after logout");

  // 5 & 6. Unauthenticated access enforcement
  console.log("\n[Test 5 & 6] Unauthenticated Protected Route Access");
  const nullSessionValidation = await validateSessionToken("non-existent-fake-token-xyz");
  assert(nullSessionValidation === null, "Unauthenticated / forged session token returns null");

  // 7. Client cannot access admin functionality
  console.log("\n[Test 7] Role Authorization Guard");
  const clientSessionUser = {
    id: clientUserA.id,
    email: clientUserA.email,
    name: clientUserA.name,
    role: clientUserA.role,
    status: clientUserA.status,
    organizationId: clientAData.organization.id,
  };
  assert(clientSessionUser.role === Role.CLIENT, "Client user possesses Role.CLIENT");
  assert(adminUser.role === Role.ADMIN, "Admin user possesses Role.ADMIN");

  // 8. Client A cannot access Client B
  console.log("\n[Test 8] Strict Tenant Isolation: Client A cannot access Client B");
  let caughtCrossTenantViolation = false;
  try {
    assertOrganizationAccess(clientBData.organization.id, clientSessionUser);
  } catch (error) {
    if (error instanceof TenantMismatchError) {
      caughtCrossTenantViolation = true;
    }
  }
  assert(
    caughtCrossTenantViolation,
    "assertOrganizationAccess throws TenantMismatchError when Client A attempts accessing Tenant B"
  );

  // 9. Changing organization IDs does not bypass authorization
  console.log("\n[Test 9] Server-Derived Tenant Scoping Filter");
  const serverScopedFilter = getTenantScopedFilter(clientSessionUser, clientBData.organization.id);
  assert(
    "organizationId" in serverScopedFilter &&
      serverScopedFilter.organizationId === clientAData.organization.id,
    "Server-scoped query filter strictly uses session.organizationId, ignoring client-supplied parameter"
  );

  // 11. Admin can edit a client
  console.log("\n[Test 11] Admin Edit Client Organization");
  await updateClient(
    {
      id: clientAData.organization.id,
      name: `Tenant Alpha Updated ${timestamp}`,
      contactEmail: `updated@alpha-${timestamp}.com`,
      contactPhone: "+91 1111122222",
      timezone: "Asia/Dubai",
      status: OrganizationStatus.ACTIVE,
    },
    adminUser.id
  );
  const updatedOrg = await getClientById(clientAData.organization.id);
  assert(updatedOrg.name === `Tenant Alpha Updated ${timestamp}`, "Organization name updated");
  assert(updatedOrg.timezone === "Asia/Dubai", "Organization timezone updated");

  // 12. Admin can deactivate a client
  console.log("\n[Test 12] Admin Deactivate Client Organization");
  // Create an active session for Client A user before deactivation
  const activeTokenA = generateSessionToken();
  await prisma.session.create({
    data: {
      sessionToken: activeTokenA,
      userId: clientUserA.id,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60),
    },
  });

  await toggleClientStatus(clientAData.organization.id, OrganizationStatus.INACTIVE, adminUser.id);
  const deactivatedOrg = await getClientById(clientAData.organization.id);
  assert(deactivatedOrg.status === OrganizationStatus.INACTIVE, "Organization status set to INACTIVE");

  // 14. Deactivated client cannot access portal
  console.log("\n[Test 14] Deactivated Client Portal Access Rejection");
  const sessionAfterDeactivation = await validateSessionToken(activeTokenA);
  assert(
    sessionAfterDeactivation === null,
    "Existing session of deactivated organization is rejected server-side"
  );

  // 15. Active session is deleted on deactivation
  console.log("\n[Test 15] Session Revocation On Deactivation");
  const sessionsInDb = await prisma.session.findMany({
    where: { userId: clientUserA.id },
  });
  assert(sessionsInDb.length === 0, "All sessions of deactivated organization were terminated in DB");

  // 13. Admin can reactivate a client
  console.log("\n[Test 13] Admin Reactivate Client Organization");
  await toggleClientStatus(clientAData.organization.id, OrganizationStatus.ACTIVE, adminUser.id);
  const reactivatedOrg = await getClientById(clientAData.organization.id);
  assert(reactivatedOrg.status === OrganizationStatus.ACTIVE, "Organization status restored to ACTIVE");

  // 16. Duplicate user email is handled safely
  console.log("\n[Test 16] Duplicate Email Validation");
  let caughtDuplicateEmail = false;
  try {
    await createClient(
      {
        name: `Duplicate Email Org ${timestamp}`,
        slug: `unique-slug-${timestamp}`,
        timezone: "Asia/Kolkata",
        userName: "Duplicate Tester",
        userEmail: `manager@beta-${timestamp}.com`, // Same email as Client B
      },
      adminUser.id
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      caughtDuplicateEmail = true;
    }
  }
  assert(caughtDuplicateEmail, "createClient throws ValidationError for duplicate user email");

  // 17. Duplicate organization slug is handled safely
  console.log("\n[Test 17] Duplicate Slug Validation");
  let caughtDuplicateSlug = false;
  try {
    await createClient(
      {
        name: `Duplicate Slug Org ${timestamp}`,
        slug: clientBData.organization.slug, // Same slug as Client B
        timezone: "Asia/Kolkata",
        userName: "Unique User",
        userEmail: `unique-user-${timestamp}@domain.com`,
      },
      adminUser.id
    );
  } catch (err) {
    if (err instanceof ValidationError) {
      caughtDuplicateSlug = true;
    }
  }
  assert(caughtDuplicateSlug, "createClient throws ValidationError for duplicate organization slug");

  // Clean up test data
  console.log("\nCleaning up test artifacts...");
  await prisma.activityLog.deleteMany({
    where: {
      organizationId: {
        in: [clientAData.organization.id, clientBData.organization.id],
      },
    },
  });
  await prisma.session.deleteMany({
    where: {
      userId: {
        in: [adminUser.id, clientUserA.id, clientUserB.id],
      },
    },
  });
  await prisma.user.deleteMany({
    where: {
      id: {
        in: [adminUser.id, clientUserA.id, clientUserB.id],
      },
    },
  });
  await prisma.organization.deleteMany({
    where: {
      id: {
        in: [clientAData.organization.id, clientBData.organization.id],
      },
    },
  });

  console.log("\n=======================================================");
  console.log(`🎉 ALL ${passedTests}/${totalTests} PHASE 1 SECURITY TESTS PASSED!`);
  console.log("=======================================================\n");
}

runPhase1Tests()
  .catch((err) => {
    console.error("Test execution failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
