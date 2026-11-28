import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { dispatchIncidentAlerts } from "@/lib/dispatch";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ incidentId: string }> }
) {
  const user = await getSessionUser();
  if (!user || (user.role !== "operator" && user.role !== "admin")) {
    return NextResponse.json(
      { error: "Operator or Admin access required to dispatch alerts." },
      { status: 403 }
    );
  }

  const { incidentId } = await params;
  const body = (await request.json().catch(() => ({}))) as {
    selectedVolunteerIds?: string[];
    maxDistanceMeters?: number;
  };

  const result = await dispatchIncidentAlerts({
    incidentId,
    actorId: user.userId,
    actorRole: user.role,
    selectedVolunteerIds: body.selectedVolunteerIds,
    maxDistanceMeters: body.maxDistanceMeters,
    isAutoDispatch: false,
  });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
        notifications: result.notifications,
      },
      { status: result.error === "Incident not found." ? 404 : 400 }
    );
  }

  return NextResponse.json({
    ok: true,
    dispatchedCount: result.dispatchedCount,
    telegramSentCount: result.telegramSentCount,
    notifications: result.notifications,
  });
}
