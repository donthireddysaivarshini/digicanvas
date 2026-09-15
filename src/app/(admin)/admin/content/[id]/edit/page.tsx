import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getContentById } from "@/lib/services/content-service";
import { listClients } from "@/lib/services/client-service";
import { ContentForm } from "@/components/content/content-form";
import { ChevronLeft } from "lucide-react";

interface EditContentPageProps {
  params: {
    id: string;
  };
}

export default async function EditContentPage({ params }: EditContentPageProps) {
  const session = await requireAdmin();

  let content;
  try {
    content = await getContentById(params.id, session.user);
  } catch {
    notFound();
  }

  const clients = await listClients();

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/content"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Content
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Edit Content Item
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Update schedule, social platforms, creative link, or caption text.
        </p>
      </div>

      <ContentForm organizations={clients} initialData={content} />
    </div>
  );
}
