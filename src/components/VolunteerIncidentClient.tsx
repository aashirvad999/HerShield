"use client";

import React, { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  Clock,
  MapPin,
  PhoneCall,
  ShieldCheck,
  X,
} from "lucide-react";
import {
  PrivacyShieldPlayer,
  type TimelineFrame,
} from "./PrivacyShieldPlayer";
import { ConfidenceBadge } from "./StatusBadges";
import type { ConfidenceType } from "@/lib/types";

interface SanitizedIncident {
  incidentId: string;
  incidentTitle: string;
  incidentConfidence: number;
  confidenceType: ConfidenceType;
  detectionExplanation: string;
  approxLocation: string;
  areaName: string;
  detectedAt: string;
  incidentStatus: string;
  sanitizedPreviewReference: string | null;
  sanitizedTimelineFrames: TimelineFrame[];
  previewSha256: string | null;
}

export function VolunteerIncidentClient({
  incidentId,
}: {
  incidentId: string;
}) {
  const [incident, setIncident] = useState<SanitizedIncident | null>(null);
  const [approxDistance, setApproxDistance] = useState<string>("Nearby");
  const [ackStatus, setAckStatus] = useState<
    "pending" | "accepted" | "declined"
  >("pending");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadAlert = useCallback(async () => {
    const res = await fetch(`/api/incidents/${incidentId}`, {
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Unable to load incident alert.");
      return;
    }
    setIncident(data.incident);
    setApproxDistance(data.myNotification?.approxDistanceText || "Nearby");
    setAckStatus(data.myNotification?.acknowledgementStatus || "pending");
  }, [incidentId]);

  useEffect(() => {
    const t = setTimeout(() => {
      void loadAlert();
    }, 0);
    return () => clearTimeout(t);
  }, [loadAlert]);

  async function respond(decision: "accepted" | "declined") {
    setBusy(true);
    try {
      const res = await fetch(`/api/incidents/${incidentId}/respond`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      if (res.ok) {
        setAckStatus(decision);
      }
    } finally {
      setBusy(false);
    }
  }

  if (error) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-[#93000A] bg-[#211829] p-6 space-y-3">
        <h2 className="font-heading text-lg font-semibold text-[#FFB4AB]">
          Access Restricted
        </h2>
        <p className="text-sm text-[#A99CAF]">{error}</p>
        <Link
          href="/volunteer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#BEA3E4] hover:text-[#FFAEDA]"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Volunteer Dashboard
        </Link>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-[#3D2B35] bg-[#211829] p-6 text-sm text-[#A99CAF]">
        Loading alert details…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 w-full">
      <Link
        href="/volunteer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#BEA3E4] hover:text-[#FFAEDA]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Volunteer Dashboard
      </Link>

      <div className="rounded-xl border border-[#653E00] bg-[#653E00]/35 p-4 text-xs text-[#FFDDB8] space-y-1">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <AlertTriangle className="h-4 w-4 text-[#FFB95F]" />
          Safe Community Response Guidance
        </div>
        <p>
          Never confront an aggressive or armed suspect directly. Observe from
          a safe public distance, call official emergency services (
          <strong>112</strong>), and offer safe bystander support if needed.
        </p>
      </div>

      <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-[#BEA3E4]">
            {incident.incidentId}
          </span>
          <ConfidenceBadge
            score={incident.incidentConfidence}
            type={incident.confidenceType}
          />
        </div>

        <h2 className="font-heading text-xl sm:text-2xl font-semibold text-[#F8F2F7]">
          {incident.incidentTitle}
        </h2>

        <p className="text-sm text-[#A99CAF]">
          {incident.detectionExplanation}
        </p>

        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3">
            <div className="flex items-center gap-1 text-[#A99CAF]">
              <MapPin className="h-3.5 w-3.5 text-[#D946A8]" />
              Approx. Location
            </div>
            <div className="mt-1 font-medium text-[#F8F2F7]">
              {incident.approxLocation}
            </div>
          </div>
          <div className="rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3">
            <div className="flex items-center gap-1 text-[#A99CAF]">
              <ShieldCheck className="h-3.5 w-3.5 text-[#4EDEA3]" />
              Approx. Distance
            </div>
            <div className="mt-1 font-mono font-bold text-[#FFAEDA] tabular-nums">
              {approxDistance}
            </div>
          </div>
          <div className="rounded-lg border border-[#3D2B35] bg-[#241C2E] p-3">
            <div className="flex items-center gap-1 text-[#A99CAF]">
              <Clock className="h-3.5 w-3.5 text-[#BEA3E4]" />
              Detected At
            </div>
            <div className="mt-1 font-medium tabular-nums">
              {new Date(incident.detectedAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </div>
          </div>
        </div>

        <PrivacyShieldPlayer
          incidentId={incident.incidentId}
          frames={incident.sanitizedTimelineFrames}
          previewReference={incident.sanitizedPreviewReference}
          previewSha256={incident.previewSha256}
          compact
        />

        <div className="pt-2 space-y-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-[#A99CAF]">
            Your Response Status:{" "}
            <span className="text-[#FFAEDA]">{ackStatus.toUpperCase()}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => respond("accepted")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition cursor-pointer ${
                ackStatus === "accepted"
                  ? "bg-[#005236] text-[#6FFBBE]"
                  : "bg-[#D946A8] text-white hover:bg-[#c13592]"
              }`}
            >
              <Check className="h-4 w-4" />I Can Help (Safe Support)
            </button>

            <button
              type="button"
              disabled={busy}
              onClick={() => respond("declined")}
              className={`flex items-center justify-center gap-2 rounded-xl border py-3.5 text-sm font-semibold transition cursor-pointer ${
                ackStatus === "declined"
                  ? "border-[#93000A] bg-[#93000A] text-[#FFDAD6]"
                  : "border-[#3D2B35] bg-[#241C2E] text-[#A99CAF] hover:text-white"
              }`}
            >
              <X className="h-4 w-4" />
              Unable to Respond
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[#A99CAF]">
            <PhoneCall className="h-3.5 w-3.5 text-[#D946A8]" />
            <span>
              In immediate danger, contact emergency services (112) directly.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
