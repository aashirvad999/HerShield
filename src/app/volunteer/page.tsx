import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { VolunteerDashboardClient } from "@/components/VolunteerDashboardClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function VolunteerInner() {
  const user = await requirePortalSession(["volunteer"], "/volunteer/login");
  return (
    <PortalShell role="volunteer" userName={user.name}>
      <VolunteerDashboardClient />
    </PortalShell>
  );
}

export default function VolunteerDashboardPage() {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm">Loading volunteer portal…</div>}
    >
      <VolunteerInner />
    </Suspense>
  );
}
