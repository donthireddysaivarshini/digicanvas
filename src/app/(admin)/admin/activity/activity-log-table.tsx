"use client";

import * as React from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Activity,
  Calendar,
  Clock,
  User,
  Building2,
  Filter,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ShieldAlert,
  CheckCircle2,
  FileEdit,
  Send,
  Sparkles,
  Archive,
} from "lucide-react";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/date-utils";
import { ActivityLogsResult } from "@/lib/services/activity-service";

interface ActivityLogTableProps {
  initialData: ActivityLogsResult;
  clients: { id: string; name: string }[];
}

export function ActivityLogTable({ initialData, clients }: ActivityLogTableProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Filters state from URL query
  const currentOrg = searchParams.get("organizationId") || "";
  const currentAction = searchParams.get("action") || "";
  const currentEntityType = searchParams.get("entityType") || "";
  const currentStartDate = searchParams.get("startDate") || "";
  const currentEndDate = searchParams.get("endDate") || "";
  const currentPage = Number(searchParams.get("page")) || 1;

  const [selectedOrg, setSelectedOrg] = React.useState(currentOrg);
  const [selectedAction, setSelectedAction] = React.useState(currentAction);
  const [selectedEntityType, setSelectedEntityType] = React.useState(currentEntityType);
  const [startDate, setStartDate] = React.useState(currentStartDate);
  const [endDate, setEndDate] = React.useState(currentEndDate);

  const applyFilters = () => {
    const params = new URLSearchParams();
    if (selectedOrg) params.set("organizationId", selectedOrg);
    if (selectedAction) params.set("action", selectedAction);
    if (selectedEntityType) params.set("entityType", selectedEntityType);
    if (startDate) params.set("startDate", startDate);
    if (endDate) params.set("endDate", endDate);
    params.set("page", "1"); // Reset to page 1 on filter
    router.push(`${pathname}?${params.toString()}`);
  };

  const resetFilters = () => {
    setSelectedOrg("");
    setSelectedAction("");
    setSelectedEntityType("");
    setStartDate("");
    setEndDate("");
    router.push(pathname);
  };

  const goToPage = (pageNumber: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", pageNumber.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  // Distinct action types
  const actionOptions = [
    { value: "CONTENT_CREATED", label: "Content Created" },
    { value: "CONTENT_UPDATED", label: "Content Updated" },
    { value: "CONTENT_SUBMITTED_FOR_APPROVAL", label: "Submitted for Approval" },
    { value: "CONTENT_APPROVED", label: "Content Approved" },
    { value: "CONTENT_CHANGES_REQUESTED", label: "Changes Requested" },
    { value: "CAPTION_UPDATED_BY_CLIENT", label: "Caption Edited by Client" },
    { value: "CONTENT_RESCHEDULED", label: "Content Rescheduled" },
    { value: "CONTENT_ARCHIVED", label: "Content Archived" },
    { value: "CLIENT_CREATED", label: "Client Created" },
    { value: "CLIENT_UPDATED", label: "Client Updated" },
    { value: "CLIENT_STATUS_CHANGED", label: "Client Status Changed" },
  ];

  const getActionBadge = (action: string) => {
    switch (action) {
      case "CONTENT_APPROVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
            <CheckCircle2 className="h-3 w-3" />
            Approved
          </span>
        );
      case "CONTENT_CHANGES_REQUESTED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
            <ShieldAlert className="h-3 w-3" />
            Changes Requested
          </span>
        );
      case "CONTENT_SUBMITTED_FOR_APPROVAL":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800">
            <Send className="h-3 w-3" />
            Submitted for Review
          </span>
        );
      case "CAPTION_UPDATED_BY_CLIENT":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-purple-50 text-purple-700 border border-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800">
            <FileEdit className="h-3 w-3" />
            Caption Edited
          </span>
        );
      case "CONTENT_ARCHIVED":
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-red-50 text-red-700 border border-red-200 dark:bg-red-950/40 dark:text-red-300 dark:border-red-800">
            <Archive className="h-3 w-3" />
            Archived
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold bg-zinc-100 text-zinc-700 border border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700 font-mono">
            {action}
          </span>
        );
    }
  };

  const formatMetadata = (metadata: unknown) => {
    if (!metadata || typeof metadata !== "object") return null;
    const meta = metadata as Record<string, unknown>;

    const items: string[] = [];
    if (meta.title) items.push(`"${meta.title}"`);
    if (meta.versionNumber) items.push(`v${meta.versionNumber}`);
    if (meta.notes) items.push(`Note: "${meta.notes}"`);
    if (meta.newStatus) items.push(`Status: ${meta.newStatus}`);

    if (items.length === 0) {
      return JSON.stringify(meta);
    }
    return items.join(" • ");
  };

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
          <Activity className="h-5 w-5 text-indigo-600" />
          Audit Log & Activity History
        </h1>
        <p className="text-xs text-zinc-500 mt-1">
          Complete, immutable chronological record of administrative and client workflow events.
        </p>
      </div>

      {/* Filter Control Bar */}
      <Card className="border border-zinc-200 dark:border-zinc-800 shadow-sm">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
            <Filter className="h-3.5 w-3.5" />
            <span>Filter Audit Trail</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Client Org Filter */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                Client Organization
              </label>
              <select
                value={selectedOrg}
                onChange={(e) => setSelectedOrg(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">All Clients</option>
                {clients.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Action Filter */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                Action Event
              </label>
              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">All Actions</option>
                {actionOptions.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Entity Type Filter */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                Entity Type
              </label>
              <select
                value={selectedEntityType}
                onChange={(e) => setSelectedEntityType(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-zinc-900"
              >
                <option value="">All Entity Types</option>
                <option value="CONTENT">CONTENT</option>
                <option value="CLIENT">CLIENT</option>
                <option value="USER">USER</option>
              </select>
            </div>

            {/* Start Date */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                From Date
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>

            {/* End Date */}
            <div>
              <label className="block text-[11px] font-medium text-zinc-500 mb-1">
                To Date
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full text-xs h-8 px-2 rounded border border-zinc-300 bg-white dark:border-zinc-700 dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100"
              />
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-zinc-100 dark:border-zinc-800">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs h-8 text-zinc-600"
            >
              <RotateCcw className="h-3.5 w-3.5 mr-1" />
              Reset Filters
            </Button>
            <Button
              size="sm"
              onClick={applyFilters}
              className="text-xs h-8 bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900"
            >
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audit Log Table */}
      <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500 font-semibold">
              <tr>
                <th className="py-3 px-4">Date & Time</th>
                <th className="py-3 px-4">Actor / User</th>
                <th className="py-3 px-4">Organization</th>
                <th className="py-3 px-4">Action Event</th>
                <th className="py-3 px-4">Entity & Details</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {initialData.items.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-zinc-400">
                    No activity records found matching the specified filters.
                  </td>
                </tr>
              ) : (
                initialData.items.map((log) => {
                  const tz = log.organization?.timezone || "Asia/Kolkata";
                  const dateFormatted = formatDateInTimezone(log.createdAt, tz);
                  const timeFormatted = formatTimeInTimezone(log.createdAt, tz);
                  const metaSummary = formatMetadata(log.metadata);

                  return (
                    <tr
                      key={log.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition"
                    >
                      {/* Date & Time */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{dateFormatted}</span>
                        </div>
                        <div className="text-zinc-400 flex items-center gap-1 mt-0.5 text-[11px]">
                          <Clock className="h-3 w-3 text-zinc-400" />
                          <span>{timeFormatted}</span>
                        </div>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4 align-top">
                        <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                          <User className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{log.actor.name}</span>
                        </div>
                        <div className="text-[11px] text-zinc-400">
                          {log.actor.email} ({log.actor.role})
                        </div>
                      </td>

                      {/* Organization */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        <div className="font-medium text-zinc-800 dark:text-zinc-200 flex items-center gap-1.5">
                          <Building2 className="h-3.5 w-3.5 text-zinc-400" />
                          <span>{log.organization.name}</span>
                        </div>
                        <span className="text-[10px] text-zinc-400">{tz}</span>
                      </td>

                      {/* Action Badge */}
                      <td className="py-3.5 px-4 align-top whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>

                      {/* Entity & Details */}
                      <td className="py-3.5 px-4 align-top max-w-sm">
                        <div className="space-y-0.5">
                          <Badge variant="outline" className="text-[9px] uppercase font-mono px-1 py-0">
                            {log.entityType}
                          </Badge>
                          {metaSummary && (
                            <p className="text-zinc-700 dark:text-zinc-300 font-sans leading-snug line-clamp-2">
                              {metaSummary}
                            </p>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 text-xs text-zinc-600 dark:text-zinc-400">
          <div>
            Showing{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {initialData.total === 0 ? 0 : (initialData.page - 1) * initialData.limit + 1}
            </span>{" "}
            to{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {Math.min(initialData.page * initialData.limit, initialData.total)}
            </span>{" "}
            of{" "}
            <span className="font-semibold text-zinc-900 dark:text-zinc-100">
              {initialData.total}
            </span>{" "}
            records
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={initialData.page <= 1}
              onClick={() => goToPage(initialData.page - 1)}
              className="h-7 text-xs px-2.5"
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-0.5" />
              Previous
            </Button>

            <span className="text-xs font-mono px-1">
              Page {initialData.page} of {initialData.totalPages}
            </span>

            <Button
              variant="outline"
              size="sm"
              disabled={initialData.page >= initialData.totalPages}
              onClick={() => goToPage(initialData.page + 1)}
              className="h-7 text-xs px-2.5"
            >
              Next
              <ChevronRight className="h-3.5 w-3.5 ml-0.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
