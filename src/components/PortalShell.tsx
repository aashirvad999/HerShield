"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  AlertTriangle,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  Settings,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
  X,
} from "lucide-react";
import { HerShieldLogo } from "./HerShieldLogo";
import type { UserRole } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: React.ReactNode;
}

const PORTAL_NAV: Record<UserRole, NavItem[]> = {
  operator: [
    {
      href: "/operator",
      label: "Live Monitoring",
      icon: <Activity className="h-[18px] w-[18px]" />,
    },
    {
      href: "/operator/history",
      label: "Incident History",
      icon: <History className="h-[18px] w-[18px]" />,
    },
    {
      href: "/operator/locations",
      label: "Location & Volunteers",
      icon: <MapPin className="h-[18px] w-[18px]" />,
    },
    {
      href: "/operator/settings",
      label: "Operator Settings",
      icon: <Settings className="h-[18px] w-[18px]" />,
    },
  ],
  volunteer: [
    {
      href: "/volunteer",
      label: "Volunteer Dashboard",
      icon: <ShieldCheck className="h-[18px] w-[18px]" />,
    },
    {
      href: "/volunteer/settings",
      label: "Profile & Telegram",
      icon: <Settings className="h-[18px] w-[18px]" />,
    },
  ],
  admin: [
    {
      href: "/admin",
      label: "Overview",
      icon: <LayoutDashboard className="h-[18px] w-[18px]" />,
    },
    {
      href: "/admin/volunteers",
      label: "Verification Queue",
      icon: <UserCheck className="h-[18px] w-[18px]" />,
    },
    {
      href: "/operator/history",
      label: "Incident Logs",
      icon: <Shield className="h-[18px] w-[18px]" />,
    },
    {
      href: "/admin/settings",
      label: "Settings",
      icon: <Settings className="h-[18px] w-[18px]" />,
    },
  ],
};

const PORTAL_TITLES: Record<UserRole, { portalName: string; headerTitle: string; policyTitle: string; policyDesc: string }> = {
  operator: {
    portalName: "Operator Portal",
    headerTitle: "Operator Safety Monitoring",
    policyTitle: "PrivacyShield Active",
    policyDesc: "Raw feeds stay local on operator node. Only non-identifying skeletons reach volunteers.",
  },
  volunteer: {
    portalName: "Volunteer Portal",
    headerTitle: "Community Volunteer Network",
    policyTitle: "Safe Response Policy",
    policyDesc: "Never confront suspects directly. Support safely and dial 112 for official emergency response.",
  },
  admin: {
    portalName: "Admin Portal",
    headerTitle: "Volunteer Verification Management",
    policyTitle: "Prototype Verification",
    policyDesc: "Manual admin simulation only. Not a live criminal background check.",
  },
};

