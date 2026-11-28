import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { OperatorDashboardClient } from "@/components/OperatorDashboardClient";
import { requirePortalSession } from "@/lib/portal-auth";

async function OperatorPageInner() {
  const user = await requirePortalSession(
    ["operator", "admin"],
    "/operator/login"
  );
  return (
    <PortalShell role="operator" userName={user.name}>
      <OperatorDashboardClient />
    </PortalShell>
  );
}

export default function OperatorDashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="p-8 text-sm text-[#38203F]">
          Loading HerShield Operator Console…
        </div>
      }
    >
      <OperatorPageInner />
    </Suspense>
  );
}
