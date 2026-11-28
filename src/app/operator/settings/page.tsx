import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { requirePortalSession } from "@/lib/portal-auth";
import { Cpu, Lock, Radio, ShieldAlert } from "lucide-react";

async function SettingsInner() {
  const user = await requirePortalSession(
    ["operator", "admin"],
    "/operator/login"
  );

  const aiUrl = process.env.AI_SERVICE_URL || "http://127.0.0.1:8000";

  return (
    <PortalShell role="operator" userName={user.name}>
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#2B1324]">
            Operator Settings &amp; Edge Configuration
          </h2>
          <p className="mt-1 text-sm text-[#7A566E]">
            Active deployment settings for local AI inference, PrivacyShield
            buffering, and CivicTech safety boundaries.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#2B1324]">
              <Radio className="h-4 w-4 text-[#DB2777]" />
              Local AI Backend Endpoint
            </div>
            <p className="font-mono text-xs text-[#DB2777] break-all">
              {aiUrl}
            </p>
            <p className="text-xs text-[#7A566E]">
              Configured via server-only <code>AI_SERVICE_URL</code>. Set to a
              secure HTTPS tunnel when demonstrating from Vercel.
            </p>
          </div>

          <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#2B1324]">
              <Cpu className="h-4 w-4 text-emerald-600" />
              Model Pipeline &amp; Performance Target
            </div>
            <p className="text-xs text-[#7A566E]">
              YOLO11n-Pose + ByteTrack at ~640px resolution targeting 10–15 FPS
              on NVIDIA RTX 3050 6GB CUDA (with automatic CPU fallback).
            </p>
          </div>

          <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#2B1324]">
              <Lock className="h-4 w-4 text-[#DB2777]" />
              PrivacyShield Enforcement
            </div>
            <p className="text-xs text-[#7A566E]">
              Raw frames stay strictly in transient local RAM. Volunteer-facing
              endpoints strip raw video and serve only non-identifying skeletal
              previews.
            </p>
          </div>

          <div className="rounded-xl border border-[#F3D5E5] bg-white p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#2B1324]">
              <ShieldAlert className="h-4 w-4 text-amber-600" />
              Emergency Services Policy
            </div>
            <p className="text-xs text-[#7A566E]">
              HerShield is a Gov-Independent CivicTech platform. It complements
              official emergency services (112) and never claims to replace
              them.
            </p>
          </div>
        </div>
      </div>
    </PortalShell>
  );
}

export default function OperatorSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading settings…</div>}>
      <SettingsInner />
    </Suspense>
  );
}
