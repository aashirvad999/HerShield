import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { getDataContext } from "@/lib/data-access";
import type { AuditLogDoc } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser("admin");
  if (!user || user.role !== "admin") {
    return NextResponse.json(
      { error: "Administrator access required." },
      { status: 403 }
    );
  }

  const ctx = await getDataContext();
  let logs: AuditLogDoc[] = [];
  if (ctx.db) {
    logs = await ctx.db
      .collection<AuditLogDoc>("auditLogs")
      .find({})
      .sort({ timestamp: -1 })
      .limit(80)
      .toArray();
  } else if (ctx.fallback) {
    logs = [...ctx.fallback.auditLogs].slice(0, 80);
  }

  return NextResponse.json({ logs, dbMode: ctx.mode, dbNotice: ctx.notice });
}
