import Link from "next/link";
import {
  Activity,
  ArrowRight,
  BellRing,
  Lock,
  MapPin,
  Shield,
  ShieldCheck,
  UserCheck,
  Video,
} from "lucide-react";
import { HerShieldLogo } from "@/components/HerShieldLogo";
import { isLoginDisabled } from "@/lib/auth";

export default function HomePage() {
  const loginDisabled = isLoginDisabled();
  const operatorHref = loginDisabled ? "/operator" : "/operator/login";
  const volunteerHref = loginDisabled ? "/volunteer" : "/volunteer/login";
  const adminHref = loginDisabled ? "/admin" : "/admin/login";

  return (
    <div className="min-h-screen flex flex-col bg-[#160E1F] text-[#F8F2F7]">
      <section className="hs-gradient-hero border-b border-[#3D2B35]">
        <header className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
          <HerShieldLogo />
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <Link
              href={operatorHref}
              className="rounded-lg border border-[#3D2B35] bg-[#211829] px-4 py-2 font-medium text-[#EDDCFF] hover:border-[#BEA3E4] transition"
            >
              Operator Portal
            </Link>
            <Link
              href={volunteerHref}
              className="rounded-lg border border-[#3D2B35] bg-[#211829] px-4 py-2 font-medium text-[#EDDCFF] hover:border-[#BEA3E4] transition"
            >
              Volunteer Portal
            </Link>
            <Link
              href={adminHref}
              className="rounded-lg bg-[#D946A8] px-4 py-2 font-semibold text-white hover:bg-[#c13592] transition"
            >
              Admin Portal
            </Link>
          </div>
        </header>

        <div className="mx-auto grid max-w-7xl gap-10 px-6 pb-20 pt-10 lg:grid-cols-12 lg:items-center">
          <div className="lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#3D2B35] bg-[#211829] px-3.5 py-1.5 text-xs font-medium text-[#EDDCFF]">
              <Shield className="h-3.5 w-3.5 text-[#D946A8]" />
              Gov-Independent CivicTech Platform • Software-Only Prototype
            </div>

            <h1 className="mt-5 font-heading text-4xl font-semibold leading-tight tracking-tight sm:text-5xl text-[#F8F2F7]">
              Privacy-First AI Safety &amp;{" "}
              <span className="text-[#FFAEDA]">Verified Community</span>{" "}
              Response
            </h1>

            <p className="mt-5 max-w-2xl text-base leading-relaxed text-[#A99CAF]">
              HerShield analyzes local camera streams for potential physical
              aggression and 5-second confirmed collapses, strips all identity
              through <strong className="text-[#F8F2F7]">PrivacyShield</strong>{" "}
              skeletal previews, and dispatches nearby verified community
              volunteers over Telegram.
            </p>

            <div className="mt-8 flex flex-wrap gap-3.5">
              <Link
                href={operatorHref}
                className="inline-flex items-center gap-2 rounded-xl bg-[#D946A8] px-6 py-3.5 text-sm font-semibold text-white hover:bg-[#c13592] transition"
              >
                Launch Operator Console
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/volunteer/register"
                className="inline-flex items-center gap-2 rounded-xl border border-[#3D2B35] bg-[#211829] px-6 py-3.5 text-sm font-semibold text-[#EDDCFF] hover:border-[#BEA3E4] transition"
              >
                Become a Verified Volunteer
              </Link>
            </div>

            <p className="mt-5 text-xs text-[#A99CAF]">
              HerShield complements official emergency services (112) and never
              claims to replace law enforcement or medical responders.
            </p>
          </div>

          <div className="lg:col-span-5">
            <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#3D2B35] pb-3">
                <span className="text-xs font-semibold uppercase tracking-wider text-[#BEA3E4]">
                  Architecture Overview
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-[#005236] px-2.5 py-0.5 text-xs font-medium text-[#6FFBBE]">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#4EDEA3]" />
                  Local Edge + Cloud Portal
                </span>
              </div>

              <div className="space-y-3 text-sm">
                <div className="flex items-start gap-3 rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3.5">
                  <Video className="mt-0.5 h-5 w-5 shrink-0 text-[#D946A8]" />
                  <div>
                    <div className="font-semibold text-[#F8F2F7]">
                      Local YOLO11n-Pose + ByteTrack
                    </div>
                    <p className="mt-0.5 text-xs text-[#A99CAF]">
                      Runs locally on RTX 3050 CUDA (with CPU fallback) — zero
                      raw video leaves the laptop.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3.5">
                  <Lock className="mt-0.5 h-5 w-5 shrink-0 text-[#BEA3E4]" />
                  <div>
                    <div className="font-semibold text-[#F8F2F7]">
                      PrivacyShield Stick-Figure Previews
                    </div>
                    <p className="mt-0.5 text-xs text-[#A99CAF]">
                      Volunteers receive only blank-canvas skeletal movement +
                      SHA-256 checksum, never faces or surroundings.
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 rounded-lg bg-[#241C2E] border border-[#3D2B35] p-3.5">
                  <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#4EDEA3]" />
                  <div>
                    <div className="font-semibold text-[#F8F2F7]">
                      MongoDB Atlas 2dsphere + Telegram
                    </div>
                    <p className="mt-0.5 text-xs text-[#A99CAF]">
                      Selects nearby verified volunteers by registered area (no
                      live GPS tracking) and dispatches authenticated Telegram
                      alerts.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-6 py-16">
        <div className="mb-10 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-widest text-[#FFAEDA]">
              Three Unified Portals
            </span>
            <h2 className="mt-1 font-heading text-2xl font-semibold text-[#F8F2F7] sm:text-3xl">
              Role-Based Safety Operations
            </h2>
          </div>
          <p className="max-w-md text-sm text-[#A99CAF]">
            Every role is server-enforced via HTTP-only signed sessions and
            strictly separates operator streams from volunteer previews.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#38203F] border border-[#3D2B35] text-[#FFAEDA]">
                <Activity className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">
                Operator Portal
              </h3>
              <p className="mt-2 text-sm text-[#A99CAF]">
                Live webcam, phone IP stream, or sample video monitoring with
                real-time FPS, 5-second collapse countdown, PrivacyShield review,
                and geospatial dispatch.
              </p>
            </div>
            <Link
              href={operatorHref}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#BEA3E4] hover:text-[#FFAEDA]"
            >
              {loginDisabled ? "Open Operator Console" : "Open Operator Login"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#38203F] border border-[#3D2B35] text-[#FFAEDA]">
                <BellRing className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">
                Volunteer Portal
              </h3>
              <p className="mt-2 text-sm text-[#A99CAF]">
                Register usual locality, upload demo verification docs, link
                Telegram Bot alerts, view mobile-ready sanitized skeletal
                previews, and respond safely.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-4 text-sm font-semibold">
              <Link
                href={volunteerHref}
                className="inline-flex items-center gap-1.5 text-[#BEA3E4] hover:text-[#FFAEDA]"
              >
                {loginDisabled ? "Open Volunteer Portal" : "Volunteer Login"}{" "}
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/volunteer/register"
                className="text-[#A99CAF] hover:text-[#F8F2F7]"
              >
                Register
              </Link>
            </div>
          </div>

          <div className="rounded-xl border border-[#3D2B35] bg-[#211829] p-6 flex flex-col justify-between">
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#38203F] border border-[#3D2B35] text-[#FFAEDA]">
                <UserCheck className="h-5 w-5" />
              </div>
              <h3 className="mt-4 font-heading text-lg font-semibold">
                Admin Portal
              </h3>
              <p className="mt-2 text-sm text-[#A99CAF]">
                Manually review volunteer applications, verify or reject
                applicants before alert eligibility, manage suspensions, and
                inspect immutable audit logs.
              </p>
            </div>
            <Link
              href={adminHref}
              className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#BEA3E4] hover:text-[#FFAEDA]"
            >
              {loginDisabled ? "Open Admin Portal" : "Open Admin Login"}{" "}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <footer className="mt-auto border-t border-[#3D2B35] bg-[#120B1B] px-6 py-5">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 text-xs text-[#A99CAF]">
          <div className="inline-flex items-center gap-2 font-medium text-[#F8F2F7]">
            <ShieldCheck className="h-4 w-4 text-[#D946A8]" />
            HerShield CivicTech Prototype
          </div>
          <div>
            Heuristic confidence scores are experimental indicators, not legal
            proof or medical diagnosis. Dial 112 in immediate emergencies.
          </div>
        </div>
      </footer>
    </div>
  );
}
