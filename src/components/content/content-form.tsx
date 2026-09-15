"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  createContentAction,
  updateContentAction,
  ContentActionState,
} from "@/app/(admin)/admin/content/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Calendar,
  Clock,
  ExternalLink,
  Layers,
  Building2,
  FileText,
  AlertCircle,
  Share2,
} from "lucide-react";
import { Platform, ContentType, PublishingStatus, ApprovalStatus } from "@prisma/client";
import { getDateStringInTimezone, getTimeStringInTimezone } from "@/lib/date-utils";

function SubmitButton({ isEditing }: { isEditing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      {isEditing ? "Save Content Changes" : "Schedule Content"}
    </Button>
  );
}

const ALL_PLATFORMS: { id: Platform; label: string }[] = [
  { id: "INSTAGRAM", label: "Instagram" },
  { id: "FACEBOOK", label: "Facebook" },
  { id: "YOUTUBE", label: "YouTube" },
  { id: "LINKEDIN", label: "LinkedIn" },
  { id: "X", label: "X (Twitter)" },
  { id: "THREADS", label: "Threads" },
];

const ALL_CONTENT_TYPES: { id: ContentType; label: string }[] = [
  { id: "REEL", label: "Reel" },
  { id: "POST", label: "Post / Graphic" },
  { id: "STORY", label: "Story" },
  { id: "SHORT", label: "Short" },
  { id: "VIDEO", label: "Video" },
  { id: "OTHER", label: "Other" },
];

interface ContentFormProps {
  organizations: {
    id: string;
    name: string;
    slug: string;
    timezone: string;
  }[];
  initialData?: {
    id: string;
    organizationId: string;
    title: string;
    contentType: ContentType;
    scheduledAt: Date | string;
    driveUrl?: string | null;
    caption?: string | null;
    publishingStatus: PublishingStatus;
    approvalStatus: ApprovalStatus;
    platforms: { platform: Platform }[];
  };
}

