import * as React from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { ClientCreateForm } from "../client-create-form";
import { ChevronLeft } from "lucide-react";

export default async function NewClientPage() {
  await requireAdmin();

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
          Add New Client Organization
        </h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
          Create a tenant organization and provision primary portal login credentials.
        </p>
      </div>

      <ClientCreateForm />
    </div>
  );
}
