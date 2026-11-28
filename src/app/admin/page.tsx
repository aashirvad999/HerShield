import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { AdminDashboardClient } from "@/components/AdminDashboardClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function AdminInner() {
  const user = await requirePortalSession(["admin"], "/admin/login");
  return (
    <PortalShell
      role="admin"
      userName={user.name}
      pageTitle="Administrator Overview"
    >
      <AdminDashboardClient />
    </PortalShell>
  );
}

export default function AdminDashboardPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm">Loading admin overview…</div>}
    >
      <AdminInner />
    </Suspense>
  );
}
