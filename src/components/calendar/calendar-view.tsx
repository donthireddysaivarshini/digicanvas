"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContentDetailModal,
  ContentDetailItem,
} from "@/components/content/content-detail-modal";
import {
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Clock,
  Building2,
  CalendarDays,
  CalendarRange,
} from "lucide-react";
import {
  getDateStringInTimezone,
  formatDateInTimezone,
  formatTimeInTimezone,
} from "@/lib/date-utils";
import { Platform, ContentType } from "@prisma/client";

export type CalendarViewMode = "month" | "week" | "day" | "custom";

interface CalendarViewProps {
  contents: ContentDetailItem[];
  timezone?: string;
  isAdmin?: boolean;
  initialView?: CalendarViewMode;
  initialDate?: string; // YYYY-MM-DD
  initialStartDate?: string;
  initialEndDate?: string;
}

export function CalendarView({
  contents,
  timezone = "Asia/Kolkata",
  isAdmin = false,
  initialView = "month",
  initialDate,
  initialStartDate,
  initialEndDate,
}: CalendarViewProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Active view mode
  const currentView = (searchParams.get("view") as CalendarViewMode) || initialView;

  // Selected date anchor
  const activeDateStr = searchParams.get("date") || initialDate || getDateStringInTimezone(new Date(), timezone);
  const activeDate = new Date(`${activeDateStr}T12:00:00Z`);

  // Custom range bounds
  const [customFrom, setCustomFrom] = React.useState(
    searchParams.get("startDate") || initialStartDate || activeDateStr
  );
  const [customTo, setCustomTo] = React.useState(
    searchParams.get("endDate") || initialEndDate || activeDateStr
  );

  // Selected item for detail modal
  const [selectedItem, setSelectedItem] = React.useState<ContentDetailItem | null>(null);

  // Update URL search parameters
  const updateUrlParams = (newParams: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(newParams)) {
      if (value === null) params.delete(key);
      else params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  const setViewMode = (mode: CalendarViewMode) => {
    if (mode === "custom") {
      updateUrlParams({
        view: mode,
        startDate: customFrom,
        endDate: customTo,
        date: null,
      });
    } else {
      updateUrlParams({
        view: mode,
        date: activeDateStr,
        startDate: null,
        endDate: null,
      });
    }
  };

  // Period navigation
  const handlePrev = () => {
    const d = new Date(activeDate);
    if (currentView === "month") {
      d.setUTCMonth(d.getUTCMonth() - 1);
    } else if (currentView === "week") {
      d.setUTCDate(d.getUTCDate() - 7);
    } else if (currentView === "day") {
      d.setUTCDate(d.getUTCDate() - 1);
    }
    const newDateStr = d.toISOString().split("T")[0];
    updateUrlParams({ date: newDateStr });
  };

  const handleNext = () => {
    const d = new Date(activeDate);
    if (currentView === "month") {
      d.setUTCMonth(d.getUTCMonth() + 1);
    } else if (currentView === "week") {
      d.setUTCDate(d.getUTCDate() + 7);
    } else if (currentView === "day") {
      d.setUTCDate(d.getUTCDate() + 1);
    }
    const newDateStr = d.toISOString().split("T")[0];
    updateUrlParams({ date: newDateStr });
  };

  const handleToday = () => {
    const todayStr = getDateStringInTimezone(new Date(), timezone);
    updateUrlParams({ date: todayStr });
  };

  const handleApplyCustomRange = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customFrom || !customTo) return;
    updateUrlParams({
      view: "custom",
      startDate: customFrom,
      endDate: customTo,
      date: null,
    });
  };

  // Group content items by their local date in organization timezone
  const contentByDate = React.useMemo(() => {
    const map = new Map<string, ContentDetailItem[]>();
    for (const item of contents) {
      const itemDateStr = getDateStringInTimezone(item.scheduledAt, timezone);
      if (!map.has(itemDateStr)) {
        map.set(itemDateStr, []);
      }
      map.get(itemDateStr)!.push(item);
    }
    return map;
  }, [contents, timezone]);

  const platformBadgeColors: Record<Platform, string> = {
    INSTAGRAM: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300",
    FACEBOOK: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    YOUTUBE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
    LINKEDIN: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
    X: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100",
    THREADS: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
  };

  // Compute month title and days
  const year = activeDate.getUTCFullYear();
  const month = activeDate.getUTCMonth(); // 0-indexed

  const monthName = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, month, 1))
  );

  // Month Grid Calculation
  const firstDayOfMonth = new Date(Date.UTC(year, month, 1));
  const startDayOfWeek = firstDayOfMonth.getUTCDay(); // 0 = Sun
  const daysInMonth = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();

  const monthCalendarDays = [];
  // Trailing previous month days
  const prevMonthDaysCount = new Date(Date.UTC(year, month, 0)).getUTCDate();
  for (let i = startDayOfWeek - 1; i >= 0; i--) {
    const d = prevMonthDaysCount - i;
    const prevDate = new Date(Date.UTC(year, month - 1, d));
    monthCalendarDays.push({
      dateStr: prevDate.toISOString().split("T")[0],
      dayNum: d,
      isCurrentMonth: false,
    });
  }
  // Current month days
  for (let d = 1; d <= daysInMonth; d++) {
    const curDate = new Date(Date.UTC(year, month, d));
    monthCalendarDays.push({
      dateStr: curDate.toISOString().split("T")[0],
      dayNum: d,
      isCurrentMonth: true,
    });
  }
  // Trailing next month days to complete 35 or 42 grid cells
  const remainingCells = (7 - (monthCalendarDays.length % 7)) % 7;
  for (let d = 1; d <= remainingCells; d++) {
    const nextDate = new Date(Date.UTC(year, month + 1, d));
    monthCalendarDays.push({
      dateStr: nextDate.toISOString().split("T")[0],
      dayNum: d,
      isCurrentMonth: false,
    });
  }

  // Week View Days Calculation (7 days anchored around activeDate)
  const currentDayOfWeek = activeDate.getUTCDay();
  const weekStart = new Date(activeDate);
  weekStart.setUTCDate(activeDate.getUTCDate() - currentDayOfWeek);

  const weekDays = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(weekStart);
    d.setUTCDate(weekStart.getUTCDate() + i);
    weekDays.push({
      dateStr: d.toISOString().split("T")[0],
      dayName: new Intl.DateTimeFormat("en-US", { weekday: "short", timeZone: "UTC" }).format(d),
      dateFormatted: new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" }).format(d),
    });
  }

  const todayStr = getDateStringInTimezone(new Date(), timezone);

  return (
    <div className="space-y-4">
      {/* Calendar Top Navigation Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm">
        {/* Navigation & Title */}
        <div className="flex items-center gap-3">
          {currentView !== "custom" ? (
            <>
              <div className="flex items-center rounded-md border border-zinc-200 dark:border-zinc-800">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handlePrev}
                  className="h-8 w-8 rounded-r-none border-r border-zinc-200 dark:border-zinc-800"
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={handleNext}
                  className="h-8 w-8 rounded-l-none"
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleToday}
                className="h-8 text-xs font-medium"
              >
                Today
              </Button>

              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100 ml-1">
                {currentView === "month" && monthName}
                {currentView === "week" && `${weekDays[0].dateFormatted} – ${weekDays[6].dateFormatted}, ${year}`}
                {currentView === "day" && formatDateInTimezone(activeDate, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
              </h2>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <CalendarRange className="h-4 w-4 text-zinc-500" />
              <h2 className="text-sm font-bold text-zinc-900 dark:text-zinc-100">
                Custom Date Range:{" "}
                <span className="font-mono text-xs font-normal text-zinc-600 dark:text-zinc-400">
                  {searchParams.get("startDate") || customFrom} → {searchParams.get("endDate") || customTo}
                </span>
              </h2>
            </div>
          )}
        </div>

        {/* View Mode Switcher */}
        <div className="flex items-center gap-1.5 self-start md:self-auto bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg">
          <button
            type="button"
            onClick={() => setViewMode("month")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              currentView === "month"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            Month
          </button>
          <button
            type="button"
            onClick={() => setViewMode("week")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              currentView === "week"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            Week
          </button>
          <button
            type="button"
            onClick={() => setViewMode("day")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              currentView === "day"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            Day
          </button>
          <button
            type="button"
            onClick={() => setViewMode("custom")}
            className={`px-3 py-1 text-xs font-medium rounded-md transition ${
              currentView === "custom"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-950 dark:text-zinc-100 font-semibold"
                : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900"
            }`}
          >
            Custom Range
          </button>
        </div>
      </div>

      {/* Custom Date Range Picker Bar (visible only in custom mode) */}
      {currentView === "custom" && (
        <form
          onSubmit={handleApplyCustomRange}
          className="p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-xs"
        >
          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">From Date:</span>
            <input
              type="date"
              value={customFrom}
              onChange={(e) => setCustomFrom(e.target.value)}
              required
              className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="font-medium text-zinc-700 dark:text-zinc-300">To Date:</span>
            <input
              type="date"
              value={customTo}
              onChange={(e) => setCustomTo(e.target.value)}
              required
              className="h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
            />
          </div>

          <Button type="submit" size="sm" className="h-8 text-xs px-3">
            Apply Range
          </Button>
        </form>
      )}

      {/* ========================================================= */}
      {/* 1. MONTH VIEW */}
      {/* ========================================================= */}
      {currentView === "month" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          {/* Day of Week Headers */}
          <div className="grid grid-cols-7 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950 text-center text-xs font-semibold uppercase tracking-wider text-zinc-500 py-2.5">
            <div>Sun</div>
            <div>Mon</div>
            <div>Tue</div>
            <div>Wed</div>
            <div>Thu</div>
            <div>Fri</div>
            <div>Sat</div>
          </div>

          {/* Calendar Day Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-zinc-200 dark:divide-zinc-800">
            {monthCalendarDays.map((day, idx) => {
              const dayItems = contentByDate.get(day.dateStr) || [];
              const isToday = day.dateStr === todayStr;

              return (
                <div
                  key={`${day.dateStr}-${idx}`}
                  onClick={() => {
                    updateUrlParams({ view: "day", date: day.dateStr });
                  }}
                  className={`min-h-[110px] p-2 flex flex-col justify-between cursor-pointer transition hover:bg-zinc-50/70 dark:hover:bg-zinc-800/30 ${
                    !day.isCurrentMonth
                      ? "bg-zinc-50/40 text-zinc-400 dark:bg-zinc-950/40 dark:text-zinc-600"
                      : "bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-xs font-semibold h-6 w-6 rounded-full flex items-center justify-center ${
                        isToday
                          ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
                          : ""
                      }`}
                    >
                      {day.dayNum}
                    </span>
                    {dayItems.length > 0 && (
                      <span className="text-[10px] text-zinc-400 font-mono">
                        {dayItems.length} {dayItems.length === 1 ? "item" : "items"}
                      </span>
                    )}
                  </div>

                  {/* Day Content Badges */}
                  <div className="space-y-1 my-1 flex-1">
                    {dayItems.slice(0, 3).map((item) => (
                      <div
                        key={item.id}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="p-1 rounded text-[11px] bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition border border-zinc-200/60 dark:border-zinc-700/60 truncate"
                      >
                        <span className="font-semibold mr-1">
                          [{item.platforms[0]?.platform || item.contentType}]
                        </span>
                        <span className="truncate">{item.title}</span>
                      </div>
                    ))}

                    {dayItems.length > 3 && (
                      <div className="text-[10px] font-semibold text-zinc-500 hover:underline">
                        +{dayItems.length - 3} more...
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 2. WEEK VIEW */}
      {/* ========================================================= */}
      {currentView === "week" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-sm">
          <div className="grid grid-cols-1 sm:grid-cols-7 divide-y sm:divide-y-0 sm:divide-x divide-zinc-200 dark:divide-zinc-800">
            {weekDays.map((day) => {
              const dayItems = contentByDate.get(day.dateStr) || [];
              const isToday = day.dateStr === todayStr;

              return (
                <div key={day.dateStr} className="min-h-[300px] flex flex-col">
                  <div
                    className={`p-3 text-center border-b border-zinc-200 dark:border-zinc-800 ${
                      isToday ? "bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900" : "bg-zinc-50 dark:bg-zinc-950"
                    }`}
                  >
                    <div className="text-[11px] font-semibold uppercase tracking-wider opacity-80">
                      {day.dayName}
                    </div>
                    <div className="text-sm font-bold">{day.dateFormatted}</div>
                  </div>

                  <div className="p-2 space-y-2 flex-1 overflow-y-auto">
                    {dayItems.length === 0 ? (
                      <div className="text-[11px] text-zinc-400 text-center py-6">
                        No content
                      </div>
                    ) : (
                      dayItems.map((item) => (
                        <div
                          key={item.id}
                          onClick={() => setSelectedItem(item)}
                          className="p-2.5 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition space-y-1.5 shadow-sm"
                        >
                          <div className="flex items-center justify-between text-[10px]">
                            <Badge variant="outline" className="text-[9px] px-1 py-0 uppercase font-mono">
                              {item.contentType}
                            </Badge>
                            <span className="text-zinc-500 font-medium">
                              {formatTimeInTimezone(item.scheduledAt, timezone)}
                            </span>
                          </div>

                          <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                            {item.title}
                          </div>

                          <div className="flex flex-wrap gap-1 pt-1">
                            {item.platforms.map((p) => (
                              <span
                                key={p.platform}
                                className={`px-1.5 py-0.2 rounded text-[9px] font-medium border ${platformBadgeColors[p.platform]}`}
                              >
                                {p.platform}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* 3. DAY VIEW */}
      {/* ========================================================= */}
      {currentView === "day" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-4">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
              <CalendarDays className="h-4 w-4 text-zinc-500" />
              <span>Schedule for {formatDateInTimezone(activeDate, timezone, { weekday: "long", month: "long", day: "numeric", year: "numeric" })}</span>
            </h3>
            <span className="text-xs text-zinc-400">
              {(contentByDate.get(activeDateStr) || []).length} scheduled items
            </span>
          </div>

          {(contentByDate.get(activeDateStr) || []).length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs">
              No content items scheduled for this day.
            </div>
          ) : (
            <div className="space-y-3">
              {(contentByDate.get(activeDateStr) || []).map((item) => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                        {item.title}
                      </span>
                      <Badge variant="outline" className="text-[10px] uppercase font-mono">
                        {item.contentType}
                      </Badge>
                      {item.organization && (
                        <span className="text-xs text-zinc-500 flex items-center gap-1">
                          <Building2 className="h-3 w-3" />
                          {item.organization.name}
                        </span>
                      )}
                    </div>

                    {item.caption && (
                      <p className="text-xs text-zinc-500 line-clamp-1">{item.caption}</p>
                    )}

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {item.platforms.map((p) => (
                        <span
                          key={p.platform}
                          className={`px-2 py-0.5 rounded text-[10px] font-medium border ${platformBadgeColors[p.platform]}`}
                        >
                          {p.platform}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="text-right sm:border-l sm:border-zinc-200 dark:sm:border-zinc-800 sm:pl-4 space-y-1 shrink-0">
                    <div className="text-xs font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-1 justify-end">
                      <Clock className="h-3.5 w-3.5 text-zinc-400" />
                      <span>{formatTimeInTimezone(item.scheduledAt, timezone)}</span>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      {item.publishingStatus}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* 4. CUSTOM DATE RANGE VIEW */}
      {/* ========================================================= */}
      {currentView === "custom" && (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 shadow-sm space-y-6">
          <div className="border-b border-zinc-200 dark:border-zinc-800 pb-3 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Scheduled Content in Range
              </h3>
              <p className="text-xs text-zinc-400 mt-0.5">
                Displaying all content between {searchParams.get("startDate") || customFrom} and {searchParams.get("endDate") || customTo}
              </p>
            </div>
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {contents.length} total {contents.length === 1 ? "item" : "items"}
            </span>
          </div>

          {contents.length === 0 ? (
            <div className="text-center py-12 text-zinc-400 text-xs">
              No content found in the specified custom date range.
            </div>
          ) : (
            <div className="space-y-3">
              {contents.map((item) => {
                const itemDateFormatted = formatDateInTimezone(item.scheduledAt, timezone);
                const itemTimeFormatted = formatTimeInTimezone(item.scheduledAt, timezone);

                return (
                  <div
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/60 dark:bg-zinc-950/60 hover:bg-zinc-100 dark:hover:bg-zinc-800/80 cursor-pointer transition flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                          {item.title}
                        </span>
                        <Badge variant="outline" className="text-[10px] uppercase font-mono">
                          {item.contentType}
                        </Badge>
                        {item.organization && (
                          <span className="text-xs text-zinc-500 flex items-center gap-1">
                            <Building2 className="h-3 w-3" />
                            {item.organization.name}
                          </span>
                        )}
                      </div>

                      {item.caption && (
                        <p className="text-xs text-zinc-500 line-clamp-1">{item.caption}</p>
                      )}

                      <div className="flex flex-wrap gap-1.5 pt-1">
                        {item.platforms.map((p) => (
                          <span
                            key={p.platform}
                            className={`px-2 py-0.5 rounded text-[10px] font-medium border ${platformBadgeColors[p.platform]}`}
                          >
                            {p.platform}
                          </span>
                        ))}
                      </div>
                    </div>

                    <div className="text-right sm:border-l sm:border-zinc-200 dark:sm:border-zinc-800 sm:pl-4 space-y-1 shrink-0">
                      <div className="text-xs font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1 justify-end">
                        <CalendarIcon className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{itemDateFormatted}</span>
                      </div>
                      <div className="text-xs text-zinc-500 flex items-center gap-1 justify-end">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        <span>{itemTimeFormatted}</span>
                      </div>
                      <Badge variant="secondary" className="text-[10px]">
                        {item.publishingStatus}
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Content Detail Modal */}
      <ContentDetailModal
        content={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        isAdmin={isAdmin}
        onUpdate={() => {
          router.refresh();
        }}
      />
    </div>
  );
}
