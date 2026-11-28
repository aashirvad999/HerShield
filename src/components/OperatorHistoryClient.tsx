"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Filter, Search } from "lucide-react";
import { ConfidenceBadge, IncidentStatusBadge } from "./StatusBadges";
import type { IncidentDoc } from "@/lib/types";

type IncidentRow = IncidentDoc & {
  notificationSummary?: {
    totalNotified: number;
    telegramSent: number;
    accepted: number;
  };
};

export function OperatorHistoryClient() {
  const [incidents, setIncidents] = useState<IncidentRow[]>([]);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    if (typeFilter !== "all") params.set("type", typeFilter);
    if (statusFilter !== "all") params.set("status", statusFilter);

    fetch(`/api/incidents?${params.toString()}`, { cache: "no-store" })
      .then((r) => r.json())
      .then((d) => {
        setIncidents(d.incidents || []);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [query, typeFilter, statusFilter]);

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-heading text-xl font-semibold text-[#2B1324]">
          Incident History
        </h2>
        <p className="text-sm text-[#7A566E]">
          Searchable log of AI-detected incidents, PrivacyShield previews, and
          volunteer dispatch responses.
        </p>
      </div>

      <div className="rounded-xl border border-[#F3D5E5] bg-white p-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px]">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-[#A99AAF]" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by ID, area, or explanation…"
            className="w-full rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] py-2 pl-9 pr-3 text-sm text-[#2B1324] placeholder-[#A99CAF] outline-none focus:border-[#BEA3E4]"
          />
        </div>

        <div className="flex items-center gap-2 text-xs">
          <Filter className="h-4 w-4 text-[#DB2777]" />
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] px-3 py-2 text-[#2B1324] outline-none"
          >
            <option value="all">All Incident Types</option>
            <option value="potential_aggression">Potential Aggression</option>
            <option value="potential_slap">Potential Slap / Strike</option>
            <option value="potential_harassment">Potential Harassment</option>
            <option value="potential_chain_snatching">
              Potential Chain-Snatching
            </option>
            <option value="suspected_collapse">Suspected Collapse</option>
            <option value="chest_clutching_warning">
              Chest-Clutching Warning
            </option>
            <option value="chain_snatching_demo">Chain-Snatching Demo</option>
            <option value="vehicle_pedestrian_demo">
              Vehicle / Pedestrian Demo
            </option>
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] px-3 py-2 text-[#2B1324] outline-none"
          >
            <option value="all">All Statuses</option>
            <option value="open">Open</option>
            <option value="dispatched">Dispatched</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="closed">Closed</option>
          </select>
        </div>
      </div>

      <div className="rounded-xl border border-[#F3D5E5] bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="border-b border-[#F3D5E5] bg-[#FFF7FA] text-xs font-medium text-[#7A566E]">
              <tr>
                <th className="px-4 py-3">Incident</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Confidence</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Responses</th>
                <th className="px-4 py-3">Detected</th>
                <th className="px-4 py-3 text-right">Review</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#3D2B35]">
              {loading ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-xs text-[#7A566E]"
                  >
                    Loading incident records…
                  </td>
                </tr>
              ) : incidents.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-4 py-8 text-center text-xs text-[#7A566E]"
                  >
                    No incidents match the selected filters.
                  </td>
                </tr>
              ) : (
                incidents.map((inc) => (
                  <tr
                    key={inc.incidentId}
                    className="hover:bg-[#FFF7FA] transition-colors"
                  >
                    <td className="px-4 py-3.5">
                      <div className="font-medium text-[#2B1324]">
                        {inc.incidentTitle}
                      </div>
                      <div className="font-mono text-xs text-[#DB2777]">
                        {inc.incidentId} • {inc.cameraSource}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#7A566E]">
                      {inc.incidentLocation.areaName}
                    </td>
                    <td className="px-4 py-3.5">
                      <ConfidenceBadge
                        score={inc.incidentConfidence}
                        type={inc.confidenceType}
                      />
                    </td>
                    <td className="px-4 py-3.5">
                      <IncidentStatusBadge status={inc.incidentStatus} />
                    </td>
                    <td className="px-4 py-3.5 text-xs text-[#7A566E] tabular-nums">
                      {inc.notificationSummary
                        ? `${inc.notificationSummary.accepted}/${inc.notificationSummary.totalNotified} accepted`
                        : "—"}
                    </td>
                    <td className="px-4 py-3.5 font-mono text-xs text-[#7A566E] tabular-nums">
                      {new Date(inc.detectedAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3.5 text-right">
                      <Link
                        href={`/operator/incidents/${inc.incidentId}`}
                        className="inline-flex items-center gap-1 text-xs font-medium text-[#DB2777] hover:text-[#DB2777]"
                      >
                        Inspect
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
