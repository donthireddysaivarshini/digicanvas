"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import Link from "next/link";
import { createClientAction, ActionState } from "./actions";
import { CreateClientResult } from "@/lib/services/client-service";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Building2,
  Mail,
  Phone,
  Globe2,
  User,
  Key,
  Copy,
  Check,
  AlertTriangle,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" isLoading={pending} className="min-w-[140px]">
      Create Client Account
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

export function ClientCreateForm() {
  const [state, formAction] = useFormState<ActionState<CreateClientResult>, FormData>(
    createClientAction,
    {}
  );

  const [name, setName] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [slugManuallyEdited, setSlugManuallyEdited] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  // Auto-slug generation from name
  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setName(val);
    if (!slugManuallyEdited) {
      const generated = val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
      setSlug(generated);
    }
  };

  const handleCopyCredentials = () => {
    if (!state.data) return;
    const textToCopy = `DigiCanvas Client Login:\nPortal URL: ${window.location.origin}/login\nEmail: ${state.data.user.email}\nTemporary Password: ${state.data.temporaryPassword}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  // If client created successfully, display one-time credentials card
  if (state.success && state.data) {
    const { organization, user, temporaryPassword } = state.data;

    return (
      <Card className="border-emerald-200 bg-emerald-50/20 dark:border-emerald-900/50 dark:bg-emerald-950/10 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2 text-emerald-700 dark:text-emerald-400">
            <Check className="h-5 w-5" />
            <CardTitle className="text-lg">Client Organization Created Successfully</CardTitle>
          </div>
          <CardDescription className="text-zinc-600 dark:text-zinc-400">
            Provide these credentials to the client. The temporary password is generated securely.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-5">
          {/* Warning Banner */}
          <div className="flex items-start gap-2.5 p-3 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
            <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
            <div>
              <strong>One-Time Password Notice:</strong> This temporary password will{" "}
              <strong>never be shown again</strong>. Copy it now and provide it to the client.
            </div>
          </div>

          {/* Credentials Display Box */}
          <div className="p-4 rounded-lg bg-zinc-900 text-zinc-100 font-mono text-xs space-y-2 border border-zinc-800">
            <div className="text-zinc-400 text-[11px] pb-1 border-b border-zinc-800 uppercase tracking-wider font-sans">
              Client Portal Credentials
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Organization:</span>
              <span className="font-semibold">{organization.name} ({organization.slug})</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-zinc-400">Login Email:</span>
              <span className="font-semibold text-emerald-400">{user.email}</span>
            </div>
            <div className="flex justify-between py-1 items-center">
              <span className="text-zinc-400">Temporary Password:</span>
              <span className="font-bold text-amber-400 bg-zinc-800 px-2 py-0.5 rounded text-sm select-all">
                {temporaryPassword}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleCopyCredentials}
              className="w-full sm:w-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {copied ? (
                <>
                  <Check className="h-4 w-4" />
                  <span>Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4" />
                  <span>Copy Credentials</span>
                </>
              )}
            </Button>
            <Link href="/admin/clients" className="w-full sm:w-auto">
              <Button variant="outline" className="w-full sm:w-auto flex items-center gap-2">
                <span>View Clients List</span>
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <form action={formAction} className="space-y-6 max-w-2xl">
      {state.error && (
        <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{state.error}</span>
        </div>
      )}

      {/* Organization Details Section */}
      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <Building2 className="h-4 w-4 text-zinc-500" />
            Organization Details
          </CardTitle>
          <CardDescription>The company/brand profile for this client tenant.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="name">
                Client / Company Name *
              </label>
              <Input
                id="name"
                name="name"
                placeholder="e.g. Kura Homes"
                required
                value={name}
                onChange={handleNameChange}
                error={state.fieldErrors?.name?.[0]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="slug">
                Unique Slug *
              </label>
              <Input
                id="slug"
                name="slug"
                placeholder="e.g. kura-homes"
                required
                value={slug}
                onChange={(e) => {
                  setSlug(e.target.value);
                  setSlugManuallyEdited(true);
                }}
                error={state.fieldErrors?.slug?.[0]}
              />
            </div>
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
                  placeholder="contact@company.com"
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
                  placeholder="+91 98765 43210"
                  className="pl-9"
                  error={state.fieldErrors?.contactPhone?.[0]}
                />
              </div>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="timezone">
              Organization Timezone *
            </label>
            <div className="relative">
              <Globe2 className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
              <select
                id="timezone"
                name="timezone"
                defaultValue="Asia/Kolkata"
                className="flex h-9 w-full rounded-md border border-zinc-200 bg-white pl-9 pr-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:focus-visible:ring-zinc-300"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz} value={tz}>
                    {tz}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[11px] text-zinc-500">
              Content calendars and scheduled times will be interpreted in this timezone.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Primary User Account Section */}
      <Card className="border border-zinc-200 dark:border-zinc-800">
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-zinc-500" />
            Primary Client User Login
          </CardTitle>
          <CardDescription>
            The initial credentials used by the client to sign in to their portal.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="userName">
                User Full Name *
              </label>
              <Input
                id="userName"
                name="userName"
                placeholder="e.g. Rahul Sharma"
                required
                error={state.fieldErrors?.userName?.[0]}
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="userEmail">
                Login Email *
              </label>
              <Input
                id="userEmail"
                name="userEmail"
                type="email"
                placeholder="rahul@kurahomes.in"
                required
                error={state.fieldErrors?.userEmail?.[0]}
              />
            </div>
          </div>

          <div className="p-3 rounded-md bg-zinc-50 dark:bg-zinc-950 border border-zinc-200/70 dark:border-zinc-800 text-xs text-zinc-600 dark:text-zinc-400 flex items-center gap-2.5">
            <Key className="h-4 w-4 text-zinc-400 shrink-0" />
            <span>
              A secure system-generated temporary password will be created automatically and revealed upon submission.
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Form Buttons */}
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
