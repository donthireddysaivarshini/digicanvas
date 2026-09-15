"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateClientAction, ActionState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Building2,
  Mail,
  Phone,
  Globe2,
  User,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { OrganizationStatus } from "@prisma/client";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending}>
      Save Changes
    </Button>
  );
}

const COMMON_TIMEZONES = [
  "Asia/Kolkata",
  "Asia/Dubai",
  "Asia/Singapore",
  "Europe/London",
  "America/New_York",
  "America/Chicago",
  "America/Los_Angeles",
  "Australia/Sydney",
];

interface ClientEditFormProps {
  client: {
    id: string;
    name: string;
    slug: string;
    contactEmail: string | null;
    contactPhone: string | null;
    timezone: string;
    status: OrganizationStatus;
    users: {
      id: string;
      email: string;
      name: string;
      status: string;
      lastLoginAt: Date | null;
    }[];
  };
}

export function ClientEditForm({ client }: ClientEditFormProps) {
  const router = useRouter();
  const [state, formAction] = useFormState<ActionState, FormData>(updateClientAction, {});

  React.useEffect(() => {
    if (state.success) {
      router.push("/admin/clients");
      router.refresh();
    }
  }, [state.success, router]);

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      <input type="hidden" name="id" value={client.id} />

      {state.error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {state.success && (
        <div className="flex items-center gap-2 p-3 text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-md dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>Client organization updated successfully.</span>
        </div>
      )}

      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-zinc-500" />
              Organization Profile
            </CardTitle>
            <Badge variant={client.status === "ACTIVE" ? "success" : "destructive"}>
              {client.status}
            </Badge>
          </div>
          <CardDescription>
            Slug: <code className="font-mono text-xs">{client.slug}</code> (immutable)
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="name">
              Client / Company Name *
            </label>
            <Input
              id="name"
              name="name"
              defaultValue={client.name}
              required
              error={state.fieldErrors?.name?.[0]}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="contactEmail">
                Contact Email
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  id="contactEmail"
                  name="contactEmail"
                  type="email"
                  defaultValue={client.contactEmail || ""}
                  className="pl-9"
                  error={state.fieldErrors?.contactEmail?.[0]}
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="contactPhone">
                Contact Phone
              </label>
              <div className="relative">
                <Phone className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <Input
                  id="contactPhone"
                  name="contactPhone"
                  type="tel"
                  defaultValue={client.contactPhone || ""}
                  className="pl-9"
                  error={state.fieldErrors?.contactPhone?.[0]}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="timezone">
                Organization Timezone *
              </label>
              <div className="relative">
                <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
                <select
                  id="timezone"
                  name="timezone"
                  defaultValue={client.timezone}
                  className="flex h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
                >
                  {COMMON_TIMEZONES.map((tz) => (
                    <option key={tz} value={tz}>
                      {tz}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="status">
                Account Status *
              </label>
              <select
                id="status"
                name="status"
                defaultValue={client.status}
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
              >
                <option value="ACTIVE">ACTIVE (Portal Access Enabled)</option>
                <option value="INACTIVE">INACTIVE (Portal Access Blocked)</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Associated Users (Read-only overview) */}
      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-zinc-500" />
            Associated Client Users
          </CardTitle>
          <CardDescription>Accounts provisioned for this organization.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="divide-y divide-zinc-200 dark:divide-zinc-800 border border-zinc-200 dark:border-zinc-800 rounded-md">
            {client.users.map((u) => (
              <div key={u.id} className="p-3 flex items-center justify-between text-xs">
                <div>
                  <div className="font-semibold text-zinc-900 dark:text-zinc-100">{u.name}</div>
                  <div className="text-zinc-500 font-mono text-[11px]">{u.email}</div>
                </div>
                <div className="text-right">
                  <Badge variant={u.status === "ACTIVE" ? "success" : "destructive"} className="text-[10px]">
                    {u.status}
                  </Badge>
                  {u.lastLoginAt && (
                    <div className="text-[10px] text-zinc-400 mt-0.5">
                      Last login: {new Date(u.lastLoginAt).toLocaleDateString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex items-center justify-end gap-3 pt-2">
        <Link href="/admin/clients">
          <Button type="button" variant="outline">
            Cancel
          </Button>
        </Link>
        <SubmitButton />
      </div>
    </form>
  );
}