export function ContentForm({ organizations, initialData }: ContentFormProps) {
  const router = useRouter();
  const isEditing = Boolean(initialData);

  const [state, formAction] = useFormState<ContentActionState, FormData>(
    isEditing ? updateContentAction : createContentAction,
    {}
  );

  const initialOrg = organizations.find((o) => o.id === initialData?.organizationId) || organizations[0];
  const initialTimezone = initialOrg?.timezone || "Asia/Kolkata";

  const initialDateStr = initialData
    ? getDateStringInTimezone(initialData.scheduledAt, initialTimezone)
    : "";
  const initialTimeStr = initialData
    ? getTimeStringInTimezone(initialData.scheduledAt, initialTimezone)
    : "19:00";

  const [selectedPlatforms, setSelectedPlatforms] = React.useState<Platform[]>(
    initialData ? initialData.platforms.map((p) => p.platform) : ["INSTAGRAM"]
  );

  const togglePlatform = (platform: Platform) => {
    setSelectedPlatforms((prev) =>
      prev.includes(platform) ? prev.filter((p) => p !== platform) : [...prev, platform]
    );
  };

  React.useEffect(() => {
    if (state.success) {
      router.push("/admin/content");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-6 max-w-3xl">
      {initialData && <input type="hidden" name="id" value={initialData.id} />}

      {state.error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Main Info Card */}
      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Layers className="h-4 w-4 text-zinc-500" />
            Content Details
          </CardTitle>
          <CardDescription>
            Specify the client, topic, type, and target social platforms.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Client selector (only in creation or display in edit) */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="organizationId">
              Client / Organization *
            </label>
            {isEditing ? (
              <div className="p-2.5 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <Building2 className="h-4 w-4 text-zinc-400" />
                <span>{initialOrg?.name}</span>
                <input type="hidden" name="organizationId" value={initialData?.organizationId} />
              </div>
            ) : (
              <select
                id="organizationId"
                name="organizationId"
                defaultValue={organizations[0]?.id}
                required
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
              >
                {organizations.map((org) => (
                  <option key={org.id} value={org.id}>
                    {org.name} ({org.timezone})
                  </option>
                ))}
              </select>
            )}
            {state.fieldErrors?.organizationId && (
              <p className="text-xs text-red-500">{state.fieldErrors.organizationId[0]}</p>
            )}
          </div>

          {/* Title / Topic */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="title">
              Content Title / Topic *
            </label>
            <Input
              id="title"
              name="title"
              placeholder="e.g. 5 Things You Should Know Before Buying a Home"
              defaultValue={initialData?.title}
              required
              error={state.fieldErrors?.title?.[0]}
            />
          </div>

          {/* Content Type & Publishing Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="contentType">
                Content Type *
              </label>
              <select
                id="contentType"
                name="contentType"
                defaultValue={initialData?.contentType || "REEL"}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
              >
                {ALL_CONTENT_TYPES.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="publishingStatus">
                Publishing Status *
              </label>
              <select
                id="publishingStatus"
                name="publishingStatus"
                defaultValue={initialData?.publishingStatus || "SCHEDULED"}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
              >
                <option value="SCHEDULED">Scheduled</option>
                <option value="NOT_SCHEDULED">Not Scheduled</option>
                <option value="POSTED">Posted</option>
                <option value="NOT_POSTED">Not Posted</option>
                <option value="CANCELLED">Cancelled</option>
                <option value="POSTPONED">Postponed</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="approvalStatus">
                Approval Status (Status Field)
              </label>
              <select
                id="approvalStatus"
                name="approvalStatus"
                defaultValue={initialData?.approvalStatus || "AWAITING_APPROVAL"}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
              >
                <option value="AWAITING_APPROVAL">Awaiting Approval</option>
                <option value="DRAFT">Draft</option>
                <option value="CHANGES_REQUESTED">Changes Requested</option>
                <option value="APPROVED">Approved</option>
              </select>
            </div>
          </div>

          {/* Social Platforms Multi-Select */}
          <div className="space-y-2 pt-2">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <Share2 className="h-3.5 w-3.5 text-zinc-400" />
              Target Social Platforms *
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {ALL_PLATFORMS.map((platform) => {
                const isChecked = selectedPlatforms.includes(platform.id);
                return (
                  <label
                    key={platform.id}
                    className={`flex items-center gap-2.5 p-2.5 rounded-md border text-xs cursor-pointer transition select-none ${
                      isChecked
                        ? "border-zinc-900 bg-zinc-900 text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 font-medium"
                        : "border-zinc-200 bg-white text-zinc-700 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
                    }`}
                  >
                    <input
                      type="checkbox"
                      name="platforms"
                      value={platform.id}
                      checked={isChecked}
                      onChange={() => togglePlatform(platform.id)}
                      className="sr-only"
                    />
                    <span>{platform.label}</span>
                  </label>
                );
              })}
            </div>
            {state.fieldErrors?.platforms && (
              <p className="text-xs text-red-500">{state.fieldErrors.platforms[0]}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Schedule & Creative Asset */}
      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Calendar className="h-4 w-4 text-zinc-500" />
            Schedule & Creative Assets
          </CardTitle>
          <CardDescription>
            Date and time will be interpreted in the client's timezone.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="scheduledDate">
                Scheduled Date *
              </label>
              <div className="relative">
                <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  id="scheduledDate"
                  name="scheduledDate"
                  type="date"
                  defaultValue={initialDateStr}
                  required
                  className="pl-9"
                  error={state.fieldErrors?.scheduledDate?.[0]}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="scheduledTime">
                Scheduled Time *
              </label>
              <div className="relative">
                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  id="scheduledTime"
                  name="scheduledTime"
                  type="time"
                  defaultValue={initialTimeStr}
                  required
                  className="pl-9"
                  error={state.fieldErrors?.scheduledTime?.[0]}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="driveUrl">
              Google Drive Creative Link (Optional)
            </label>
            <div className="relative">
              <ExternalLink className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <Input
                id="driveUrl"
                name="driveUrl"
                type="url"
                placeholder="https://drive.google.com/file/d/..."
                defaultValue={initialData?.driveUrl || ""}
                className="pl-9"
                error={state.fieldErrors?.driveUrl?.[0]}
              />
            </div>
            <p className="text-[11px] text-zinc-400">
              The creative file remains hosted on Google Drive. The client portal will provide an "Open in Google Drive" action.
            </p>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5" htmlFor="caption">
              <FileText className="h-3.5 w-3.5 text-zinc-400" />
              Caption Text
            </label>
            <textarea
              id="caption"
              name="caption"
              rows={5}
              placeholder="Write the post caption, hashtags, and CTA here..."
              defaultValue={initialData?.caption || ""}
              className="flex w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
            />
            {state.fieldErrors?.caption && (
              <p className="text-xs text-red-500">{state.fieldErrors.caption[0]}</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Form Submit & Cancel */}
      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/admin/content">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton isEditing={isEditing} />
      </div>
    </form>
  );
}
