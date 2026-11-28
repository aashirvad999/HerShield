"use client";

import React, { useState } from "react";
import { Download, ShieldCheck, VideoOff } from "lucide-react";

export interface TimelineFrame {
  t: number;
  keypoints: number[][];
  boxes: Array<{ x1: number; y1: number; x2: number; y2: number; trackId: number }>;
  label: string;
}

export function PrivacyShieldPlayer({
  incidentId,
  previewReference,
  previewSha256,
  compact = false,
}: {
  incidentId: string;
  frames?: TimelineFrame[];
  previewReference?: string | null;
  previewSha256?: string | null;
  compact?: boolean;
}) {
  const [videoError, setVideoError] = useState(false);

  return (
    <div className="rounded-2xl border border-[#38203F]/20 bg-[#160E1F] p-3.5 text-[#F8F5FA] shadow-lg">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#BEA3E4]">
          <ShieldCheck className="h-4 w-4 text-[#D946A8]" />
          <span>Face-Blurred Incident Video</span>
        </div>
        <span className="rounded-full bg-[#38203F] px-2.5 py-0.5 text-[11px] font-medium text-[#F3DCEB]">
          Faces Blurred
        </span>
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-[#BEA3E4]/20 bg-[#120B1B] ${
          compact ? "aspect-video" : "aspect-[4/3]"
        } flex items-center justify-center`}
      >
        {previewReference && !videoError ? (
          <video
            key={previewReference}
            src={previewReference}
            controls
            autoPlay
            loop
            muted
            playsInline
            onError={() => setVideoError(true)}
            className="h-full w-full object-contain"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[#A99AAF]">
            <VideoOff className="h-8 w-8 text-[#BEA3E4]/60 mb-2" />
            <p className="text-xs font-medium text-[#EDDCFF]">
              Face-blurred video clip unavailable
            </p>
            <p className="mt-1 text-[11px] text-[#A99CAF]">
              Ensure the local AI service is running to stream preview {incidentId}.
            </p>
          </div>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#BEA3E4]/15 pt-2.5 text-[11px] text-[#A99AAF]">
        <div className="truncate max-w-full">
          {previewSha256 ? (
            <span
              className="font-mono"
              title="Integrity checksum only — does not prove legal admissibility"
            >
              SHA-256: {previewSha256.slice(0, 20)}… (integrity check only)
            </span>
          ) : (
            <span>Face-blurred incident clip</span>
          )}
        </div>
        {previewReference && (
          <a
            href={previewReference}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-md border border-[#BEA3E4]/25 px-2.5 py-1 text-[11px] font-medium text-[#F3DCEB] hover:border-[#D946A8] hover:text-white"
          >
            <Download className="h-3 w-3" />
            Download Video
          </a>
        )}
      </div>
    </div>
  );
}
