"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ContentDetailModal,
  ContentDetailItem,
} from "@/components/content/content-detail-modal";
import {
  Calendar,
  Clock,
  Edit3,
  Archive,
  ExternalLink,
  Eye,
  Building2,
} from "lucide-react";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/date-utils";
import { archiveContentAction } from "./actions";
import { Platform } from "@prisma/client";

interface ContentTableProps {
  contents: ContentDetailItem[];
}

export function ContentTable({ contents }: ContentTableProps) {
  const [selectedItem, setSelectedItem] = React.useState<ContentDetailItem | null>(null);
  const [isArchiving, startArchiving] = React.useTransition();

  const handleArchive = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (
      !window.confirm(
        `Are you sure you want to archive "${title}"?\n\nIt will be removed from active views but its historical records will remain preserved.`
      )
    ) {
      return;
    }

    startArchiving(async () => {
      const formData = new FormData();
      formData.set("contentId", id);
      await archiveContentAction(formData);
    });
  };

  const platformBadgeColors: Record<Platform, string> = {
    INSTAGRAM: "bg-pink-50 text-pink-700 border-pink-200 dark:bg-pink-950/40 dark:text-pink-300 dark:border-pink-900",
    FACEBOOK: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900",
    YOUTUBE: "bg-red-50 text-red-700 border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-900",
    LINKEDIN: "bg-sky-50 text-sky-700 border-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:border-sky-900",
    X: "bg-zinc-100 text-zinc-900 border-zinc-300 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700",
    THREADS: "bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-900",
  };

  return (
    <>
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-medium">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Content / Topic</th>
                <th className="py-3.5 px-4 font-semibold">Client</th>
                <th className="py-3.5 px-4 font-semibold">Type & Platforms</th>
                <th className="py-3.5 px-4 font-semibold">Scheduled Date/Time</th>
                <th className="py-3.5 px-4 font-semibold">Status</th>
                <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {contents.map((item) => {
                const tz = item.organization?.timezone || "Asia/Kolkata";
                const dateStr = formatDateInTimezone(item.scheduledAt, tz);
                const timeStr = formatTimeInTimezone(item.scheduledAt, tz);

                return (
                  <tr
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className="hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition"
                  >
                    {/* Title / Topic */}
                    <td className="py-4 px-4 align-top max-w-xs">
                      <div className="font-semibold text-zinc-900 dark:text-zinc-100 line-clamp-2">
                        {item.title}
                      </div>
                      {item.caption && (
                        <div className="text-xs text-zinc-400 line-clamp-1 mt-0.5">
                          {item.caption}
                        </div>
                      )}
                    </td>

                    {/* Client */}
                    <td className="py-4 px-4 align-top text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="font-medium text-zinc-900 dark:text-zinc-200 flex items-center gap-1.5">
                        <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{item.organization?.name}</span>
                      </div>
                    </td>

                    {/* Type & Platforms */}
                    <td className="py-4 px-4 align-top">
                      <div className="space-y-1">
                        <Badge variant="outline" className="font-mono text-[10px]">
                          {item.contentType}
                        </Badge>
                        <div className="flex flex-wrap gap-1">
                          {item.platforms.map((p) => (
                            <span
                              key={p.platform}
                              className={`inline-block px-1.5 py-0.2 text-[10px] rounded border font-medium ${platformBadgeColors[p.platform]}`}
                            >
                              {p.platform}
                            </span>
                          ))}
                        </div>
                      </div>
                    </td>

                    {/* Scheduled Time */}
                    <td className="py-4 px-4 align-top text-xs text-zinc-600 dark:text-zinc-400">
                      <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                        <span>{dateStr}</span>
                      </div>
                      <div className="text-zinc-400 flex items-center gap-1 mt-0.5">
                        <Clock className="h-3 w-3 text-zinc-400" />
                        <span>{timeStr}</span>
                      </div>
                    </td>

                    {/* Status */}
                    <td className="py-4 px-4 align-top text-xs">
                      <div className="space-y-1">
                        <Badge variant="secondary" className="text-[10px] block w-fit font-mono">
                          {item.publishingStatus}
                        </Badge>
                        <span
                          className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold border ${
                            item.approvalStatus === "APPROVED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : item.approvalStatus === "CHANGES_REQUESTED"
                              ? "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                              : item.approvalStatus === "AWAITING_APPROVAL"
                              ? "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300"
                          }`}
                        >
                          {item.approvalStatus === "APPROVED" && "✓ Approved"}
                          {item.approvalStatus === "CHANGES_REQUESTED" && "! Changes Req."}
                          {item.approvalStatus === "AWAITING_APPROVAL" && "⏳ Awaiting Review"}
                          {item.approvalStatus === "DRAFT" && "Draft"}
                        </span>
                      </div>
                    </td>

                    {/* Actions */}
                    <td className="py-4 px-4 align-top text-right space-x-1.5 whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedItem(item);
                        }}
                        className="h-8 px-2 text-xs"
                      >
                        <Eye className="h-3.5 w-3.5 mr-1" />
                        Details
                      </Button>

                      <Link
                        href={`/admin/content/${item.id}/edit`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        <Button variant="outline" size="sm" className="h-8 px-2 text-xs">
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          Edit
                        </Button>
                      </Link>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => handleArchive(item.id, item.title, e)}
                        className="h-8 px-2 text-xs text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/30"
                      >
                        <Archive className="h-3.5 w-3.5" />
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Content Detail Modal */}
      <ContentDetailModal
        content={selectedItem}
        isOpen={Boolean(selectedItem)}
        onClose={() => setSelectedItem(null)}
        isAdmin={true}
        onUpdate={() => {
          // Trigger refresh
          window.location.reload();
        }}
      />
    </>
  );
}
