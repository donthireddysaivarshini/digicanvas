import * as React from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { listContent } from "@/lib/services/content-service";
import { listClients } from "@/lib/services/client-service";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ContentTable } from "./content-table";
import { ContentFilters } from "./content-filters";
import { Plus, Layers, Calendar } from "lucide-react";
import { Platform, ContentType, ApprovalStatus, PublishingStatus } from "@prisma/client";

interface ContentPageProps {
  searchParams: {
    organizationId?: string;
    contentType?: ContentType;
    platform?: Platform;
    publishingStatus?: PublishingStatus;
    approvalStatus?: ApprovalStatus;
  };
}

export default async function AdminContentPage({ searchParams }: ContentPageProps) {
  const session = await requireAdmin();

  const [contents, clients] = await Promise.all([
    listContent(searchParams, session.user),
    listClients(),
  ]);

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Content Management
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Create, schedule, filter, and manage social media content for all client organizations.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Link href="/admin/calendar">
            <Button variant="outline" className="flex items-center gap-1.5 shadow-sm text-xs">
              <Calendar className="h-4 w-4" />
              <span>Calendar View</span>
            </Button>
          </Link>

          <Link href="/admin/content/new">
            <Button className="flex items-center gap-1.5 shadow-sm text-xs">
              <Plus className="h-4 w-4" />
              <span>Schedule Content</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Filter Bar */}
      <ContentFilters organizations={clients} />

      {/* Content Table / Empty State */}
      {contents.length === 0 ? (
        <Card className="border-dashed border-zinc-200 dark:border-zinc-800">
          <CardContent className="flex flex-col items-center justify-center py-14 text-center">
            <Layers className="h-10 w-10 text-zinc-400 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">
              No content items found
            </h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
              There is no content matching the selected filters. Create a new content item or reset your filter selection.
            </p>
            <Link href="/admin/content/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Schedule New Content
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <ContentTable contents={contents} />
      )}
    </div>
  );
}
