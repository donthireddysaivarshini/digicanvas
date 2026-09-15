"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  ContentDetailModal,
  ContentDetailItem,
} from "@/components/content/content-detail-modal";
import {
  Calendar,
  Clock,
  CalendarDays,
  ArrowRight,
  ExternalLink,
  Layers,
  Sparkles,
} from "lucide-react";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/date-utils";
import { Platform } from "@prisma/client";

interface PortalContentListProps {
  todayContent: ContentDetailItem[];
  upcomingContent: ContentDetailItem[];
  timezone: string;
}

export function PortalContentList({
  todayContent,
  upcomingContent,
  timezone,
}: PortalContentListProps) {
  const router = useRouter();
  const [selectedItem, setSelectedItem] = React.useState<ContentDetailItem | null>(null);

  const platformBadgeColors: Record<Platform, string> = {
    INSTAGRAM: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300",
    FACEBOOK: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300",
    YOUTUBE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300",
    LINKEDIN: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300",
    X: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100",
    THREADS: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300",
  };

  return (
    <>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column (2 spans): Today's Content + Upcoming */}
        <div className="lg:col-span-2 space-y-6">
          {/* Today's Content Card */}
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  Today's Scheduled Content
                </CardTitle>
                <CardDescription className="text-xs">
                  Creatives and posts scheduled for publication today.
                </CardDescription>
              </div>
              <Badge variant="outline" className="text-xs font-mono">
                {todayContent.length} {todayContent.length === 1 ? "item" : "items"}
              </Badge>
            </CardHeader>

            <CardContent>
              {todayContent.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                  No content is scheduled for publication today.
                </div>
              ) : (
                <div className="space-y-3">
                  {todayContent.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70 hover:bg-zinc-100/80 dark:hover:bg-zinc-800/80 cursor-pointer transition space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px] uppercase font-mono">
                            {item.contentType}
                          </Badge>
                          <span className="font-semibold text-sm text-zinc-900 dark:text-zinc-100">
                            {item.title}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-zinc-800 dark:text-zinc-200 flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{formatTimeInTimezone(item.scheduledAt, timezone)}</span>
                        </div>
                      </div>

                      {item.caption && (
                        <p className="text-xs text-zinc-500 line-clamp-2">{item.caption}</p>
                      )}

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex flex-wrap gap-1">
                          {item.platforms.map((p) => (
                            <span
                              key={p.platform}
                              className={`px-2 py-0.5 rounded text-[10px] font-medium border ${platformBadgeColors[p.platform]}`}
                            >
                              {p.platform}
                            </span>
                          ))}
                        </div>

                        <span className="text-xs font-medium text-zinc-500 hover:text-zinc-900 flex items-center gap-1">
                          <span>View Details</span>
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Content Section */}
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <CalendarDays className="h-4 w-4 text-zinc-500" />
                  Upcoming Content Schedule
                </CardTitle>
                <CardDescription className="text-xs">
                  Next scheduled posts and creatives.
                </CardDescription>
              </div>
              <Link href="/portal/calendar">
                <Button variant="ghost" size="sm" className="text-xs h-8 text-zinc-600">
                  <span>Full Calendar</span>
                  <ArrowRight className="h-3.5 w-3.5 ml-1" />
                </Button>
              </Link>
            </CardHeader>

            <CardContent>
              {upcomingContent.length === 0 ? (
                <div className="p-6 text-center text-xs text-zinc-400 bg-zinc-50 dark:bg-zinc-950/60 rounded-lg border border-dashed border-zinc-200 dark:border-zinc-800">
                  No upcoming content scheduled in the queue.
                </div>
              ) : (
                <div className="space-y-2.5">
                  {upcomingContent.map((item) => (
                    <div
                      key={item.id}
                      onClick={() => setSelectedItem(item)}
                      className="p-3 rounded-lg border border-zinc-200/80 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-zinc-800/60 cursor-pointer transition flex items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] uppercase font-mono px-1.5 py-0">
                            {item.contentType}
                          </Badge>
                          <span className="font-semibold text-zinc-900 dark:text-zinc-100 truncate">
                            {item.title}
                          </span>
                        </div>
                        <div className="flex flex-wrap gap-1">
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

                      <div className="text-right shrink-0 space-y-0.5">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {formatDateInTimezone(item.scheduledAt, timezone)}
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {formatTimeInTimezone(item.scheduledAt, timezone)}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column (1 span): Calendar Quick Action & Info */}
        <div className="space-y-6">
          <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
                Interactive Calendar
              </CardTitle>
              <CardDescription className="text-xs">
                Explore the complete content plan across Month, Week, Day, and Custom Date Ranges.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="p-4 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 space-y-2">
                <div className="flex items-center gap-2 font-medium text-zinc-900 dark:text-zinc-100">
                  <Calendar className="h-4 w-4 text-zinc-500" />
                  <span>Configured Timezone: {timezone}</span>
                </div>
                <p>
                  All scheduled publication times and calendar views reflect your organization's local timezone.
                </p>
              </div>

              <Link href="/portal/calendar" className="block">
                <Button className="w-full text-xs flex items-center justify-center gap-2">
                  <span>Open Full Content Calendar</span>
                  <ExternalLink className="h-3.5 w-3.5" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Content Detail Modal */}
      <ContentDetailModal
        content={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        isAdmin={false}
        onUpdate={() => {
          router.refresh();
        }}
      />
    </>
  );
}
