"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { updateClientAction, resetClientPasswordAction, ActionState } from "./actions";
import { ResetPasswordResult } from "@/lib/services/client-service";
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
  Key,
  Copy,
  Check,
  AlertTriangle,
  X,
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

  // Password reset state
  const [isResettingPassword, startResetPassword] = React.useTransition();
  const [resetResult, setResetResult] = React.useState<ResetPasswordResult | null>(null);
  const [resetError, setResetError] = React.useState<string | null>(null);
  const [copied, setCopied] = React.useState(false);

  React.useEffect(() => {
    if (state.success) {
      router.push("/admin/clients");
      router.refresh();
    }
  }, [state.success, router]);

  const handleGenerateNewPassword = () => {
    if (
      !window.confirm(
        `Are you sure you want to generate a new password for "${client.name}"?\n\nExisting active sessions for this client will be immediately revoked.`
      )
    ) {
      return;
    }

    startResetPassword(async () => {
      setResetError(null);
      setResetResult(null);
      const res = await resetClientPasswordAction(client.id);
      if (res.success && res.data) {
        setResetResult(res.data);
      } else {
        setResetError(res.error || "Failed to generate new password.");
      }
    });
  };

  const handleCopyCredentials = () => {
    if (!resetResult) return;
    const textToCopy = `DigiCanvas Client Login:\nPortal URL: ${window.location.origin}/login\nEmail: ${resetResult.user.email}\nTemporary Password: ${resetResult.temporaryPassword}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

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

      {/* One-Time Generated Password Card (Dismissible) */}
      {resetResult && (
        <Card className="border-amber-300 bg-amber-50/40 dark:border-amber-800 dark:bg-amber-950/20 shadow-md animate-in fade-in">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="flex items-center gap-2 text-amber-900 dark:text-amber-200">
              <Key className="h-5 w-5 text-amber-600" />
              <CardTitle className="text-base font-bold">New Temporary Password Generated</CardTitle>
            </div>
            <button
              type="button"
              onClick={() => setResetResult(null)}
              className="text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
              title="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2 p-2.5 rounded bg-amber-100/70 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-900 text-amber-900 dark:text-amber-200 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <span>
                <strong>One-time visibility notice:</strong> This temporary password is only displayed right now and is <strong>never stored in plaintext</strong> or shown again after you dismiss this box.
              </span>
            </div>

            <div className="p-3.5 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs space-y-1.5 border border-zinc-800">
              <div className="flex justify-between py-0.5">
                <span className="text-zinc-400">User Email:</span>
                <span className="font-semibold text-emerald-400">{resetResult.user.email}</span>
              </div>
              <div className="flex justify-between py-0.5 items-center">
                <span className="text-zinc-400">New Password:</span>
                <span className="font-bold text-amber-400 bg-zinc-800 px-2 py-0.5 rounded text-sm select-all">
                  {resetResult.temporaryPassword}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleCopyCredentials}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs h-8"
              >
                {copied ? (
                  <>
                    <Check className="h-3.5 w-3.5" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="h-3.5 w-3.5" />
                    <span>Copy New Credentials</span>
                  </>
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setResetResult(null)}
                className="text-xs h-8"
              >
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {resetError && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{resetError}</span>
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

      {/* Associated Users with Password Reset capability */}
      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-zinc-500" />
              Associated Client Users
            </CardTitle>
            <CardDescription className="text-xs">
              Portal login credentials for this client organization.
            </CardDescription>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleGenerateNewPassword}
            isLoading={isResettingPassword}
            className="text-xs h-8 flex items-center gap-1.5 border-zinc-300 dark:border-zinc-700 hover:bg-amber-50 dark:hover:bg-amber-950/30"
          >
            <Key className="h-3.5 w-3.5 text-amber-600" />
            <span>{isResettingPassword ? "Generating..." : "Generate New Password"}</span>
          </Button>
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
