import * as React from "react";
import Link from "next/link";
import { requireAdmin } from "@/lib/auth/guards";
import { listClients } from "@/lib/services/client-service";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ClientStatusButton } from "./client-status-button";
import { Plus, Building2, Mail, Phone, Globe2, Edit3, Users } from "lucide-react";

export default async function ClientsPage() {
  await requireAdmin();
  const clients = await listClients();

  return (
    <div className="max-w-6xl space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            Clients
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-0.5">
            Manage your client organizations and their portal credentials.
          </p>
        </div>
        <Link href="/admin/clients/new">
          <Button className="flex items-center gap-1.5 shadow-sm">
            <Plus className="h-4 w-4" />
            <span>Add Client</span>
          </Button>
        </Link>
      </div>

      {/* Client List Table / Cards */}
      {clients.length === 0 ? (
        <Card className="border-dashed border-zinc-200 dark:border-zinc-800">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Building2 className="h-10 w-10 text-zinc-400 mb-3" />
            <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No clients yet</h3>
            <p className="text-xs text-zinc-500 max-w-sm mt-1 mb-4">
              Get started by creating your first client organization and setting up their portal access.
            </p>
            <Link href="/admin/clients/new">
              <Button size="sm">
                <Plus className="h-3.5 w-3.5 mr-1" />
                Add Client
              </Button>
            </Link>
          </CardContent>
        </Card>
      ) : (
        <div className="border border-zinc-200 dark:border-zinc-800 rounded-lg overflow-hidden bg-white dark:bg-zinc-900 shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800 text-xs uppercase tracking-wider text-zinc-500 font-medium">
                <tr>
                  <th className="py-3.5 px-4 font-semibold">Client / Company</th>
                  <th className="py-3.5 px-4 font-semibold">Contact</th>
                  <th className="py-3.5 px-4 font-semibold">Primary Login</th>
                  <th className="py-3.5 px-4 font-semibold">Timezone</th>
                  <th className="py-3.5 px-4 font-semibold">Status</th>
                  <th className="py-3.5 px-4 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
                {clients.map((client) => {
                  const primaryUser = client.users[0];
                  const isActive = client.status === "ACTIVE";

                  return (
                    <tr
                      key={client.id}
                      className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition"
                    >
                      {/* Name & Slug */}
                      <td className="py-4 px-4 align-top">
                        <div className="font-semibold text-zinc-900 dark:text-zinc-100">
                          {client.name}
                        </div>
                        <div className="text-xs text-zinc-400 font-mono mt-0.5">
                          slug: {client.slug}
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-4 px-4 align-top text-xs text-zinc-600 dark:text-zinc-400 space-y-1">
                        {client.contactEmail && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span className="truncate max-w-[180px]">{client.contactEmail}</span>
                          </div>
                        )}
                        {client.contactPhone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="h-3.5 w-3.5 text-zinc-400 shrink-0" />
                            <span>{client.contactPhone}</span>
                          </div>
                        )}
                        {!client.contactEmail && !client.contactPhone && (
                          <span className="text-zinc-400">—</span>
                        )}
                      </td>

                      {/* Primary User Account */}
                      <td className="py-4 px-4 align-top text-xs">
                        {primaryUser ? (
                          <div>
                            <div className="font-medium text-zinc-900 dark:text-zinc-100 flex items-center gap-1.5">
                              <Users className="h-3.5 w-3.5 text-zinc-400" />
                              <span>{primaryUser.name}</span>
                            </div>
                            <div className="text-zinc-500 truncate max-w-[200px] mt-0.5">
                              {primaryUser.email}
                            </div>
                          </div>
                        ) : (
                          <span className="text-zinc-400">No user assigned</span>
                        )}
                      </td>

                      {/* Timezone */}
                      <td className="py-4 px-4 align-top text-xs text-zinc-600 dark:text-zinc-400">
                        <span className="inline-flex items-center gap-1">
                          <Globe2 className="h-3.5 w-3.5 text-zinc-400" />
                          {client.timezone}
                        </span>
                      </td>

                      {/* Status Badge */}
                      <td className="py-4 px-4 align-top">
                        {isActive ? (
                          <Badge variant="success" className="text-[11px]">
                            ACTIVE
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="text-[11px]">
                            INACTIVE
                          </Badge>
                        )}
                      </td>

                      {/* Actions */}
                      <td className="py-4 px-4 align-top text-right space-x-2">
                        <Link href={`/admin/clients/${client.id}/edit`}>
                          <Button variant="outline" size="sm" className="text-xs">
                            <Edit3 className="h-3.5 w-3.5 mr-1" />
                            Edit
                          </Button>
                        </Link>
                        <ClientStatusButton
                          organizationId={client.id}
                          clientName={client.name}
                          currentStatus={client.status}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
