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
          <h2 className="font-heading text-xl font-semibold text-[#F8F2F7]">
            Operator Settings &amp; Edge Configuration
          </h2>
          <p className="mt-1 text-sm text-[#A99CAF]">
            Active deployment settings for local AI inference, PrivacyShield
            buffering, and CivicTech safety boundaries.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#F8F2F7]">
              <Radio className="h-4 w-4 text-[#D946A8]" />
              Local AI Backend Endpoint
            </div>
            <p className="font-mono text-xs text-[#BEA3E4] break-all">
              {aiUrl}
            </p>
            <p className="text-xs text-[#A99CAF]">
              Configured via server-only <code>AI_SERVICE_URL</code>. Set to a
              secure HTTPS tunnel when demonstrating from Vercel.
            </p>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#F8F2F7]">
              <Cpu className="h-4 w-4 text-[#4EDEA3]" />
              Model Pipeline &amp; Performance Target
            </div>
            <p className="text-xs text-[#A99CAF]">
              YOLO11n-Pose + ByteTrack at ~640px resolution targeting 10–15 FPS
              on NVIDIA RTX 3050 6GB CUDA (with automatic CPU fallback).
            </p>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#F8F2F7]">
              <Lock className="h-4 w-4 text-[#BEA3E4]" />
              PrivacyShield Enforcement
            </div>
            <p className="text-xs text-[#A99CAF]">
              Raw frames stay strictly in transient local RAM. Volunteer-facing
              endpoints strip raw video and serve only non-identifying skeletal
              previews.
            </p>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading font-semibold text-sm text-[#F8F2F7]">
              <ShieldAlert className="h-4 w-4 text-[#FFB95F]" />
              Emergency Services Policy
            </div>
            <p className="text-xs text-[#A99CAF]">
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
