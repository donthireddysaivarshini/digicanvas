import { redirect } from "next/navigation";
import { getCurrentSession } from "@/lib/auth/session";
import { Role } from "@prisma/client";
import { LoginForm } from "./login-form";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Layers } from "lucide-react";

export default async function LoginPage() {
  const session = await getCurrentSession();

  if (session) {
    if (session.user.role === Role.CLIENT) {
      redirect("/portal");
    } else {
      redirect("/admin");
    }
  }

  const isDevelopment = process.env.NODE_ENV === "development";

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-8 bg-zinc-50 dark:bg-zinc-950">
      <div className="w-full max-w-md space-y-6">
        <div className="flex flex-col items-center space-y-2 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-900 shadow-sm">
            <Layers className="h-5 w-5" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-50">
            DigiCanvas Portal
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Client Content Management & Approval System
          </p>
        </div>

        <Card className="border border-zinc-200/80 shadow-sm dark:border-zinc-800">
          <CardHeader className="space-y-1 pb-4">
            <CardTitle className="text-lg font-semibold">Sign in to your account</CardTitle>
            <CardDescription className="text-xs">
              Enter your agency-assigned credentials to continue
            </CardDescription>
          </CardHeader>
          <CardContent>
            <LoginForm isDevelopment={isDevelopment} />
          </CardContent>
        </Card>

        <p className="text-center text-xs text-zinc-400 dark:text-zinc-600">
          Secure, tenant-isolated content workspace • DigiCanvas
        </p>
      </div>
    </div>
  );
}
