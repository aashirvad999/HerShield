import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { OperatorHistoryClient } from "@/components/OperatorHistoryClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function HistoryInner() {
  const user = await requirePortalSession(
    ["operator", "admin"],
    "/operator/login"
  );
  return (
    <PortalShell role="operator" userName={user.name}>
      <OperatorHistoryClient />
    </PortalShell>
  );
}

export default function OperatorHistoryPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading history…</div>}>
      <HistoryInner />
    </Suspense>
  );
}
