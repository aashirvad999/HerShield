import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { OperatorIncidentReviewClient } from "@/components/OperatorIncidentReviewClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function OperatorIncidentInner({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  const user = await requirePortalSession(
    ["operator", "admin"],
    "/operator/login"
  );
  const { incidentId } = await params;

  return (
    <PortalShell role="operator" userName={user.name}>
      <OperatorIncidentReviewClient incidentId={incidentId} />
    </PortalShell>
  );
}

export default function OperatorIncidentReviewPage({
  params,
}: {
  params: Promise<{ incidentId: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[#38203F]">
          Loading incident review…
        </div>
      }
    >
      <OperatorIncidentInner params={params} />
    </Suspense>
  );
}
