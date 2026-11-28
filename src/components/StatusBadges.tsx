import React from "react";
import type {
  ConfidenceType,
  IncidentStatus,
  VerificationStatus,
} from "@/lib/types";

export function VerificationBadge({ status }: { status: VerificationStatus }) {
  const styles: Record<
    VerificationStatus,
    { pill: string; dot: string; label: string }
  > = {
    Verified: {
      pill: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dot: "bg-emerald-500",
      label: "Verified",
    },
    "Under Review": {
      pill: "bg-pink-50 text-pink-700 border border-pink-200",
      dot: "bg-pink-500",
      label: "Under Review",
    },
    Submitted: {
      pill: "bg-amber-50 text-amber-700 border border-amber-200",
      dot: "bg-amber-500",
      label: "Pending",
    },
    Rejected: {
      pill: "bg-rose-50 text-rose-700 border border-rose-200",
      dot: "bg-rose-500",
      label: "Rejected",
    },
  };
  const cfg = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium whitespace-nowrap ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function IncidentStatusBadge({ status }: { status: IncidentStatus }) {
  const styles: Record<IncidentStatus, { pill: string; dot: string; label: string }> = {
    open: {
      pill: "bg-amber-50 text-amber-700 border border-amber-200",
      dot: "bg-amber-500",
      label: "Open",
    },
    dispatched: {
      pill: "bg-pink-50 text-pink-700 border border-pink-200",
      dot: "bg-pink-500",
      label: "Dispatched",
    },
    acknowledged: {
      pill: "bg-emerald-50 text-emerald-700 border border-emerald-200",
      dot: "bg-emerald-500",
      label: "Responding",
    },
    closed: {
      pill: "bg-slate-100 text-slate-600 border border-slate-200",
      dot: "bg-slate-400",
      label: "Closed",
    },
  };
  const cfg = styles[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium whitespace-nowrap ${cfg.pill}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} aria-hidden="true" />
      <span>{cfg.label}</span>
    </span>
  );
}

export function ConfidenceBadge({
  score,
}: {
  score: number;
  type?: ConfidenceType;
}) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-[#F3D5E5] bg-[#FDF2F8] px-2.5 py-1 text-[11px] font-semibold text-[#DB2777] whitespace-nowrap">
      <span className="font-mono tabular-nums">{score}%</span>
    </span>
  );
}
