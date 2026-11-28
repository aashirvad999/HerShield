import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { VolunteerIncidentClient } from "@/components/VolunteerIncidentClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function VolunteerIncidentInner({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const user = await requirePortalSession(["volunteer"], "/volunteer/login");
  const { incidentId } = await params;

  return (
    <PortalShell role="volunteer" userName={user.name}>
      <VolunteerIncidentClient incidentId={incidentId} />
    </PortalShell>
  );
}

export default function VolunteerIncidentPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  return (
    <Suspense
      fallback={<div className="p-8 text-sm">Loading incident alert…</div>}
    >
      <VolunteerIncidentInner params={params} />
    </Suspense>
  );
}
