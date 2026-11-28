"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Clock,
  FileText,
  Shield,
  Users,
} from "lucide-react";
import type { AuditLogDoc, VolunteerDoc } from "@/lib/types";

interface AdminVolRow extends VolunteerDoc {
  user?: { accountStatus: string; email: string; name: string } | null;
}

export function AdminDashboardClient() {
  const [volunteers, setVolunteers] = useState<AdminVolRow[]>([]);
  const [logs, setLogs] = useState<AuditLogDoc[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/volunteers", { cache: "no-store" }).then((r) =>
        r.json()
      ),
      fetch("/api/admin/audit", { cache: "no-store" }).then((r) => r.json()),
    ])
      .then(([vData, aData]) => {
        setVolunteers(vData.volunteers || []);
        setLogs(aData.logs || []);
      })
      .catch(() => {});
  }, []);

  const verifiedCount = volunteers.filter(
    (v) => v.verificationStatus === "Verified"
  ).length;
  const pendingCount = volunteers.filter(
    (v) =>
      v.verificationStatus === "Submitted" ||
      v.verificationStatus === "Under Review"
  ).length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#2B1324]">
            Governance &amp; Audit Overview
          </h2>
          <p className="text-sm text-[#7A566E]">
            Approve community volunteers before enabling geospatial alert
            eligibility. Demo verifications are clearly labeled.
          </p>
        </div>
        <Link
          href="/admin/volunteers"
          className="inline-flex items-center gap-2 rounded-lg bg-[#DB2777] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#BE185D] transition-colors"
        >
          Open Verification Queue
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-white border border-[#F3D5E5] p-5">
          <div className="flex items-center justify-between text-xs text-[#7A566E]">
            <span>Total Registered Volunteers</span>
            <Users className="h-4 w-4 text-[#DB2777]" />
          </div>
          <div className="mt-2 font-heading text-2xl font-semibold text-[#2B1324] tabular-nums">
            {volunteers.length}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-[#F3D5E5] p-5">
          <div className="flex items-center justify-between text-xs text-[#7A566E]">
            <span>Verified &amp; Alert-Eligible</span>
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
          </div>
          <div className="mt-2 font-heading text-2xl font-semibold text-[#2B1324] tabular-nums">
            {verifiedCount}
          </div>
        </div>

        <div className="rounded-xl bg-white border border-[#F3D5E5] p-5">
          <div className="flex items-center justify-between text-xs text-[#7A566E]">
            <span>Pending Verification Review</span>
            <Clock className="h-4 w-4 text-amber-600" />
          </div>
          <div className="mt-2 font-heading text-2xl font-semibold text-[#2B1324] tabular-nums">
            {pendingCount}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-white border border-[#F3D5E5] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold flex items-center gap-2 text-[#2B1324]">
            <Activity className="h-4 w-4 text-[#DB2777]" />
            Recent Security &amp; Governance Audit Logs
          </h3>
          <Shield className="h-4 w-4 text-[#7A566E]" />
        </div>

        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-[#7A566E]">No audit logs recorded.</p>
          ) : (
            logs.slice(0, 20).map((log, i) => (
              <div
                key={log._id || i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] px-4 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-3.5 w-3.5 text-[#DB2777]" />
                  <span className="font-mono font-semibold text-[#DB2777]">
                    {log.action}
                  </span>
                  <span className="text-[#7A566E]">
                    ({log.resourceType}: {log.resourceId})
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#7A566E] tabular-nums">
                  {log.actorRole} •{" "}
                  {new Date(log.timestamp).toLocaleTimeString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
