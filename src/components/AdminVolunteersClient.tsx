"use client";

import React, { useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Ban,
  CheckCircle2,
  Clock,
  FileCheck,
  FileCheck2,
  Hourglass,
  Search,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { VerificationBadge } from "./StatusBadges";
import type {
  VerificationStatus,
  VolunteerApplicationDoc,
  VolunteerDoc,
} from "@/lib/types";

interface AdminVolRow extends VolunteerDoc {
  user?: {
    _id: string;
    name: string;
    email: string;
    accountStatus: "active" | "suspended" | "pending";
  } | null;
  application?: VolunteerApplicationDoc | null;
}

type FilterOption = "All" | "Pending" | "Under Review" | "Verified" | "Rejected";

export function AdminVolunteersClient() {
  const [rows, setRows] = useState<AdminVolRow[]>([]);
  const [filter, setFilter] = useState<FilterOption>("All");
  const [search, setSearch] = useState("");
  const [activeRow, setActiveRow] = useState<AdminVolRow | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const loadVolunteers = useCallback(async () => {
    const res = await fetch("/api/admin/volunteers", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      setRows(data.volunteers || []);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadVolunteers();
    }, 0);
    return () => clearTimeout(t);
  }, [loadVolunteers]);

  async function updateStatus(params: {
    userId: string;
    verificationStatus: VerificationStatus;
    alertEligible: boolean;
    accountStatus?: "active" | "suspended";
  }) {
    setBusyId(params.userId);
    setFeedback(null);
    const notes =
      reviewNotes.trim() ||
      `Manual admin decision: ${params.verificationStatus} (Prototype verification workflow).`;

    const res = await fetch("/api/admin/volunteers", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...params,
        reviewNotes: notes,
      }),
    });
    setBusyId(null);
    if (res.ok) {
      setFeedback(
        `Updated volunteer ${params.userId} to ${params.verificationStatus}.`
      );
      setActiveRow(null);
      await loadVolunteers();
    } else {
      setFeedback("Failed to update volunteer verification record.");
    }
  }

  const pendingCount = rows.filter(
    (r) => r.verificationStatus === "Submitted"
  ).length;
  const underReviewCount = rows.filter(
    (r) => r.verificationStatus === "Under Review"
  ).length;
  const verifiedCount = rows.filter(
    (r) => r.verificationStatus === "Verified"
  ).length;
  const rejectedCount = rows.filter(
    (r) => r.verificationStatus === "Rejected"
  ).length;

  const filteredRows = rows.filter((row) => {
    const statusMatches =
      filter === "All" ||
      (filter === "Pending" && row.verificationStatus === "Submitted") ||
      row.verificationStatus === filter;
    const q = search.trim().toLowerCase();
    const textMatches =
      !q ||
      row._id.toLowerCase().includes(q) ||
      (row.user?.name || row.displayName).toLowerCase().includes(q) ||
      row.registeredArea.toLowerCase().includes(q);
    return statusMatches && textMatches;
  });

  const filters: FilterOption[] = [
    "All",
    "Pending",
    "Under Review",
    "Verified",
    "Rejected",
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Summary Metrics (Stitch 4-column card strip) */}
      <section
        aria-label="Verification summary"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 items-stretch"
      >
        <article className="h-full bg-[#211829] border border-[#3D2B35] rounded-xl p-4 flex flex-col justify-between gap-2">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-[#A99CAF]">Pending review</h2>
            <Hourglass className="h-[18px] w-[18px] text-[#FFB95F]" />
          </header>
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {pendingCount}
            </p>
            <span className="text-xs text-[#FFB95F]">Awaiting triage</span>
          </div>
        </article>

        <article className="h-full bg-[#211829] border border-[#3D2B35] rounded-xl p-4 flex flex-col justify-between gap-2">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-[#A99CAF]">Under review</h2>
            <FileCheck2 className="h-[18px] w-[18px] text-[#BEA3E4]" />
          </header>
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {underReviewCount}
            </p>
            <span className="text-xs text-[#A99CAF]">Assigned</span>
          </div>
        </article>

        <article className="h-full bg-[#211829] border border-[#3D2B35] rounded-xl p-4 flex flex-col justify-between gap-2">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-[#A99CAF]">
              Verified volunteers
            </h2>
            <BadgeCheck className="h-[18px] w-[18px] text-[#4EDEA3]" />
          </header>
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {verifiedCount}
            </p>
            <span className="text-xs text-[#4EDEA3]">Alert eligible</span>
          </div>
        </article>

        <article className="h-full bg-[#211829] border border-[#3D2B35] rounded-xl p-4 flex flex-col justify-between gap-2">
          <header className="flex items-center justify-between gap-2">
            <h2 className="text-xs font-medium text-[#A99CAF]">
              Rejected applications
            </h2>
            <XCircle className="h-[18px] w-[18px] text-[#FFB4AB]" />
          </header>
          <div className="flex items-center justify-between gap-2">
            <p className="font-heading text-2xl font-semibold text-[#F8F2F7] tabular-nums">
              {rejectedCount}
            </p>
            <span className="text-xs text-[#A99CAF]">Ineligible</span>
          </div>
        </article>
      </section>

      <div className="rounded-xl border border-[#653E00] bg-[#653E00]/30 px-4 py-3 text-xs text-[#FFDDB8] flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 shrink-0 text-[#FFB95F]" />
        <span>
          <strong>Prototype Verification Notice:</strong> Document references
          below are hackathon demonstration placeholders. No real criminal
          background checks have taken place.
        </span>
      </div>

      {feedback && (
        <div className="rounded-xl border border-[#005236] bg-[#005236]/50 px-4 py-3 text-xs font-medium text-[#6FFBBE]">
          {feedback}
        </div>
      )}

      {/* Filters & Search Bar (Stitch Design) */}
      <section
        aria-label="Filter applications"
        className="flex flex-wrap items-center justify-between gap-4"
      >
        <div
          role="group"
          aria-label="Status filter"
          className="inline-flex flex-wrap rounded-lg bg-[#211829] p-1 border border-[#3D2B35] gap-1"
        >
          {filters.map((opt) => {
            const active = filter === opt;
            return (
              <button
                key={opt}
                type="button"
                onClick={() => setFilter(opt)}
                className={`px-3 py-1.5 rounded-md text-xs font-medium whitespace-nowrap transition-colors cursor-pointer ${
                  active
                    ? "bg-[#38203F] text-[#EDDCFF]"
                    : "text-[#A99CAF] hover:text-[#F8F2F7]"
                }`}
              >
                {opt}
              </button>
            );
          })}
        </div>

        <div className="relative w-full sm:w-72">
          <Search className="h-4 w-4 text-[#A99CAF] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search ID, name, or area..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-[#211829] border border-[#3D2B35] text-sm text-[#F8F2F7] placeholder-[#A99CAF] focus:outline-none focus:border-[#BEA3E4]"
          />
        </div>
      </section>

      {/* Verification Table (Stitch Design) */}
      <section
        aria-label="Applicant verification table"
        className="w-full rounded-xl border border-[#3D2B35] bg-[#211829] overflow-x-auto"
      >
        <table className="w-full text-left border-collapse">
          <thead className="bg-[#241C2E] border-b border-[#3D2B35]">
            <tr>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] whitespace-nowrap">
                Applicant ID
              </th>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] whitespace-nowrap">
                Applicant name
              </th>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] whitespace-nowrap">
                Registration date
              </th>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] whitespace-nowrap">
                Registered location
              </th>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] whitespace-nowrap">
                Document status
              </th>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] whitespace-nowrap">
                Verification status
              </th>
              <th className="px-4 py-3 text-xs font-medium text-[#A99CAF] text-right whitespace-nowrap">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#3D2B35]">
            {filteredRows.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="px-4 py-8 text-center text-xs text-[#A99CAF]"
                >
                  No volunteer applications match the active filter.
                </td>
              </tr>
            ) : (
              filteredRows.map((row) => {
                const docCount = row.application?.documentReferences?.length || 0;
                const actionLabel =
                  row.verificationStatus === "Verified"
                    ? "View Profile"
                    : row.verificationStatus === "Rejected"
                      ? "View Notes"
                      : "Review";
                return (
                  <tr
                    key={row._id}
                    className="hover:bg-[#241C2E] transition-colors"
                  >
                    <td className="px-4 py-3 text-sm text-[#BEA3E4] font-mono tabular-nums whitespace-nowrap">
                      {row._id.toUpperCase()}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#F8F2F7]">
                      <div className="font-medium">
                        {row.user?.name || row.displayName}
                      </div>
                      {row.user?.accountStatus === "suspended" && (
                        <span className="text-[11px] text-[#FFB4AB]">
                          Suspended Account
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A99CAF] tabular-nums whitespace-nowrap">
                      {new Date(row.createdAt).toISOString().slice(0, 10)}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#A99CAF]">
                      {row.registeredArea}
                    </td>
                    <td className="px-4 py-3 text-sm text-[#F8F2F7]">
                      {docCount > 0
                        ? `${docCount} Placeholder Doc(s)`
                        : "Demo Record"}
                    </td>
                    <td className="px-4 py-3">
                      <VerificationBadge status={row.verificationStatus} />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveRow(row);
                          setReviewNotes(row.application?.reviewNotes || "");
                        }}
                        className="text-xs font-medium text-[#BEA3E4] hover:text-[#FFAEDA] transition-colors whitespace-nowrap cursor-pointer"
                      >
                        {actionLabel}
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </section>

      {/* Interactive Admin Review Modal */}
      {activeRow && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-xl rounded-2xl border border-[#3D2B35] bg-[#211829] p-6 text-[#F8F2F7] shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-3 border-b border-[#3D2B35] pb-3">
              <div>
                <div className="font-mono text-xs text-[#BEA3E4]">
                  {activeRow._id.toUpperCase()} • {activeRow.user?.email}
                </div>
                <h3 className="mt-1 font-heading text-lg font-semibold">
                  {activeRow.user?.name || activeRow.displayName}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveRow(null)}
                className="rounded-lg p-1 text-[#A99CAF] hover:bg-[#2F2639] hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3">
                <div className="text-[#A99CAF]">Registered Area</div>
                <div className="mt-1 font-medium">{activeRow.registeredArea}</div>
              </div>
              <div className="rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3">
                <div className="text-[#A99CAF]">Current Status</div>
                <div className="mt-1 flex items-center gap-2">
                  <VerificationBadge status={activeRow.verificationStatus} />
                  <span className="text-[#A99CAF]">
                    Eligible: {activeRow.alertEligible ? "Yes" : "No"}
                  </span>
                </div>
              </div>
            </div>

            {activeRow.application && (
              <div className="rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3 text-xs space-y-2">
                <div className="font-medium text-[#BEA3E4]">
                  Uploaded Document References (Admin-Only Access):
                </div>
                <div className="flex flex-wrap gap-2">
                  {activeRow.application.documentReferences.map((doc) => (
                    <span
                      key={doc.docId}
                      className="inline-flex items-center gap-1.5 rounded-md border border-[#3D2B35] bg-[#160E1F] px-2.5 py-1 font-mono text-[11px]"
                    >
                      <FileCheck className="h-3.5 w-3.5 text-[#D946A8]" />
                      {doc.fileName}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-medium text-[#A99CAF]">
                Administrator Review Notes
              </label>
              <textarea
                rows={2}
                value={reviewNotes}
                onChange={(e) => setReviewNotes(e.target.value)}
                placeholder="Enter verification or suspension note..."
                className="w-full rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs text-[#F8F2F7] outline-none focus:border-[#BEA3E4]"
              />
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 pt-2 border-t border-[#3D2B35]">
              <button
                type="button"
                disabled={busyId === activeRow.userId}
                onClick={() =>
                  updateStatus({
                    userId: activeRow.userId,
                    verificationStatus: "Verified",
                    alertEligible: true,
                    accountStatus: "active",
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#005236] px-3.5 py-2 text-xs font-semibold text-[#6FFBBE] hover:bg-[#006b47] cursor-pointer"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                Approve (Verified)
              </button>

              <button
                type="button"
                disabled={busyId === activeRow.userId}
                onClick={() =>
                  updateStatus({
                    userId: activeRow.userId,
                    verificationStatus: "Under Review",
                    alertEligible: false,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#38203F] px-3.5 py-2 text-xs font-semibold text-[#EDDCFF] hover:bg-[#492b52] cursor-pointer"
              >
                <Clock className="h-3.5 w-3.5" />
                Under Review
              </button>

              <button
                type="button"
                disabled={busyId === activeRow.userId}
                onClick={() =>
                  updateStatus({
                    userId: activeRow.userId,
                    verificationStatus: "Rejected",
                    alertEligible: false,
                  })
                }
                className="inline-flex items-center gap-1.5 rounded-lg bg-[#93000A] px-3.5 py-2 text-xs font-semibold text-[#FFDAD6] hover:bg-[#b0000d] cursor-pointer"
              >
                <XCircle className="h-3.5 w-3.5" />
                Reject
              </button>

              <button
                type="button"
                disabled={busyId === activeRow.userId}
                onClick={() => {
                  const isSuspended =
                    activeRow.user?.accountStatus === "suspended";
                  updateStatus({
                    userId: activeRow.userId,
                    verificationStatus: isSuspended
                      ? activeRow.verificationStatus
                      : "Rejected",
                    alertEligible: isSuspended
                      ? activeRow.verificationStatus === "Verified"
                      : false,
                    accountStatus: isSuspended ? "active" : "suspended",
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3.5 py-2 text-xs font-semibold text-[#A99CAF] hover:text-white cursor-pointer"
              >
                <Ban className="h-3.5 w-3.5" />
                {activeRow.user?.accountStatus === "suspended"
                  ? "Reactivate"
                  : "Suspend"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
