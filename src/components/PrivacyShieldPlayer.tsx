"use client";

import React, { useEffect, useRef, useState } from "react";
import { Download, Pause, Play, ShieldCheck } from "lucide-react";

const COCO_EDGES: Array<[number, number]> = [
  [0, 1], [0, 2], [1, 3], [2, 4],
  [5, 6], [5, 7], [7, 9], [6, 8], [8, 10],
  [5, 11], [6, 12], [11, 12],
  [11, 13], [13, 15], [12, 14], [14, 16],
];

export interface TimelineFrame {
  t: number;
  keypoints: number[][];
  boxes: Array<{ x1: number; y1: number; x2: number; y2: number; trackId: number }>;
  label: string;
}

export function PrivacyShieldPlayer({
  incidentId,
  frames,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const safeFrames = frames && frames.length > 0 ? frames : null;
  const [frameIdx, setFrameIdx] = useState(0);
  const [playing, setPlaying] = useState(true);

  useEffect(() => {
    if (!playing || !safeFrames || safeFrames.length <= 1) return;
    const timer = setInterval(() => {
      setFrameIdx((prev) => (prev + 1) % safeFrames.length);
    }, 240);
    return () => clearInterval(timer);
  }, [playing, safeFrames]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Deep Plum blank background (zero surroundings, zero faces, zero clothing)
    ctx.fillStyle = "#160E1F";
    ctx.fillRect(0, 0, w, h);

    // Subtle spatial reference grid
    ctx.strokeStyle = "rgba(190, 163, 228, 0.08)";
    ctx.lineWidth = 1;
    for (let x = 64; x < w; x += 64) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, h);
      ctx.stroke();
    }
    for (let y = 64; y < h; y += 64) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(w, y);
      ctx.stroke();
    }

    const current = safeFrames ? safeFrames[frameIdx % safeFrames.length] : null;
    if (!current) {
      ctx.fillStyle = "#BEA3E4";
      ctx.font = "500 14px Inter, sans-serif";
      ctx.fillText(
        "Non-identifying PrivacyShield Timeline Armed",
        24,
        h / 2 - 8
      );
      ctx.fillStyle = "#A99AAF";
      ctx.font = "400 12px Inter, sans-serif";
      ctx.fillText(
        "Original footage is strictly withheld from volunteer views.",
        24,
        h / 2 + 16
      );
      return;
    }

    // Draw anonymized subject boxes
    for (const box of current.boxes || []) {
      ctx.strokeStyle = "rgba(190, 163, 228, 0.55)";
      ctx.lineWidth = 1.5;
      ctx.strokeRect(
        box.x1,
        box.y1,
        Math.max(10, box.x2 - box.x1),
        Math.max(10, box.y2 - box.y1)
      );
      ctx.fillStyle = "#BEA3E4";
      ctx.font = "500 11px JetBrains Mono, monospace";
      ctx.fillText(`Subject #${box.trackId}`, box.x1, Math.max(18, box.y1 - 6));
    }

    // Draw skeletal pose keypoints on blank background
    const kps = current.keypoints || [];
    if (kps.length > 0) {
      ctx.strokeStyle = "#D946A8";
      ctx.lineWidth = 3.5;
      ctx.lineCap = "round";
      for (const [a, b] of COCO_EDGES) {
        const ka = kps[a];
        const kb = kps[b];
        if (ka && kb && ka[2] > 0.25 && kb[2] > 0.25) {
          ctx.beginPath();
          ctx.moveTo(ka[0], ka[1]);
          ctx.lineTo(kb[0], kb[1]);
          ctx.stroke();
        }
      }

      kps.forEach((kp, idx) => {
        if (!kp || kp[2] <= 0.25) return;
        // Replace facial keypoints 1..4 with single anonymous head circle
        if (idx >= 1 && idx <= 4) return;
        ctx.beginPath();
        ctx.arc(kp[0], kp[1], idx === 0 ? 10 : 4, 0, Math.PI * 2);
        if (idx === 0) {
          ctx.strokeStyle = "#BEA3E4";
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          ctx.fillStyle = "#F3DCEB";
          ctx.fill();
        }
      });
    }

    // Top PrivacyShield header strip
    ctx.fillStyle = "rgba(56, 32, 63, 0.85)";
    ctx.fillRect(0, 0, w, 32);
    ctx.fillStyle = "#F8F5FA";
    ctx.font = "600 11px Inter, sans-serif";
    ctx.fillText(`PRIVACYSHIELD SKELETAL PREVIEW  •  ${incidentId}`, 12, 20);

    ctx.fillStyle = "#BEA3E4";
    ctx.font = "500 11px JetBrains Mono, monospace";
    ctx.fillText(`${current.label || "Movement sequence"} (t+${current.t}s)`, 12, h - 12);
  }, [frameIdx, incidentId, safeFrames]);

  return (
    <div className="rounded-2xl border border-[#38203F]/20 bg-[#160E1F] p-3.5 text-[#F8F5FA] shadow-lg">
      <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex items-center gap-2 text-xs font-medium text-[#BEA3E4]">
          <ShieldCheck className="h-4 w-4 text-[#D946A8]" />
          <span>PrivacyShield Non-Identifying Representation</span>
        </div>
        <span className="rounded-full bg-[#38203F] px-2.5 py-0.5 text-[11px] font-medium text-[#F3DCEB]">
          No Faces / No Surroundings
        </span>
      </div>

      <div className="overflow-hidden rounded-xl border border-[#BEA3E4]/20 bg-[#160E1F]">
        <canvas
          ref={canvasRef}
          width={640}
          height={compact ? 360 : 420}
          className="h-auto w-full block"
        />
      </div>

      {safeFrames && safeFrames.length > 1 && (
        <div className="mt-2.5 flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPlaying((p) => !p)}
            className="inline-flex items-center gap-1.5 rounded-lg bg-[#38203F] px-3 py-1.5 text-xs font-medium text-[#F8F5FA] hover:bg-[#D946A8] transition"
          >
            {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
            {playing ? "Pause" : "Play"}
          </button>
          <input
            type="range"
            min={0}
            max={safeFrames.length - 1}
            value={frameIdx}
            onChange={(e) => {
              setPlaying(false);
              setFrameIdx(Number(e.target.value));
            }}
            className="h-1.5 flex-1 accent-[#D946A8] cursor-pointer"
          />
          <span className="font-mono text-[11px] text-[#A99AAF]">
            {frameIdx + 1}/{safeFrames.length}
          </span>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[#BEA3E4]/15 pt-2.5 text-[11px] text-[#A99AAF]">
        <div className="truncate max-w-full">
          {previewSha256 ? (
            <span className="font-mono" title="Integrity checksum only — does not prove legal admissibility">
              SHA-256: {previewSha256.slice(0, 20)}… (integrity check only)
            </span>
          ) : (
            <span>Transient skeletal timeline preview</span>
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
            Sanitized MP4
          </a>
        )}
      </div>
    </div>
  );
}
