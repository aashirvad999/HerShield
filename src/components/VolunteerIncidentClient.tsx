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
      <div className="mx-auto max-w-xl rounded-xl border border-rose-200 bg-white p-6 space-y-3">
        <h2 className="font-heading text-lg font-semibold text-rose-600">
          Access Restricted
        </h2>
        <p className="text-sm text-[#7A566E]">{error}</p>
        <Link
          href="/volunteer"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB2777] hover:text-[#DB2777]"
        >
          <ArrowLeft className="h-4 w-4" /> Return to Volunteer Dashboard
        </Link>
      </div>
    );
  }

  if (!incident) {
    return (
      <div className="mx-auto max-w-xl rounded-xl border border-[#F3D5E5] bg-white p-6 text-sm text-[#7A566E]">
        Loading alert details…
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5 w-full">
      <Link
        href="/volunteer"
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#DB2777] hover:text-[#DB2777]"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Volunteer Dashboard
      </Link>

      <div className="rounded-xl border border-amber-200 bg-amber-50/35 p-4 text-xs text-amber-800 space-y-1">
        <div className="flex items-center gap-2 font-semibold text-sm">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          Safe Community Response Guidance
        </div>
        <p>
          Never confront an aggressive or armed suspect directly. Observe from
          a safe public distance, call official emergency services (
          <strong>112</strong>), and offer safe bystander support if needed.
        </p>
      </div>

      <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 sm:p-6 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-mono text-xs text-[#DB2777]">
            {incident.incidentId}
          </span>
          <ConfidenceBadge
            score={incident.incidentConfidence}
            type={incident.confidenceType}
          />
        </div>

        <h2 className="font-heading text-xl sm:text-2xl font-semibold text-[#2B1324]">
          {incident.incidentTitle}
        </h2>

        <p className="text-sm text-[#7A566E]">
          {incident.detectionExplanation}
        </p>

        <div className="grid gap-3 sm:grid-cols-3 text-xs">
          <div className="rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] p-3">
            <div className="flex items-center gap-1 text-[#7A566E]">
              <MapPin className="h-3.5 w-3.5 text-[#DB2777]" />
              Approx. Location
            </div>
            <div className="mt-1 font-medium text-[#2B1324]">
              {incident.approxLocation}
            </div>
          </div>
          <div className="rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] p-3">
            <div className="flex items-center gap-1 text-[#7A566E]">
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
              Approx. Distance
            </div>
            <div className="mt-1 font-mono font-bold text-[#DB2777] tabular-nums">
              {approxDistance}
            </div>
          </div>
          <div className="rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] p-3">
            <div className="flex items-center gap-1 text-[#7A566E]">
              <Clock className="h-3.5 w-3.5 text-[#DB2777]" />
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
          <div className="text-xs font-semibold uppercase tracking-wide text-[#7A566E]">
            Your Response Status:{" "}
            <span className="text-[#DB2777]">{ackStatus.toUpperCase()}</span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => respond("accepted")}
              className={`flex items-center justify-center gap-2 rounded-xl py-3.5 text-sm font-semibold transition cursor-pointer ${
                ackStatus === "accepted"
                  ? "bg-emerald-50 text-emerald-700"
                  : "bg-[#DB2777] text-white hover:bg-[#BE185D]"
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
                  ? "border-rose-200 bg-rose-50 text-rose-700"
                  : "border-[#F3D5E5] bg-[#FFF7FA] text-[#7A566E] hover:text-white"
              }`}
            >
              <X className="h-4 w-4" />
              Unable to Respond
            </button>
          </div>

          <div className="flex items-center justify-center gap-2 pt-1 text-xs text-[#7A566E]">
            <PhoneCall className="h-3.5 w-3.5 text-[#DB2777]" />
            <span>
              In immediate danger, contact emergency services (112) directly.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
