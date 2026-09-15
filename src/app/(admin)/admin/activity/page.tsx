import * as React from "react";
import { requireAdmin } from "@/lib/auth/guards";
import { listActivityLogs } from "@/lib/services/activity-service";
import { listClients } from "@/lib/services/client-service";
import { ActivityLogTable } from "./activity-log-table";

interface ActivityPageProps {
  searchParams: {
    organizationId?: string;
    action?: string;
    entityType?: string;
    startDate?: string;
    endDate?: string;
    page?: string;
    limit?: string;
  };
}

export default async function AdminActivityPage({ searchParams }: ActivityPageProps) {
  const session = await requireAdmin();

  // Load clients for filter dropdown
  const clients = await listClients();

  // Load filtered paginated activity logs
  const activityData = await listActivityLogs(session.user, {
    organizationId: searchParams.organizationId,
    action: searchParams.action,
    entityType: searchParams.entityType,
    startDate: searchParams.startDate,
    endDate: searchParams.endDate,
    page: searchParams.page ? Number(searchParams.page) : 1,
    limit: searchParams.limit ? Number(searchParams.limit) : 25,
  });

  return (
    <ActivityLogTable
      initialData={activityData}
      clients={clients.map((c) => ({ id: c.id, name: c.name }))}
    />
  );
}
