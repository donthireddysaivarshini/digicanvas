"use client";

import * as React from "react";
import { useFormState, useFormStatus } from "react-dom";
import { loginAction, FormState } from "../actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Lock, Mail, AlertCircle } from "lucide-react";

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full mt-2" isLoading={pending}>
      Sign In
    </Button>
  );
}

interface LoginFormProps {
  isDevelopment: boolean;
}

export function LoginForm({ isDevelopment }: LoginFormProps) {
  const [state, formAction] = useFormState<FormState, FormData>(loginAction, {});
  const [demoEmail, setDemoEmail] = React.useState("");
  const [demoPassword, setDemoPassword] = React.useState("");

  const applyCredentials = (email: string, pass: string) => {
    setDemoEmail(email);
    setDemoPassword(pass);
  };

  return (
    <div className="space-y-6">
      <form action={formAction} className="space-y-4">
        {state?.error && (
          <div className="flex items-center gap-2 p-3 text-sm text-red-700 bg-red-50 border border-red-200 rounded-md dark:bg-red-950/40 dark:text-red-400 dark:border-red-900">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{state.error}</span>
          </div>
        )}

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="email">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="email"
              name="email"
              type="email"
              placeholder="you@company.com"
              required
              autoComplete="email"
              className="pl-9"
              value={demoEmail ? demoEmail : undefined}
              onChange={(e) => setDemoEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-zinc-700 dark:text-zinc-300" htmlFor="password">
              Password
            </label>
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input
              id="password"
              name="password"
              type="password"
              placeholder="••••••••"
              required
              autoComplete="current-password"
              className="pl-9"
              value={demoPassword ? demoPassword : undefined}
              onChange={(e) => setDemoPassword(e.target.value)}
            />
          </div>
        </div>

        <SubmitButton />
      </form>

      {/* Development-Only Demo Credentials Helper */}
      {isDevelopment && (
        <div className="pt-4 mt-6 border-t border-zinc-200 dark:border-zinc-800">
          <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-2">
            Local Dev Seed Logins (Development Only)
          </p>
          <div className="grid grid-cols-1 gap-2 text-xs">
            <button
              type="button"
              onClick={() => applyCredentials("admin@digicanvas.local", "AdminPass123!")}
              className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-left"
            >
              <span>
                <strong className="block text-zinc-900 dark:text-zinc-100">Agency Admin</strong>
                <span className="text-zinc-500 text-[11px]">admin@digicanvas.local</span>
              </span>
              <span className="text-zinc-400 text-[11px]">Click to autofill</span>
            </button>
            <button
              type="button"
              onClick={() => applyCredentials("kura@kurahomes.local", "ClientPass123!")}
              className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-left"
            >
              <span>
                <strong className="block text-zinc-900 dark:text-zinc-100">Client: Kura Homes</strong>
                <span className="text-zinc-500 text-[11px]">kura@kurahomes.local</span>
              </span>
              <span className="text-zinc-400 text-[11px]">Click to autofill</span>
            </button>
            <button
              type="button"
              onClick={() => applyCredentials("apex@apexretail.local", "ClientPass123!")}
              className="flex items-center justify-between p-2 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700 transition text-left"
            >
              <span>
                <strong className="block text-zinc-900 dark:text-zinc-100">Client: Apex Retail</strong>
                <span className="text-zinc-500 text-[11px]">apex@apexretail.local</span>
              </span>
              <span className="text-zinc-400 text-[11px]">Click to autofill</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
