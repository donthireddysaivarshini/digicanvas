import { redirect } from "next/navigation";
import { getCurrentSession, AuthenticatedSession, AuthenticatedUser } from "./session";
import { Role } from "@prisma/client";
import { UnauthorizedError, ForbiddenError, TenantMismatchError } from "@/lib/errors";

/**
 * Requires a valid authenticated session.
 * For Server Components / Actions: redirects to /login if unauthenticated.
 */
export async function requireAuth(shouldRedirect: boolean = true): Promise<AuthenticatedSession> {
  const session = await getCurrentSession();

  if (!session) {
    if (shouldRedirect) {
      redirect("/login");
    }
    throw new UnauthorizedError("Authentication required to access this resource.");
  }

  return session;
}

/**
 * Requires the authenticated user to be an ADMIN or SUPER_ADMIN.
 * Redirects or throws ForbiddenError if the user is a CLIENT.
 */
export async function requireAdmin(shouldRedirect: boolean = true): Promise<AuthenticatedSession> {
  const session = await requireAuth(shouldRedirect);

  if (session.user.role !== Role.ADMIN && session.user.role !== Role.SUPER_ADMIN) {
    if (shouldRedirect) {
      redirect("/portal");
    }
    throw new ForbiddenError("Admin privileges required to perform this action.");
  }

  return session;
}

/**
 * Requires the authenticated user to be a CLIENT with an active organization.
 */
export async function requireClient(shouldRedirect: boolean = true): Promise<AuthenticatedSession> {
  const session = await requireAuth(shouldRedirect);

  if (session.user.role !== Role.CLIENT) {
    if (shouldRedirect) {
      redirect("/admin");
    }
    throw new ForbiddenError("Client portal access required.");
  }

  if (!session.user.organizationId || !session.user.organization) {
    throw new ForbiddenError("User is not associated with an active organization.");
  }

  return session;
}

/**
 * Enforces Tenant Isolation on the Server Layer.
 * If the user is an ADMIN or SUPER_ADMIN, they have cross-tenant access.
 * If the user is a CLIENT, they are STRICTLY RESTRICTED to their own organizationId.
 * 
 * Throws TenantMismatchError if a client attempts to access a different organization's resource.
 */
export function assertOrganizationAccess(
  requestedOrganizationId: string,
  user: AuthenticatedUser
): void {
  if (!requestedOrganizationId) {
    throw new TenantMismatchError("Organization ID must be provided.");
  }

  // Admins can access all organizations
  if (user.role === Role.ADMIN || user.role === Role.SUPER_ADMIN) {
    return;
  }

  // Clients can ONLY access their own organization
  if (user.role === Role.CLIENT) {
    if (!user.organizationId || user.organizationId !== requestedOrganizationId) {
      throw new TenantMismatchError(
        `Cross-tenant access violation: User belonging to organization ${user.organizationId} attempted to access organization ${requestedOrganizationId}.`
      );
    }
  }
}

/**
 * Helper to build tenant-scoped Prisma query filters.
 * Ensures client users NEVER query records outside their own organization.
 */
export function getTenantScopedFilter(
  user: AuthenticatedUser,
  adminSelectedOrgId?: string
): { organizationId: string } | {} {
  if (user.role === Role.CLIENT) {
    if (!user.organizationId) {
      throw new TenantMismatchError("Client user lacks organization association.");
    }
    return { organizationId: user.organizationId };
  }

  // Admin query scoping
  if (adminSelectedOrgId) {
    return { organizationId: adminSelectedOrgId };
  }

  return {};
}
