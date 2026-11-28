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
      pill: "bg-[#005236] text-[#6FFBBE]",
      dot: "bg-[#4EDEA3]",
      label: "Verified",
    },
    "Under Review": {
      pill: "bg-[#38203F] text-[#EDDCFF]",
      dot: "bg-[#BEA3E4]",
      label: "Under Review",
    },
    Submitted: {
      pill: "bg-[#653E00] text-[#FFDDB8]",
      dot: "bg-[#FFB95F]",
      label: "Pending",
    },
    Rejected: {
      pill: "bg-[#93000A] text-[#FFDAD6]",
      dot: "bg-[#FFB4AB]",
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
      pill: "bg-[#653E00] text-[#FFDDB8]",
      dot: "bg-[#FFB95F]",
      label: "Open Review",
    },
    dispatched: {
      pill: "bg-[#38203F] text-[#FFAEDA] border border-[#D946A8]/40",
      dot: "bg-[#D946A8]",
      label: "Alert Dispatched",
    },
    acknowledged: {
      pill: "bg-[#005236] text-[#6FFBBE]",
      dot: "bg-[#4EDEA3]",
      label: "Volunteer Responding",
    },
    closed: {
      pill: "bg-[#2F2639] text-[#A99CAF]",
      dot: "bg-[#7E7388]",
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
  type,
}: {
  score: number;
  type: ConfidenceType;
}) {
  return (
    <span
      title={
        type === "heuristic"
          ? "Heuristic indicator score — not a calibrated probability or proof"
          : "Model confidence score"
      }
      className="inline-flex items-center gap-1.5 rounded-full border border-[#3D2B35] bg-[#241C2E] px-2.5 py-1 text-[11px] font-medium text-[#F8F2F7] whitespace-nowrap"
    >
      <span className="font-mono font-semibold text-[#FFAEDA] tabular-nums">
        {score}%
      </span>
      <span className="text-[#BEA3E4]">
        {type === "heuristic" ? "Heuristic Score" : "Model Score"}
      </span>
    </span>
  );
}
