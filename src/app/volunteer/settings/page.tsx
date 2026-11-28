import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { VolunteerSettingsClient } from "@/components/VolunteerSettingsClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function VolunteerSettingsInner() {
  const user = await requirePortalSession(["volunteer"], "/volunteer/login");
  return (
    <PortalShell role="volunteer" userName={user.name}>
      <VolunteerSettingsClient />
    </PortalShell>
  );
}

export default function VolunteerSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading settings…</div>}>
      <VolunteerSettingsInner />
    </Suspense>
  );
}
