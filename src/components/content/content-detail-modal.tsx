"use client";

import * as React from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  X,
  Calendar,
  Clock,
  ExternalLink,
  Edit3,
  Archive,
  Building2,
  FileText,
  CheckCircle2,
  AlertCircle,
  History,
  Send,
  Sparkles,
  MessageSquare,
  Check,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { formatDateInTimezone, formatTimeInTimezone } from "@/lib/date-utils";
import { archiveContentAction } from "@/app/(admin)/admin/content/actions";
import {
  approveContentAction,
  requestChangesAction,
  updateClientCaptionAction,
  submitForApprovalAction,
  getContentDetailsAction,
} from "@/app/actions/approval-actions";
import { Platform, ContentType, ApprovalStatus, PublishingStatus, ApprovalAction, Role } from "@prisma/client";

export interface CaptionVersionItem {
  id: string;
  versionNumber: number;
  caption: string;
  createdAt: Date | string;
  editedBy?: {
    id: string;
    name: string;
    email: string;
    role?: Role;
  } | null;
}

export interface ApprovalEventItem {
  id: string;
  action: ApprovalAction;
  notes?: string | null;
  createdAt: Date | string;
  user?: {
    id: string;
    name: string;
    email: string;
    role?: Role;
  } | null;
}

export interface ContentDetailItem {
  id: string;
  title: string;
  contentType: ContentType;
  scheduledAt: Date | string;
  driveUrl?: string | null;
  caption?: string | null;
  approvalStatus: ApprovalStatus;
  publishingStatus: PublishingStatus;
  organization?: {
    id: string;
    name: string;
    timezone: string;
  } | null;
  platforms: {
    platform: Platform;
  }[];
  createdBy?: {
    name: string;
  } | null;
  captionVersions?: CaptionVersionItem[];
  approvals?: ApprovalEventItem[];
}

interface ContentDetailModalProps {
  content: ContentDetailItem | null;
  isOpen: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  onUpdate?: () => void;
}

