import { Suspense } from "react";
import { PortalShell } from "@/components/PortalShell";
import { AdminTelegramConfigClient } from "@/components/AdminTelegramConfigClient";
import { requirePortalSession } from "@/lib/portal-auth";
import { Database, KeyRound, MessageCircle, Shield } from "lucide-react";

async function AdminSettingsInner() {
  const user = await requirePortalSession(["admin"], "/admin/login");
  const mongoConfigured = Boolean(
    process.env.MONGODB_URI && !process.env.MONGODB_URI.includes("<username>")
  );
  const telegramConfigured = Boolean(process.env.TELEGRAM_BOT_TOKEN?.trim());

  return (
    <PortalShell
      role="admin"
      userName={user.name}
      pageTitle="Administrative Settings"
    >
      <div className="max-w-4xl space-y-6">
        <div>
          <h2 className="font-heading text-xl font-semibold text-[#F8F2F7]">
            Administrative Security &amp; Integration Settings
          </h2>
          <p className="mt-1 text-sm text-[#A99CAF]">
            Server-side environment status (secrets are never exposed to client
            bundles).
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading text-sm font-semibold">
              <Database className="h-4 w-4 text-[#4EDEA3]" />
              MongoDB Atlas Integration
            </div>
            <p className="text-xs text-[#F8F2F7]">
              Status:{" "}
              <strong>
                {mongoConfigured
                  ? "Configured"
                  : "Not Configured (Fallback Mode)"}
              </strong>
            </p>
            <p className="text-xs text-[#A99CAF]">
              Indexes enforced: unique email, GeoJSON{" "}
              <code>2dsphere</code> on volunteer registeredLocation, and
              incident timestamps.
            </p>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading text-sm font-semibold">
              <MessageCircle className="h-4 w-4 text-[#BEA3E4]" />
              Telegram Bot API
            </div>
            <p className="text-xs text-[#F8F2F7]">
              Status:{" "}
              <strong>
                {telegramConfigured
                  ? "Bot Token Configured"
                  : "Token Not Set (Safe Error Tracking Active)"}
              </strong>
            </p>
            <p className="text-xs text-[#A99CAF]">
              Bot token stays strictly in server environment variables (
              <code>TELEGRAM_BOT_TOKEN</code>).
            </p>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading text-sm font-semibold">
              <KeyRound className="h-4 w-4 text-[#D946A8]" />
              Role-Based Access Control
            </div>
            <p className="text-xs text-[#A99CAF]">
              HTTP-only signed JWT cookies enforce <code>operator</code>,{" "}
              <code>volunteer</code>, and <code>admin</code> access on every
              Server Component and API route handler.
            </p>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-5 space-y-2">
            <div className="flex items-center gap-2 font-heading text-sm font-semibold">
              <Shield className="h-4 w-4 text-[#FFB95F]" />
              PrivacyShield &amp; Document Protection
            </div>
            <p className="text-xs text-[#A99CAF]">
              Uploaded verification documents are restricted to Admin endpoints
              and never returned to ordinary volunteer profiles or public routes.
            </p>
          </div>
        </div>

        <AdminTelegramConfigClient />
      </div>
    </PortalShell>
  );
}

export default function AdminSettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-sm">Loading settings…</div>}>
      <AdminSettingsInner />
    </Suspense>
  );
}
