import * as React from "react";
import { requireClient } from "@/lib/auth/guards";
import { getTodayAndUpcomingContent } from "@/lib/services/content-service";
import { PortalContentList } from "./portal-content-list";
import { Globe2 } from "lucide-react";

export default async function ClientPortalHomePage() {
  const session = await requireClient();
  const organization = session.user.organization!;
  const timezone = organization.timezone || "Asia/Kolkata";

  const { todayContent, upcomingContent } = await getTodayAndUpcomingContent(session.user);

  return (
    <div className="space-y-6 max-w-6xl">
      {/* Welcome Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-zinc-200 dark:border-zinc-800 pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Welcome, {organization.name}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Client Content Review & Approval Workspace
          </p>
        </div>

        <div className="flex items-center gap-1.5 text-xs text-zinc-500 bg-white dark:bg-zinc-900 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-800 shadow-sm w-fit">
          <Globe2 className="h-3.5 w-3.5 text-zinc-400" />
          <span>Organization Timezone: <strong className="text-zinc-700 dark:text-zinc-300 font-semibold">{timezone}</strong></span>
        </div>
      </div>

      {/* Main Content Dashboard */}
      <PortalContentList
        todayContent={todayContent}
        upcomingContent={upcomingContent}
        timezone={timezone}
      />
    </div>
  );
}