export function ContentDetailModal({
  content: initialContent,
  isOpen,
  onClose,
  isAdmin = false,
  onUpdate,
}: ContentDetailModalProps) {
  const [content, setContent] = React.useState<ContentDetailItem | null>(initialContent);
  const [isArchiving, startArchiving] = React.useTransition();
  const [isApproving, startApproving] = React.useTransition();
  const [isSubmittingApproval, startSubmittingApproval] = React.useTransition();
  const [isRequestingChanges, startRequestingChanges] = React.useTransition();
  const [isSavingCaption, startSavingCaption] = React.useTransition();

  // State for change request dialog
  const [showChangeRequestForm, setShowChangeRequestForm] = React.useState(false);
  const [changeNotes, setChangeNotes] = React.useState("");
  const [changeNotesError, setChangeNotesError] = React.useState("");

  // State for caption editing
  const [isEditingCaption, setIsEditingCaption] = React.useState(false);
  const [editableCaption, setEditableCaption] = React.useState("");

  // State for history accordions
  const [showVersionHistory, setShowVersionHistory] = React.useState(false);
  const [showApprovalHistory, setShowApprovalHistory] = React.useState(false);

  // Status feedback toast
  const [actionFeedback, setActionFeedback] = React.useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  // Refresh content data when initialContent changes or modal opens
  React.useEffect(() => {
    if (initialContent) {
      setContent(initialContent);
      setEditableCaption(initialContent.caption || "");
      setShowChangeRequestForm(false);
      setIsEditingCaption(false);
      setChangeNotes("");
      setChangeNotesError("");
      setActionFeedback(null);

      // Async fetch full latest details if relations aren't populated
      getContentDetailsAction(initialContent.id).then((res) => {
        if (res.success && res.data) {
          setContent(res.data as ContentDetailItem);
          setEditableCaption((res.data as ContentDetailItem).caption || "");
        }
      });
    }
  }, [initialContent, isOpen]);

  if (!isOpen || !content) return null;

  const timezone = content.organization?.timezone || "Asia/Kolkata";
  const formattedDate = formatDateInTimezone(content.scheduledAt, timezone);
  const formattedTime = formatTimeInTimezone(content.scheduledAt, timezone);

  // Status badge config
  const approvalStatusBadge = {
    APPROVED: {
      label: "Approved",
      color: "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800",
      icon: CheckCircle2,
    },
    CHANGES_REQUESTED: {
      label: "Changes Requested",
      color: "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800",
      icon: AlertCircle,
    },
    AWAITING_APPROVAL: {
      label: "Awaiting Approval",
      color: "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800",
      icon: Clock,
    },
    DRAFT: {
      label: "Draft",
      color: "bg-zinc-100 text-zinc-700 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:border-zinc-700",
      icon: FileText,
    },
  }[content.approvalStatus];

  const handleArchive = () => {
    if (
      !window.confirm(
        `Are you sure you want to archive "${content.title}"?\n\nIt will be removed from the active calendar but all history and caption versions will remain preserved.`
      )
    ) {
      return;
    }

    startArchiving(async () => {
      const formData = new FormData();
      formData.set("contentId", content.id);
      await archiveContentAction(formData);
      onClose();
      onUpdate?.();
    });
  };

  const handleApprove = () => {
    startApproving(async () => {
      setActionFeedback(null);
      const res = await approveContentAction(content.id);
      if (res.success && res.data) {
        setContent(res.data as ContentDetailItem);
        setActionFeedback({ type: "success", message: "Content has been successfully approved!" });
        onUpdate?.();
      } else {
        setActionFeedback({ type: "error", message: res.error || "Failed to approve content." });
      }
    });
  };

  const handleSubmitChangeRequest = (e: React.FormEvent) => {
    e.preventDefault();
    if (!changeNotes.trim()) {
      setChangeNotesError("Please describe the changes needed.");
      return;
    }

    startRequestingChanges(async () => {
      setActionFeedback(null);
      const res = await requestChangesAction(content.id, changeNotes.trim());
      if (res.success && res.data) {
        setContent(res.data as ContentDetailItem);
        setShowChangeRequestForm(false);
        setChangeNotes("");
        setChangeNotesError("");
        setActionFeedback({ type: "success", message: "Change request submitted to the agency." });
        onUpdate?.();
      } else {
        setChangeNotesError(res.error || "Failed to submit change request.");
      }
    });
  };

  const handleSaveCaption = () => {
    startSavingCaption(async () => {
      setActionFeedback(null);
      const res = await updateClientCaptionAction(content.id, editableCaption);
      if (res.success && res.data) {
        setContent(res.data as ContentDetailItem);
        setIsEditingCaption(false);
        setActionFeedback({ type: "success", message: "Caption updated successfully." });
        onUpdate?.();
      } else {
        setActionFeedback({ type: "error", message: res.error || "Failed to update caption." });
      }
    });
  };

  const handleSubmitForApproval = () => {
    startSubmittingApproval(async () => {
      setActionFeedback(null);
      const res = await submitForApprovalAction(content.id);
      if (res.success && res.data) {
        setContent(res.data as ContentDetailItem);
        setActionFeedback({ type: "success", message: "Content submitted for client review." });
        onUpdate?.();
      } else {
        setActionFeedback({ type: "error", message: res.error || "Failed to submit for approval." });
      }
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

  // Find latest change request note if in CHANGES_REQUESTED status
  const latestChangeRequest = content.approvals?.find((a) => a.action === "REQUEST_CHANGES");

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-950/50 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-xl border border-zinc-200 bg-white p-6 shadow-xl dark:border-zinc-800 dark:bg-zinc-900 animate-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 transition"
        >
          <X className="h-4 w-4" />
        </button>

        {/* Action Feedback Banner */}
        {actionFeedback && (
          <div
            className={`mb-4 p-3 rounded-lg text-xs flex items-center justify-between border ${
              actionFeedback.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-200 dark:border-emerald-800"
                : "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/50 dark:text-red-200 dark:border-red-800"
            }`}
          >
            <span>{actionFeedback.message}</span>
            <button
              onClick={() => setActionFeedback(null)}
              className="text-zinc-400 hover:text-zinc-700 ml-2"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        )}

        {/* Modal Header */}
        <div className="space-y-2 pr-8">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="font-mono text-[10px] tracking-wider uppercase">
              {content.contentType}
            </Badge>

            {/* Prominent Approval Status */}
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${approvalStatusBadge.color}`}
            >
              <approvalStatusBadge.icon className="h-3.5 w-3.5" />
              {approvalStatusBadge.label}
            </span>

            {content.organization && (
              <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-600 dark:text-zinc-400">
                <Building2 className="h-3.5 w-3.5" />
                {content.organization.name}
              </span>
            )}
          </div>

          <h2 className="text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {content.title}
          </h2>
        </div>

        {/* Active Change Request Highlight Box (if CHANGES_REQUESTED) */}
        {content.approvalStatus === "CHANGES_REQUESTED" && latestChangeRequest?.notes && (
          <div className="my-3 p-3.5 rounded-lg border border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/40 text-xs space-y-1">
            <div className="flex items-center gap-1.5 font-semibold text-amber-900 dark:text-amber-200">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <span>Requested Changes from Client</span>
            </div>
            <p className="text-amber-800 dark:text-amber-300 leading-relaxed pl-5 whitespace-pre-wrap">
              "{latestChangeRequest.notes}"
            </p>
            {latestChangeRequest.user && (
              <span className="block text-[10px] text-amber-600/80 dark:text-amber-400/80 pl-5">
                Requested by {latestChangeRequest.user.name} on{" "}
                {formatDateInTimezone(latestChangeRequest.createdAt, timezone)}
              </span>
            )}
          </div>
        )}

        {/* Schedule & Publishing Status Bar */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 my-4 p-3.5 rounded-lg bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/80 dark:border-zinc-800 text-xs">
          <div className="space-y-1">
            <span className="text-zinc-400 block font-medium">Scheduled Publication</span>
            <div className="flex items-center gap-3 font-semibold text-zinc-800 dark:text-zinc-200">
              <span className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-zinc-400" />
                {formattedDate}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-zinc-400" />
                {formattedTime}
              </span>
            </div>
            <span className="text-[10px] text-zinc-400">Timezone: {timezone}</span>
          </div>

          <div className="space-y-1">
            <span className="text-zinc-400 block font-medium">Publishing Status</span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs font-medium">
                {content.publishingStatus}
              </Badge>
            </div>
            <span className="text-[10px] text-zinc-400">Managed independently by agency</span>
          </div>
        </div>

        {/* Target Platforms */}
        <div className="space-y-1.5 my-4">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Target Social Platforms
          </span>
          <div className="flex flex-wrap gap-1.5">
            {content.platforms.map((p) => (
              <span
                key={p.platform}
                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${platformBadgeColors[p.platform]}`}
              >
                {p.platform}
              </span>
            ))}
          </div>
        </div>

        {/* Creative / Google Drive Link */}
        <div className="space-y-1.5 my-4">
          <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 block">
            Creative Asset
          </span>
          {content.driveUrl ? (
            <div className="flex items-center justify-between p-3 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50">
              <div className="flex items-center gap-2.5 truncate mr-3">
                <div className="h-8 w-8 rounded bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 flex items-center justify-center font-bold text-xs shrink-0">
                  GD
                </div>
                <div className="truncate text-xs">
                  <div className="font-medium text-zinc-900 dark:text-zinc-100">Google Drive Creative</div>
                  <div className="text-zinc-400 truncate max-w-sm">{content.driveUrl}</div>
                </div>
              </div>

              <a
                href={content.driveUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 rounded-md hover:bg-zinc-800 dark:hover:bg-zinc-200 transition shrink-0"
              >
                <span>Open in Google Drive</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-dashed border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
              No Google Drive asset linked for this content.
            </div>
          )}
        </div>

        {/* Caption Section with Client Editing */}
        <div className="space-y-1.5 my-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" />
              Caption
            </span>

            {/* Client Caption Edit Toggle */}
            {!isAdmin && !isEditingCaption && (
              <button
                onClick={() => {
                  setEditableCaption(content.caption || "");
                  setIsEditingCaption(true);
                }}
                className="text-xs text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 font-medium flex items-center gap-1"
              >
                <Edit3 className="h-3 w-3" />
                <span>Edit Caption</span>
              </button>
            )}
          </div>

          {isEditingCaption ? (
            <div className="space-y-2 p-3 rounded-lg border border-indigo-200 bg-indigo-50/30 dark:border-indigo-900/60 dark:bg-indigo-950/20">
              <textarea
                value={editableCaption}
                onChange={(e) => setEditableCaption(e.target.value)}
                placeholder="Enter new caption..."
                rows={4}
                className="w-full text-xs p-2.5 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-indigo-500 font-sans"
              />
              <div className="flex items-center justify-end gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsEditingCaption(false)}
                  className="text-xs h-7"
                >
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveCaption}
                  isLoading={isSavingCaption}
                  className="text-xs h-7 bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  Save Caption
                </Button>
              </div>
            </div>
          ) : (
            <div className="p-3.5 rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950 text-xs leading-relaxed text-zinc-800 dark:text-zinc-200 whitespace-pre-wrap font-sans">
              {content.caption || <span className="text-zinc-400 italic">No caption provided.</span>}
            </div>
          )}
        </div>

        {/* Caption Version History Accordion */}
        {content.captionVersions && content.captionVersions.length > 0 && (
          <div className="my-3 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setShowVersionHistory(!showVersionHistory)}
              className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/70 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            >
              <div className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
                <History className="h-3.5 w-3.5 text-zinc-400" />
                <span>Caption Version History ({content.captionVersions.length})</span>
              </div>
              {showVersionHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showVersionHistory && (
              <div className="p-3 bg-white dark:bg-zinc-900 space-y-3 border-t border-zinc-200 dark:border-zinc-800 max-h-60 overflow-y-auto">
                {content.captionVersions.map((ver, idx) => (
                  <div
                    key={ver.id}
                    className={`p-2.5 rounded border text-xs space-y-1 ${
                      idx === 0
                        ? "border-emerald-200 bg-emerald-50/30 dark:border-emerald-900/50 dark:bg-emerald-950/20"
                        : "border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50"
                    }`}
                  >
                    <div className="flex items-center justify-between font-medium">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="outline" className="text-[10px] font-mono px-1.5 py-0">
                          v{ver.versionNumber} {idx === 0 && "(Latest)"}
                        </Badge>
                        {ver.editedBy && (
                          <span className="text-[11px] text-zinc-600 dark:text-zinc-400">
                            {ver.editedBy.name} ({ver.editedBy.role || "Client"})
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {formatDateInTimezone(ver.createdAt, timezone)}
                      </span>
                    </div>
                    <p className="text-zinc-700 dark:text-zinc-300 whitespace-pre-wrap pl-1 font-sans">
                      {ver.caption}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Approval Events Audit Log Accordion */}
        {content.approvals && content.approvals.length > 0 && (
          <div className="my-3 border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setShowApprovalHistory(!showApprovalHistory)}
              className="w-full flex items-center justify-between p-3 bg-zinc-50 dark:bg-zinc-950/70 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition"
            >
              <div className="flex items-center gap-2 font-semibold text-zinc-700 dark:text-zinc-300">
                <MessageSquare className="h-3.5 w-3.5 text-zinc-400" />
                <span>Approval Event Timeline ({content.approvals.length})</span>
              </div>
              {showApprovalHistory ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </button>

            {showApprovalHistory && (
              <div className="p-3 bg-white dark:bg-zinc-900 space-y-2.5 border-t border-zinc-200 dark:border-zinc-800 max-h-60 overflow-y-auto">
                {content.approvals.map((app) => (
                  <div
                    key={app.id}
                    className="p-2.5 rounded border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 dark:bg-zinc-950/50 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        {app.action === "APPROVE" ? (
                          <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 text-[10px] font-semibold">
                            ✓ Approved
                          </Badge>
                        ) : (
                          <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-[10px] font-semibold">
                            ! Changes Requested
                          </Badge>
                        )}
                        {app.user && (
                          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300">
                            {app.user.name}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-zinc-400">
                        {formatDateInTimezone(app.createdAt, timezone)}
                      </span>
                    </div>

                    {app.notes && (
                      <p className="text-zinc-600 dark:text-zinc-400 italic pl-2 border-l-2 border-amber-300 dark:border-amber-800 my-1">
                        "{app.notes}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Change Request Form Dialog / Panel */}
        {showChangeRequestForm && (
          <form
            onSubmit={handleSubmitChangeRequest}
            className="my-4 p-4 rounded-lg border border-amber-200 bg-amber-50/50 dark:border-amber-900/60 dark:bg-amber-950/20 space-y-3 animate-in fade-in"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                <AlertCircle className="h-4 w-4 text-amber-600" />
                Request Changes to this Content
              </span>
              <button
                type="button"
                onClick={() => {
                  setShowChangeRequestForm(false);
                  setChangeNotesError("");
                }}
                className="text-zinc-400 hover:text-zinc-600"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            <p className="text-[11px] text-zinc-600 dark:text-zinc-400">
              Please clearly describe the edits or modifications needed (e.g. copy tweaks, visual adjustments, timing).
            </p>

            <textarea
              value={changeNotes}
              onChange={(e) => {
                setChangeNotes(e.target.value);
                setChangeNotesError("");
              }}
              rows={3}
              placeholder="e.g. Please update the first slide headline and add the promotional discount code..."
              className="w-full text-xs p-2.5 rounded border border-amber-300 dark:border-amber-800 bg-white dark:bg-zinc-900 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-1 focus:ring-amber-500"
            />

            {changeNotesError && (
              <p className="text-[11px] font-medium text-red-600 dark:text-red-400">
                {changeNotesError}
              </p>
            )}

            <div className="flex items-center justify-end gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setShowChangeRequestForm(false)}
                className="text-xs h-8"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                isLoading={isRequestingChanges}
                className="text-xs h-8 bg-amber-600 hover:bg-amber-700 text-white font-medium"
              >
                Submit Change Request
              </Button>
            </div>
          </form>
        )}

        {/* Modal Footer / Approval Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-4 mt-6 border-t border-zinc-200 dark:border-zinc-800">
          <div>
            {content.createdBy && (
              <span className="text-[11px] text-zinc-400">
                Created by {content.createdBy.name}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Client Approval Actions */}
            {!isAdmin && (
              <>
                {content.approvalStatus !== "APPROVED" && (
                  <>
                    {!showChangeRequestForm && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowChangeRequestForm(true)}
                        className="text-xs text-amber-700 hover:bg-amber-50 hover:text-amber-800 border-amber-200 dark:border-amber-900/60 dark:text-amber-400"
                      >
                        <AlertCircle className="h-3.5 w-3.5 mr-1 text-amber-600" />
                        Request Changes
                      </Button>
                    )}

                    <Button
                      size="sm"
                      onClick={handleApprove}
                      isLoading={isApproving}
                      className="text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                    >
                      <Check className="h-3.5 w-3.5 mr-1" />
                      Approve Content
                    </Button>
                  </>
                )}

                {content.approvalStatus === "APPROVED" && (
                  <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs font-medium border border-emerald-200 dark:border-emerald-800">
                    <CheckCircle2 className="h-4 w-4" />
                    Content Approved
                  </span>
                )}
              </>
            )}

            {/* Admin Management Actions */}
            {isAdmin && (
              <>
                {(content.approvalStatus === "DRAFT" || content.approvalStatus === "CHANGES_REQUESTED") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSubmitForApproval}
                    isLoading={isSubmittingApproval}
                    className="text-xs text-blue-600 hover:bg-blue-50 border-blue-200 dark:border-blue-900 dark:text-blue-400"
                  >
                    <Send className="h-3.5 w-3.5 mr-1" />
                    Submit for Client Approval
                  </Button>
                )}

                <Link href={`/admin/content/${content.id}/edit`}>
                  <Button variant="outline" size="sm" className="text-xs">
                    <Edit3 className="h-3.5 w-3.5 mr-1" />
                    Edit Content
                  </Button>
                </Link>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleArchive}
                  isLoading={isArchiving}
                  className="text-xs text-red-600 hover:bg-red-50 hover:text-red-700 border-zinc-200 dark:border-zinc-800 dark:text-red-400"
                >
                  <Archive className="h-3.5 w-3.5 mr-1" />
                  Archive
                </Button>
              </>
            )}

            <Button variant="secondary" size="sm" onClick={onClose} className="text-xs">
              Close
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