export function PortalShell({
  role,
  userName,
  pageTitle,
  children,
}: {
  role: UserRole;
  userName?: string;
  pageTitle?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [noticeDismissed, setNoticeDismissed] = useState(false);
  const [status, setStatus] = useState<{
    dbMode?: string;
    dbNotice?: string | null;
    aiOnline?: boolean;
  }>({});

  useEffect(() => {
    let active = true;
    fetch("/api/system/status")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setStatus({
          dbMode: d.dbMode,
          dbNotice: d.dbNotice,
          aiOnline: Boolean(d.aiService?.online),
        });
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push(`/${role}/login`);
    router.refresh();
  }

  const navItems = PORTAL_NAV[role] || [];
  const meta = PORTAL_TITLES[role];

  return (
    <div className="min-h-screen flex bg-[#160E1F] text-[#F8F2F7]">
      {/* Persistent Left Sidebar (Stitch Design System) */}
      <aside className="w-60 shrink-0 min-h-screen bg-[#211829] border-r border-[#3D2B35] hidden lg:flex flex-col justify-between p-4 sticky top-0 h-screen">
        <div className="flex flex-col gap-6">
          <Link href="/" className="px-2 py-1">
            <HerShieldLogo subtitle={meta.portalName} />
          </Link>

          <nav aria-label={`${role} navigation`} className="flex flex-col gap-1">
            {navItems.map((item) => {
              const active =
                item.href === `/${role}`
                  ? pathname === item.href
                  : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#38203F] text-[#EDDCFF] border border-[#3D2B35]"
                      : "text-[#A99CAF] hover:bg-[#241C2E] hover:text-[#F8F2F7]"
                  }`}
                >
                  <span className={active ? "text-[#BEA3E4]" : "text-[#A99CAF]"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <div className="space-y-3">
          <div className="rounded-xl bg-[#241C2E] border border-[#3D2B35] p-3 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-[#BEA3E4]" />
              <span className="text-xs font-medium text-[#F8F2F7]">
                {meta.policyTitle}
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-[#A99CAF]">
              {meta.policyDesc}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSignOut}
            className="w-full flex items-center justify-center gap-2 rounded-lg border border-[#3D2B35] bg-[#160E1F] px-3 py-2 text-xs font-medium text-[#A99CAF] hover:border-[#D946A8] hover:text-[#F8F2F7] transition-colors cursor-pointer"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 px-4 sm:px-6 bg-[#211829] border-b border-[#3D2B35] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-1.5 text-[#BEA3E4] hover:bg-[#38203F] lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="font-heading text-base sm:text-[20px] font-semibold text-[#F8F2F7] truncate">
              {pageTitle || meta.headerTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#241C2E] border border-[#3D2B35] text-xs font-medium">
              <span
                className={`inline-block w-2 h-2 rounded-full ${
                  status.dbMode === "mongodb_atlas"
                    ? "bg-[#4EDEA3]"
                    : "bg-[#FFB95F]"
                }`}
              />
              <Database className="h-3 w-3 text-[#BEA3E4]" />
              <span className="text-[#F8F2F7]">
                {status.dbMode === "mongodb_atlas"
                  ? "MongoDB Atlas"
                  : "Fallback Store"}
              </span>
            </div>

            {role === "operator" && (
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#241C2E] border border-[#3D2B35] text-xs font-medium">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    status.aiOnline ? "bg-[#4EDEA3]" : "bg-[#FFB4AB]"
                  }`}
                />
                <span>{status.aiOnline ? "AI Engine Live" : "AI Offline"}</span>
              </div>
            )}

            {role === "admin" && (
              <div className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#241C2E] border border-[#3D2B35] text-xs font-medium">
                <span className="inline-block w-2 h-2 rounded-full bg-[#4EDEA3]" />
                <span>Audit Log Active</span>
              </div>
            )}

            {userName && (
              <div className="flex items-center gap-2.5 pl-3 border-l border-[#3D2B35]">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#38203F] border border-[#3D2B35] text-xs font-semibold text-[#FFAEDA]">
                  <Users className="h-4 w-4" />
                </div>
                <div className="hidden sm:flex flex-col">
                  <span className="text-xs font-medium text-[#F8F2F7] max-w-[150px] truncate">
                    {userName}
                  </span>
                  <span className="text-[11px] text-[#A99CAF] capitalize">
                    {role}
                  </span>
                </div>
              </div>
            )}

            <button
              type="button"
              onClick={handleSignOut}
              className="lg:hidden rounded-lg border border-[#3D2B35] bg-[#160E1F] p-2 text-[#A99CAF] hover:text-[#F8F2F7]"
              title="Sign Out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </header>

        {mobileOpen && (
          <div className="border-b border-[#3D2B35] bg-[#211829] px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium text-[#F8F2F7] hover:bg-[#38203F]"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        {status.dbNotice && !noticeDismissed && (
          <div className="border-b border-[#653E00] bg-[#653E00]/35 px-4 py-2 text-xs text-[#FFDDB8]">
            <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0 text-[#FFB95F]" />
                <span>
                  <strong>Database Notice:</strong> {status.dbNotice} Add{" "}
                  <code className="rounded bg-[#160E1F] px-1.5 py-0.5 text-[#FFAEDA]">
                    MONGODB_URI
                  </code>{" "}
                  to <code className="rounded bg-[#160E1F] px-1.5 py-0.5">.env.local</code>{" "}
                  and restart the server to connect MongoDB Atlas.
                </span>
              </div>
              <button
                type="button"
                onClick={() => setNoticeDismissed(true)}
                className="shrink-0 rounded px-2 py-0.5 text-[11px] font-medium text-[#FFDDB8] hover:bg-[#653E00]/60 cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 flex flex-col gap-6 max-w-[1440px] w-full mx-auto">
          {children}
        </main>

        <footer className="border-t border-[#3D2B35] bg-[#120B1B] px-6 py-3 text-center text-xs text-[#A99CAF]">
          HerShield CivicTech Prototype — Complements official emergency services (112) and never replaces them. PrivacyShield keeps raw footage off volunteer devices.
        </footer>
      </div>
    </div>
  );
}
