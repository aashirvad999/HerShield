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
    <div className="rounded-2xl border border-[#F3D5E5] bg-white p-3.5 text-[#2B1324] shadow-sm">
      <div className="mb-2.5 flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#2B1324]">
          <ShieldCheck className="h-4 w-4 text-[#DB2777]" />
          <span>Face-Blurred Video</span>
        </div>
        {previewReference && (
          <a
            href={previewReference}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-lg border border-[#F3D5E5] bg-[#FDF2F8] px-2.5 py-1 text-[11px] font-medium text-[#DB2777] hover:bg-[#FCE7F3] transition"
          >
            <Download className="h-3 w-3" />
            Download
          </a>
        )}
      </div>

      <div
        className={`overflow-hidden rounded-xl border border-[#F3D5E5] bg-[#FDF2F8] ${
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
            className="h-full w-full object-contain bg-black"
          />
        ) : (
          <div className="flex flex-col items-center justify-center p-6 text-center text-[#7A566E]">
            <VideoOff className="h-8 w-8 text-[#F472B6] mb-2" />
            <p className="text-xs font-medium text-[#2B1324]">
              Video preview unavailable ({incidentId})
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
