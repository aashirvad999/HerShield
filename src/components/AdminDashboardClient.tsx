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
          <h2 className="font-heading text-xl font-semibold text-[#F8F2F7]">
            Governance &amp; Audit Overview
          </h2>
          <p className="text-sm text-[#A99CAF]">
            Approve community volunteers before enabling geospatial alert
            eligibility. Demo verifications are clearly labeled.
          </p>
        </div>
        <Link
          href="/admin/volunteers"
          className="inline-flex items-center gap-2 rounded-lg bg-[#D946A8] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#c13592] transition-colors"
        >
          Open Verification Queue
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-5">
          <div className="flex items-center justify-between text-xs text-[#A99CAF]">
            <span>Total Registered Volunteers</span>
            <Users className="h-4 w-4 text-[#BEA3E4]" />
          </div>
          <div className="mt-2 font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
            {volunteers.length}
          </div>
        </div>

        <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-5">
          <div className="flex items-center justify-between text-xs text-[#A99CAF]">
            <span>Verified &amp; Alert-Eligible</span>
            <CheckCircle2 className="h-4 w-4 text-[#4EDEA3]" />
          </div>
          <div className="mt-2 font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
            {verifiedCount}
          </div>
        </div>

        <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-5">
          <div className="flex items-center justify-between text-xs text-[#A99CAF]">
            <span>Pending Verification Review</span>
            <Clock className="h-4 w-4 text-[#FFB95F]" />
          </div>
          <div className="mt-2 font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
            {pendingCount}
          </div>
        </div>
      </div>

      <div className="rounded-xl bg-[#211829] border border-[#3D2B35] p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-heading text-base font-semibold flex items-center gap-2 text-[#F8F2F7]">
            <Activity className="h-4 w-4 text-[#D946A8]" />
            Recent Security &amp; Governance Audit Logs
          </h3>
          <Shield className="h-4 w-4 text-[#A99CAF]" />
        </div>

        <div className="space-y-2 max-h-[380px] overflow-y-auto pr-1">
          {logs.length === 0 ? (
            <p className="text-xs text-[#A99CAF]">No audit logs recorded.</p>
          ) : (
            logs.slice(0, 20).map((log, i) => (
              <div
                key={log._id || i}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#3D2B35] bg-[#241C2E] px-4 py-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5">
                  <FileText className="h-3.5 w-3.5 text-[#BEA3E4]" />
                  <span className="font-mono font-semibold text-[#FFAEDA]">
                    {log.action}
                  </span>
                  <span className="text-[#A99CAF]">
                    ({log.resourceType}: {log.resourceId})
                  </span>
                </div>
                <div className="font-mono text-[11px] text-[#A99CAF] tabular-nums">
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
