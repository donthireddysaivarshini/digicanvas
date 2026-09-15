import * as React from "react";
import Link from "next/link";
import { requireClient } from "@/lib/auth/guards";
import { getCalendarContent } from "@/lib/services/content-service";
import { CalendarView, CalendarViewMode } from "@/components/calendar/calendar-view";
import { Button } from "@/components/ui/button";
import { ChevronLeft } from "lucide-react";
import { getDateStringInTimezone } from "@/lib/date-utils";

interface ClientCalendarPageProps {
  searchParams: {
    view?: CalendarViewMode;
    date?: string;
    startDate?: string;
    endDate?: string;
  };
}

export default async function ClientCalendarPage({ searchParams }: ClientCalendarPageProps) {
  const session = await requireClient();
  const organization = session.user.organization!;
  const timezone = organization.timezone || "Asia/Kolkata";

  const currentView = searchParams.view || "month";
  const activeDateStr = searchParams.date || getDateStringInTimezone(new Date(), timezone);
  const anchorDate = new Date(`${activeDateStr}T12:00:00Z`);

  let startDateStr = "";
  let endDateStr = "";

  if (currentView === "custom") {
    startDateStr = searchParams.startDate || activeDateStr;
    endDateStr = searchParams.endDate || activeDateStr;
  } else if (currentView === "month") {
    const year = anchorDate.getUTCFullYear();
    const month = anchorDate.getUTCMonth();
    const firstDay = new Date(Date.UTC(year, month, 1));
    const startDayOfWeek = firstDay.getUTCDay();
    const prevMonthDays = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const startCalendarDay = prevMonthDays - startDayOfWeek + 1;
    const startCalDate = new Date(Date.UTC(year, month - 1, startCalendarDay <= prevMonthDays ? startCalendarDay : 1));

    const endCalDate = new Date(Date.UTC(year, month + 1, 14));
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

  // Pure server-side tenant scoping
  const contents = await getCalendarContent(
    {
      startDate: startDateStr,
      endDate: endDateStr,
      organizationId: session.user.organizationId,
    },
    session.user
  );

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Link
          href="/portal"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Overview
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Content Calendar
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Review your scheduled posts, reels, and publication dates for {organization.name}.
        </p>
      </div>

      <CalendarView
        contents={contents}
        isAdmin={false}
        timezone={timezone}
        initialView={currentView}
        initialDate={activeDateStr}
        initialStartDate={startDateStr}
        initialEndDate={endDateStr}
      />
    </div>
  );
}
