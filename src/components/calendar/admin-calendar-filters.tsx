"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw } from "lucide-react";

interface AdminCalendarFiltersProps {
  organizations: { id: string; name: string }[];
}

export function AdminCalendarFilters({ organizations }: AdminCalendarFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [orgId, setOrgId] = React.useState(searchParams.get("organizationId") || "");
  const [platform, setPlatform] = React.useState(searchParams.get("platform") || "");
  const [cType, setCType] = React.useState(searchParams.get("contentType") || "");
  const [appStatus, setAppStatus] = React.useState(searchParams.get("approvalStatus") || "");
  const [pubStatus, setPubStatus] = React.useState(searchParams.get("publishingStatus") || "");

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams(searchParams.toString());

    if (orgId) params.set("organizationId", orgId);
    else params.delete("organizationId");

    if (platform) params.set("platform", platform);
    else params.delete("platform");

    if (cType) params.set("contentType", cType);
    else params.delete("contentType");

    if (appStatus) params.set("approvalStatus", appStatus);
    else params.delete("approvalStatus");

    if (pubStatus) params.set("publishingStatus", pubStatus);
    else params.delete("publishingStatus");

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    setOrgId("");
    setPlatform("");
    setCType("");
    setAppStatus("");
    setPubStatus("");

    // Keep view & date params
    const params = new URLSearchParams();
    const currentView = searchParams.get("view");
    const currentDate = searchParams.get("date");
    const currentStartDate = searchParams.get("startDate");
    const currentEndDate = searchParams.get("endDate");

    if (currentView) params.set("view", currentView);
    if (currentDate) params.set("date", currentDate);
    if (currentStartDate) params.set("startDate", currentStartDate);
    if (currentEndDate) params.set("endDate", currentEndDate);

    router.push(`${pathname}?${params.toString()}`);
  };

  const hasActiveFilters = Boolean(orgId || platform || cType || appStatus || pubStatus);

  return (
    <form
      onSubmit={handleApply}
      className="p-3.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
          <Filter className="h-3.5 w-3.5 text-zinc-400" />
          <span>Calendar Filters</span>
        </div>

        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-6 text-[11px] text-zinc-500 hover:text-zinc-900 px-2"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-2.5 text-xs">
        {/* Client */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Client</label>
          <select
            value={orgId}
            onChange={(e) => setOrgId(e.target.value)}
            className="w-full h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All Clients</option>
            {organizations.map((org) => (
              <option key={org.id} value={org.id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        {/* Platform */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Platform</label>
          <select
            value={platform}
            onChange={(e) => setPlatform(e.target.value)}
            className="w-full h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All Platforms</option>
            <option value="INSTAGRAM">Instagram</option>
            <option value="FACEBOOK">Facebook</option>
            <option value="YOUTUBE">YouTube</option>
            <option value="LINKEDIN">LinkedIn</option>
            <option value="X">X</option>
            <option value="THREADS">Threads</option>
          </select>
        </div>

        {/* Content Type */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Content Type</label>
          <select
            value={cType}
            onChange={(e) => setCType(e.target.value)}
            className="w-full h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All Content Types</option>
            <option value="REEL">Reel</option>
            <option value="POST">Post</option>
            <option value="STORY">Story</option>
            <option value="SHORT">Short</option>
            <option value="VIDEO">Video</option>
            <option value="OTHER">Other</option>
          </select>
        </div>

        {/* Approval Status */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Approval Status</label>
          <select
            value={appStatus}
            onChange={(e) => setAppStatus(e.target.value)}
            className="w-full h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All Approval Statuses</option>
            <option value="AWAITING_APPROVAL">Awaiting Approval</option>
            <option value="DRAFT">Draft</option>
            <option value="CHANGES_REQUESTED">Changes Requested</option>
            <option value="APPROVED">Approved</option>
          </select>
        </div>

        {/* Publishing Status */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Publishing Status</label>
          <select
            value={pubStatus}
            onChange={(e) => setPubStatus(e.target.value)}
            className="w-full h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All Publishing Statuses</option>
            <option value="SCHEDULED">Scheduled</option>
            <option value="NOT_SCHEDULED">Not Scheduled</option>
            <option value="POSTED">Posted</option>
            <option value="NOT_POSTED">Not Posted</option>
            <option value="CANCELLED">Cancelled</option>
            <option value="POSTPONED">Postponed</option>
          </select>
        </div>
      </div>

      <div className="flex items-center justify-end pt-1">
        <Button type="submit" size="sm" className="h-7 px-3 text-xs">
          Apply Filters
        </Button>
      </div>
    </form>
  );
}
