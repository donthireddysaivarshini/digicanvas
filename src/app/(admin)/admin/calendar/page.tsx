import * as React from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { listClients } from "@/lib/services/client-service";
import { getCalendarContent } from "@/lib/services/content-service";
import { CalendarView, CalendarViewMode } from "@/components/calendar/calendar-view";
import { AdminCalendarFilters } from "@/components/calendar/admin-calendar-filters";
import { Button } from "@/components/ui/button";
import { Plus, ListFilter } from "lucide-react";
import { Platform, ContentType, ApprovalStatus, PublishingStatus } from "@prisma/client";
import { getDateStringInTimezone } from "@/lib/date-utils";

interface AdminCalendarPageProps {
  searchParams: {
    view?: CalendarViewMode;
    date?: string;
    startDate?: string;
    endDate?: string;
    organizationId?: string;
    platform?: Platform;
    contentType?: ContentType;
    approvalStatus?: ApprovalStatus;
    publishingStatus?: PublishingStatus;
  };
}

export default async function AdminCalendarPage({ searchParams }: AdminCalendarPageProps) {
  const session = await requireAdmin();
  const clients = await listClients();

  const currentView = searchParams.view || "month";
  const activeDateStr = searchParams.date || getDateStringInTimezone(new Date(), "Asia/Kolkata");
  const anchorDate = new Date(`${activeDateStr}T12:00:00Z`);

  let startDateStr = "";
  let endDateStr = "";

  if (currentView === "custom") {
    startDateStr = searchParams.startDate || activeDateStr;
    endDateStr = searchParams.endDate || activeDateStr;
  } else if (currentView === "month") {
    const year = anchorDate.getUTCFullYear();
    const month = anchorDate.getUTCMonth();
    // Expand boundary to cover previous/next trailing grid days (35-42 days)
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startDayOfWeek = firstDay.getUTCDay();
    const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startCalendarDay = prevMonthDays - startDayOfWeek + 1;
    const startCalDate = new Date(Date.UTC(year, month - 1, startCalendarDay <= prevMonthDays ? startCalendarDay : 1));

    const endCalDate = new Date(Date.UTC(year, month + 1, 14)); // 2 weeks trailing
    startDateStr = startCalDate.toISOString().split("T")[0];
    endDateStr = endCalDate.toISOString().split("T")[0];
  } else if (currentView === "week") {
    const dayOfWeek = anchorDate.getUTCDay();
    const weekStart = new Date(anchorDate);
    weekStart.setUTCDate(anchorDate.getUTCDate() - dayOfWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setUTCDate(weekStart.getUTCDate() + 6);
    startDateStr = weekStart.toISOString().split("T")[0];
    endDateStr = weekEnd.toISOString().split("T")[0];
  } else {
    // Day view
    startDateStr = activeDateStr;
    endDateStr = activeDateStr;
  }

  const contents = await getCalendarContent(
    {
      startDate: startDateStr,
      endDate: endDateStr,
      organizationId: searchParams.organizationId || null,
      platform: searchParams.platform || null,
      contentType: searchParams.contentType || null,
      approvalStatus: searchParams.approvalStatus || null,
      publishingStatus: searchParams.publishingStatus || null,
    },
    session.user
  );

  return (
    <div className="max-w-7xl space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Agency Content Calendar
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Dynamic calendar schedule across all client organizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/content">
            <Button variant="outline" size="sm" className="text-xs flex items-center gap-1.5">
              <ListFilter className="h-4 w-4" />
              <span>Table View</span>
            </Button>
          </Link>

          <Link href="/admin/content/new">
            <Button size="sm" className="text-xs flex items-center gap-1.5">
              <Plus className="h-4 w-4" />
              <span>Schedule Content</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Admin Multi-Filter Bar */}
      <AdminCalendarFilters organizations={clients} />

      {/* Calendar Component */}
      <CalendarView
        contents={contents}
        isAdmin={true}
        timezone="Asia/Kolkata"
        initialView={currentView}
        initialDate={activeDateStr}
        initialStartDate={startDateStr}
        initialEndDate={endDateStr}
      />
    </div>
  );
}
