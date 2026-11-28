"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, KeyRound, Lock, Mail } from "lucide-react";
import { HerShieldLogo } from "./HerShieldLogo";
import type { UserRole } from "@/lib/types";

export interface DemoAccountOption {
  label: string;
  email: string;
  password: string;
}

export function LoginForm({
  portalTitle,
  portalSubtitle,
  expectedRole,
  redirectTo,
  demoEmail,
  demoPassword,
  extraDemoAccounts = [],
  showRegisterLink = false,
}: {
  portalTitle: string;
  portalSubtitle: string;
  expectedRole: UserRole;
  redirectTo: string;
  demoEmail: string;
  demoPassword: string;
  extraDemoAccounts?: DemoAccountOption[];
  showRegisterLink?: boolean;
}) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, expectedRole }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Sign-in failed.");
        setLoading(false);
        return;
      }
      router.push(redirectTo);
      router.refresh();
    } catch {
      setError("Network error while signing in.");
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen hs-gradient-hero flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-2xl border border-[#F3D5E5] bg-white p-7 shadow-2xl text-[#2B1324]">
        <div className="mb-6 flex items-center justify-between">
          <HerShieldLogo subtitle={`${expectedRole} portal`} />
          <span className="rounded-full bg-[#FCE7F3] border border-[#F3D5E5] px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-[#2B1324]">
            {expectedRole}
          </span>
        </div>

        <h1 className="font-heading text-2xl font-semibold text-[#2B1324]">
          {portalTitle}
        </h1>
        <p className="mt-1 text-sm text-[#7A566E]">{portalSubtitle}</p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#7A566E]">
              Email address
            </label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7A566E]" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={demoEmail}
                className="w-full rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] py-2.5 pl-10 pr-3 text-sm text-[#2B1324] placeholder-[#7E7388] outline-none focus:border-[#BEA3E4]"
              />
            </div>
          </div>

          <div>
            <label className="mb-1.5 block text-xs font-medium text-[#7A566E]">
              Password
            </label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-[#7A566E]" />
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••••"
                className="w-full rounded-lg border border-[#F3D5E5] bg-[#FFF7FA] py-2.5 pl-10 pr-3 text-sm text-[#2B1324] placeholder-[#7E7388] outline-none focus:border-[#BEA3E4]"
              />
            </div>
          </div>

          {error && (
            <div className="rounded-lg border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-medium text-rose-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-[#DB2777] py-2.5 text-sm font-semibold text-white hover:bg-[#BE185D] disabled:opacity-60 transition cursor-pointer"
          >
            {loading ? "Signing in…" : "Sign In Securely"}
            <ArrowRight className="h-4 w-4" />
          </button>
        </form>

        <div className="mt-5 rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] p-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-[#2B1324]">
              <KeyRound className="h-3.5 w-3.5 text-[#DB2777]" />
              Hackathon Demo Credentials
            </div>
            <button
              type="button"
              onClick={() => {
                setEmail(demoEmail);
                setPassword(demoPassword);
              }}
              className="rounded-md bg-[#FCE7F3] border border-[#F3D5E5] px-2.5 py-1 text-[11px] font-medium text-[#DB2777] hover:bg-[#DB2777] hover:text-white transition cursor-pointer"
            >
              Fill Demo Login
            </button>
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-[#7A566E]">
            {demoEmail} / {demoPassword}
          </p>
          {extraDemoAccounts.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5 pt-2 border-t border-[#F3D5E5]">
              {extraDemoAccounts.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => {
                    setEmail(acc.email);
                    setPassword(acc.password);
                  }}
                  className="rounded-md border border-[#F3D5E5] bg-[#FFF7FA] px-2 py-1 text-[10px] font-medium text-[#DB2777] hover:border-[#DB2777] hover:text-white cursor-pointer"
                >
                  {acc.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {showRegisterLink && (
          <div className="mt-4 rounded-xl border border-[#F3D5E5] bg-[#FFF7FA] p-3.5 text-center space-y-2">
            <p className="text-xs text-[#7A566E]">
              New volunteer? Register and open the Telegram bot chat to start
              receiving alerts:
            </p>
            <Link
              href="/volunteer/register"
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-[#D946A8]/50 bg-[#FCE7F3] py-2 text-xs font-semibold text-[#DB2777] hover:bg-[#DB2777] hover:text-white transition"
            >
              Register with Telegram Bot
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}

        <div className="mt-4 flex justify-center gap-4 border-t border-[#F3D5E5] pt-3 text-xs text-[#7A566E]">
          <Link href="/" className="hover:text-[#2B1324]">
            Home
          </Link>
          <Link href="/operator/login" className="hover:text-[#2B1324]">
            Operator
          </Link>
          <Link href="/volunteer/login" className="hover:text-[#2B1324]">
            Volunteer
          </Link>
          <Link href="/admin/login" className="hover:text-[#2B1324]">
            Admin
          </Link>
        </div>
      </div>
    </div>
  );
}
