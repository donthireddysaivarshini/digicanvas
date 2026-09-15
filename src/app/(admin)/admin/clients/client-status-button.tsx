"use client";

import * as React from "react";
import { toggleClientStatusAction } from "./actions";
import { Button } from "@/components/ui/button";
import { PowerOff, Power } from "lucide-react";
import { OrganizationStatus } from "@prisma/client";

interface ClientStatusButtonProps {
  organizationId: string;
  clientName: string;
  currentStatus: OrganizationStatus;
}

export function ClientStatusButton({
  organizationId,
  clientName,
  currentStatus,
}: ClientStatusButtonProps) {
  const [isPending, startTransition] = React.useTransition();

  const handleToggle = () => {
    const isDeactivating = currentStatus === OrganizationStatus.ACTIVE;
    const confirmMessage = isDeactivating
      ? `Are you sure you want to deactivate "${clientName}"?\n\nClient users will be immediately locked out and active sessions will be terminated.`
      : `Reactivate client "${clientName}"? Users will be allowed to log in again.`;

    if (!window.confirm(confirmMessage)) {
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.set("organizationId", organizationId);
      formData.set("status", isDeactivating ? "INACTIVE" : "ACTIVE");
      await toggleClientStatusAction(formData);
    });
  };

  if (currentStatus === OrganizationStatus.ACTIVE) {
    return (
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleToggle}
        isLoading={isPending}
        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 border-zinc-200 dark:border-zinc-800 dark:text-red-400"
      >
        <PowerOff className="h-3.5 w-3.5 mr-1.5" />
        Deactivate
      </Button>
    );
  }

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={handleToggle}
      isLoading={isPending}
      className="text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 border-zinc-200 dark:border-zinc-800 dark:text-emerald-400"
    >
      <Power className="h-3.5 w-3.5 mr-1.5" />
      Reactivate
    </Button>
  );
}
