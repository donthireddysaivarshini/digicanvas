"use client";

import * as React from "react";
import {
  Bell,
  Check,
  CheckCircle2,
  AlertCircle,
  Clock,
  Info,
  ExternalLink,
  X,
  Sparkles,
  ChevronRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  getNotificationsAction,
  markNotificationAsReadAction,
  markAllNotificationsAsReadAction,
} from "@/app/actions/notification-actions";
import { getContentDetailsAction } from "@/app/actions/approval-actions";
import {
  ContentDetailModal,
  ContentDetailItem,
} from "@/components/content/content-detail-modal";
import { NotificationType } from "@prisma/client";

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  contentId?: string | null;
  isRead: boolean;
  createdAt: Date | string;
  organization?: {
    id: string;
    name: string;
    timezone: string;
  } | null;
  content?: {
    id: string;
    title: string;
    approvalStatus: string;
    publishingStatus: string;
  } | null;
}

interface NotificationBellProps {
  isAdmin?: boolean;
}

export function NotificationBell({ isAdmin = false }: NotificationBellProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [notifications, setNotifications] = React.useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = React.useState(0);
  const [isLoading, setIsLoading] = React.useState(false);
  const [filterUnreadOnly, setFilterUnreadOnly] = React.useState(false);

  // Selected content item to open in detail modal
  const [selectedContent, setSelectedContent] = React.useState<ContentDetailItem | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = React.useState(false);

  const dropdownRef = React.useRef<HTMLDivElement>(null);

  // Fetch notifications
  const fetchNotifications = React.useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await getNotificationsAction({ limit: 30 });
      if (res.success && res.data) {
        setNotifications((res.data as { notifications: NotificationItem[] }).notifications);
        setUnreadCount((res.data as { unreadCount: number }).unreadCount);
      }
    } catch (err) {
      console.error("Failed to load notifications", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // Poll or fetch on initial load
  React.useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // 30s background sync
    return () => clearInterval(interval);
  }, [fetchNotifications]);

  // Handle click outside to close dropdown
  React.useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen]);

  // Mark single as read
  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    // Optimistic instant UI update
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await markNotificationAsReadAction(id);
    } catch (err) {
      console.error("Failed to mark as read", err);
      fetchNotifications();
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    const previousNotifications = notifications;
    const previousCount = unreadCount;
    // Optimistic instant UI update
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    setUnreadCount(0);
    try {
      await markAllNotificationsAsReadAction();
    } catch (err) {
      console.error("Failed to mark all as read", err);
      setNotifications(previousNotifications);
      setUnreadCount(previousCount);
    }
  };

  // Open linked content
  const handleNotificationClick = async (notif: NotificationItem) => {
    if (!notif.isRead) {
      handleMarkAsRead(notif.id);
    }

    if (notif.contentId) {
      try {
        const res = await getContentDetailsAction(notif.contentId);
        if (res.success && res.data) {
          setSelectedContent(res.data as ContentDetailItem);
          setIsDetailModalOpen(true);
          setIsOpen(false);
        }
      } catch (err) {
        console.error("Failed to open content detail from notification", err);
      }
    }
  };

  const filteredNotifications = filterUnreadOnly
    ? notifications.filter((n) => !n.isRead)
    : notifications;

  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case "APPROVED":
        return <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0 mt-0.5" />;
      case "CHANGES_REQUESTED":
        return <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />;
      case "APPROVAL_REQUIRED":
        return <Clock className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />;
      default:
        return <Info className="h-4 w-4 text-indigo-500 shrink-0 mt-0.5" />;
    }
  };

  return (
    <>
      <div className="relative" ref={dropdownRef}>
        {/* Bell Trigger Button */}
        <button
          onClick={() => {
            setIsOpen(!isOpen);
            if (!isOpen) fetchNotifications();
          }}
          className="relative p-2 rounded-md text-zinc-600 hover:text-zinc-900 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:text-zinc-100 dark:hover:bg-zinc-800 transition"
          aria-label="Notifications"
        >
          <Bell className="h-4 w-4" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-emerald-600 px-1 text-[9px] font-bold text-white ring-2 ring-white dark:ring-zinc-900 animate-in zoom-in">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </button>

        {/* Dropdown Panel */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-xl border border-zinc-200 bg-white shadow-xl dark:border-zinc-800 dark:bg-zinc-900 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between p-3.5 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/70 dark:bg-zinc-950/70">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-900 dark:text-zinc-100">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0">
                    {unreadCount} unread
                  </Badge>
                )}
              </div>

              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllAsRead}
                    className="text-[11px] font-medium text-indigo-600 hover:text-indigo-700 dark:text-indigo-400"
                  >
                    Mark all read
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-zinc-400 hover:text-zinc-600 p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            {/* Filter Toggle */}
            <div className="flex items-center gap-2 px-3 py-1.5 border-b border-zinc-100 dark:border-zinc-800 text-[11px] bg-white dark:bg-zinc-900">
              <button
                onClick={() => setFilterUnreadOnly(false)}
                className={`px-2 py-0.5 rounded ${
                  !filterUnreadOnly
                    ? "font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                All ({notifications.length})
              </button>
              <button
                onClick={() => setFilterUnreadOnly(true)}
                className={`px-2 py-0.5 rounded ${
                  filterUnreadOnly
                    ? "font-semibold bg-zinc-100 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-800"
                }`}
              >
                Unread ({unreadCount})
              </button>
            </div>

            {/* Notification List */}
            <div className="max-h-[380px] overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800/60">
              {filteredNotifications.length === 0 ? (
                <div className="p-8 text-center text-xs text-zinc-400 space-y-1">
                  <p className="font-medium text-zinc-500 dark:text-zinc-400">
                    {filterUnreadOnly ? "No unread notifications" : "No notifications yet"}
                  </p>
                  <p className="text-[11px] text-zinc-400">
                    You're all caught up on approvals and schedule updates.
                  </p>
                </div>
              ) : (
                filteredNotifications.map((notif) => {
                  const createdAtDate = new Date(notif.createdAt);
                  const timeAgo = createdAtDate.toLocaleDateString(undefined, {
                    month: "short",
                    day: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  });

                  return (
                    <div
                      key={notif.id}
                      onClick={() => handleNotificationClick(notif)}
                      className={`p-3.5 flex items-start gap-3 hover:bg-zinc-50/80 dark:hover:bg-zinc-800/50 cursor-pointer transition text-xs ${
                        !notif.isRead
                          ? "bg-indigo-50/25 dark:bg-indigo-950/15"
                          : "bg-white dark:bg-zinc-900 opacity-80"
                      }`}
                    >
                      {getNotificationIcon(notif.type)}

                      <div className="flex-1 min-w-0 space-y-0.5">
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className={`font-semibold truncate ${
                              !notif.isRead
                                ? "text-zinc-900 dark:text-zinc-100"
                                : "text-zinc-700 dark:text-zinc-300"
                            }`}
                          >
                            {notif.title}
                          </span>
                          {!notif.isRead && (
                            <span className="h-2 w-2 rounded-full bg-indigo-600 shrink-0" />
                          )}
                        </div>

                        <p className="text-[11px] text-zinc-600 dark:text-zinc-400 leading-snug line-clamp-2 font-sans">
                          {notif.message}
                        </p>

                        <div className="flex items-center justify-between pt-1">
                          <span className="text-[10px] text-zinc-400">{timeAgo}</span>

                          {notif.contentId && (
                            <span className="text-[10px] text-indigo-600 dark:text-indigo-400 font-medium flex items-center gap-0.5">
                              <span>View Content</span>
                              <ChevronRight className="h-3 w-3" />
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Linked Content Detail Modal */}
      <ContentDetailModal
        content={selectedContent}
        isOpen={isDetailModalOpen}
        onClose={() => {
          setIsDetailModalOpen(false);
          setSelectedContent(null);
        }}
        isAdmin={isAdmin}
        onUpdate={() => {
          fetchNotifications();
        }}
      />
    </>
  );
}
