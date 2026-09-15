import * as React from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/auth/guards";
import { getClientById } from "@/lib/services/client-service";
import { ClientEditForm } from "../../client-edit-form";
import { ChevronLeft } from "lucide-react";

interface EditClientPageProps {
  params: {
    id: string;
  };
}

export default async function EditClientPage({ params }: EditClientPageProps) {
  await requireAdmin();

  let client;
  try {
    client = await getClientById(params.id);
  } catch {
    notFound();
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <Link
          href="/admin/clients"
          className="inline-flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 mb-2 transition"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back to Clients
        </Link>
        <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          Edit Client Organization
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Update profile settings, timezone, and portal status for {client.name}.
        </p>
      </div>

      <ClientEditForm client={client} />
    </div>
  );
}
