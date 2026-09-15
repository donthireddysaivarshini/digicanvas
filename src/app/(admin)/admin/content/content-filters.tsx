"use client";

import * as React from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Filter, RotateCcw } from "lucide-react";
import { ContentType, Platform, ApprovalStatus, PublishingStatus } from "@prisma/client";

interface ContentFiltersProps {
  organizations: { id: string; name: string }[];
}

export function ContentFilters({ organizations }: ContentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const [orgId, setOrgId] = React.useState(searchParams.get("organizationId") || "");
  const [cType, setCType] = React.useState(searchParams.get("contentType") || "");
  const [platform, setPlatform] = React.useState(searchParams.get("platform") || "");
  const [pubStatus, setPubStatus] = React.useState(searchParams.get("publishingStatus") || "");
  const [appStatus, setAppStatus] = React.useState(searchParams.get("approvalStatus") || "");

  const handleApply = (e: React.FormEvent) => {
    e.preventDefault();
    const params = new URLSearchParams();
    if (orgId) params.set("organizationId", orgId);
    if (cType) params.set("contentType", cType);
    if (platform) params.set("platform", platform);
    if (pubStatus) params.set("publishingStatus", pubStatus);
    if (appStatus) params.set("approvalStatus", appStatus);

    router.push(`${pathname}?${params.toString()}`);
  };

  const handleReset = () => {
    setOrgId("");
    setCType("");
    setPlatform("");
    setPubStatus("");
    setAppStatus("");
    router.push(pathname);
  };

  const hasActiveFilters = Boolean(orgId || cType || platform || pubStatus || appStatus);

  return (
    <form
      onSubmit={handleApply}
      className="p-4 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-sm space-y-3"
    >
      <div className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
        <Filter className="h-3.5 w-3.5 text-zinc-400" />
        <span>Filter Content</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
        {/* Client */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Client Organization</label>
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

        {/* Content Type */}
        <div className="space-y-1">
          <label className="text-[11px] text-zinc-400">Content Type</label>
          <select
            value={cType}
            onChange={(e) => setCType(e.target.value)}
            className="w-full h-8 rounded border border-zinc-200 bg-white px-2 text-xs shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
          >
            <option value="">All Types</option>
            <option value="REEL">Reel</option>
            <option value="POST">Post</option>
            <option value="STORY">Story</option>
            <option value="SHORT">Short</option>
            <option value="VIDEO">Video</option>
            <option value="OTHER">Other</option>
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
      </div>

      <div className="flex items-center justify-end gap-2 pt-1 border-t border-zinc-100 dark:border-zinc-800">
        {hasActiveFilters && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleReset}
            className="h-7 text-xs text-zinc-500"
          >
            <RotateCcw className="h-3 w-3 mr-1" />
            Reset
          </Button>
        )}
        <Button type="submit" size="sm" className="h-7 text-xs">
          Apply Filters
        </Button>
      </div>
    </form>
  );
}
