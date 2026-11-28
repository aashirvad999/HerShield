import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { OperatorLocationsClient } from "@/components/OperatorLocationsClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function LocationsInner() {
  const user = await requirePortalSession(
    ["operator", "admin"],
    "/operator/login"
  );
  return (
    <PortalShell role="operator" userName={user.name}>
      <OperatorLocationsClient />
    </PortalShell>
  );
}

export default function OperatorLocationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading locations…</div>}>
      <LocationsInner />
    </Suspense>
  );
}
