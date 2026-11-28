import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { AdminVolunteersClient } from "@/components/AdminVolunteersClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function AdminVolunteersInner() {
  const user = await requirePortalSession(["admin"], "/admin/login");
  return (
    <PortalShell role="admin" userName={user.name}>
      <AdminVolunteersClient />
    </PortalShell>
  );
}

export default function AdminVolunteersPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm">Loading volunteer queue…</div>}
    >
      <AdminVolunteersInner />
    </Suspense>
  );
}
