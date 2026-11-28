import Link from "next/link";
import { ArrowRight, BellRing, Shield, UserCheck, Video } from "lucide-react";
import { HerShieldLogo } from "@/components/HerShieldLogo";
import { isLoginDisabled } from "@/lib/auth";

export default function HomePage() {
  const loginDisabled = isLoginDisabled();
  const operatorHref = loginDisabled ? "/operator" : "/operator/login";
  const volunteerHref = loginDisabled ? "/volunteer" : "/volunteer/login";
  const adminHref = loginDisabled ? "/admin" : "/admin/login";

  return (
    <div className="min-h-screen flex flex-col bg-[#FFF7FA] text-[#2B1324]">
      <section className="hs-gradient-hero border-b border-[#F3D5E5]">
        <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
          <HerShieldLogo />
          <div className="flex flex-wrap items-center gap-2.5 text-sm">
            <Link
              href={operatorHref}
              className="rounded-xl border border-[#F3D5E5] bg-white px-4 py-2 font-medium text-[#2B1324] hover:border-[#DB2777] hover:text-[#DB2777] transition"
            >
              Operator
            </Link>
            <Link
              href={volunteerHref}
              className="rounded-xl border border-[#F3D5E5] bg-white px-4 py-2 font-medium text-[#2B1324] hover:border-[#DB2777] hover:text-[#DB2777] transition"
            >
              Volunteer
            </Link>
            <Link
              href={adminHref}
              className="rounded-xl bg-[#DB2777] px-4 py-2 font-semibold text-white hover:bg-[#BE185D] transition"
            >
              Admin
            </Link>
          </div>
        </header>

        <div className="mx-auto max-w-6xl px-6 py-14 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-[#FBCFE8] bg-white px-3.5 py-1.5 text-xs font-medium text-[#DB2777] shadow-xs">
            <Shield className="h-3.5 w-3.5" />
            AI Safety &amp; Community Response
          </div>

          <h1 className="mt-5 font-heading text-4xl font-semibold tracking-tight sm:text-5xl text-[#2B1324]">
            Privacy-First{" "}
            <span className="text-[#DB2777]">AI Safety</span> Monitoring
          </h1>

          <p className="mx-auto mt-4 max-w-xl text-base text-[#7A566E]">
            Real-time pose &amp; distress detection with face-blurred previews and
            instant Telegram alerts for nearby verified volunteers.
          </p>

          <div className="mt-8 flex flex-wrap justify-center gap-3.5">
            <Link
              href={operatorHref}
              className="inline-flex items-center gap-2 rounded-xl bg-[#DB2777] px-6 py-3 text-sm font-semibold text-white hover:bg-[#BE185D] transition shadow-sm"
            >
              Launch Operator Console
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/volunteer/register"
              className="inline-flex items-center gap-2 rounded-xl border border-[#F3D5E5] bg-white px-6 py-3 text-sm font-semibold text-[#2B1324] hover:border-[#DB2777] hover:text-[#DB2777] transition"
            >
              Volunteer Sign Up
            </Link>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl w-full px-6 py-12 flex-1">
        <div className="grid gap-5 md:grid-cols-3">
          <Link
            href={operatorHref}
            className="group rounded-2xl border border-[#F3D5E5] bg-white p-6 hover:border-[#DB2777] transition shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCE7F3] text-[#DB2777]">
                <Video className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-semibold">
                Operator Console
              </h2>
              <p className="mt-1.5 text-sm text-[#7A566E]">
                Monitor live camera feeds, view detections, and dispatch alerts.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#DB2777]">
              Open Console <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </span>
          </Link>

          <Link
            href={volunteerHref}
            className="group rounded-2xl border border-[#F3D5E5] bg-white p-6 hover:border-[#DB2777] transition shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCE7F3] text-[#DB2777]">
                <BellRing className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-semibold">
                Volunteer Portal
              </h2>
              <p className="mt-1.5 text-sm text-[#7A566E]">
                Receive Telegram alerts, view face-blurred clips, and respond.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#DB2777]">
              Open Portal <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </span>
          </Link>

          <Link
            href={adminHref}
            className="group rounded-2xl border border-[#F3D5E5] bg-white p-6 hover:border-[#DB2777] transition shadow-xs flex flex-col justify-between"
          >
            <div>
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#FCE7F3] text-[#DB2777]">
                <UserCheck className="h-5 w-5" />
              </div>
              <h2 className="mt-4 font-heading text-lg font-semibold">
                Admin Portal
              </h2>
              <p className="mt-1.5 text-sm text-[#7A566E]">
                Verify volunteers, configure Telegram, and review logs.
              </p>
            </div>
            <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[#DB2777]">
              Open Admin <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition" />
            </span>
          </Link>
        </div>
      </section>
    </div>
  );
}
