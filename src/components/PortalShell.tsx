"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
  Bot,
  ChevronDown,
  Cpu,
  Database,
  History,
  LayoutDashboard,
  LogOut,
  MapPin,
  Menu,
  RefreshCw,
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

interface SystemStatusPayload {
  dbMode?: "mongodb_atlas" | "unconfigured" | "connection_error";
  dbNotice?: string | null;
  telegram?: {
    configured: boolean;
    username?: string;
    firstName?: string;
    error?: string;
  };
  aiService?: {
    url?: string;
    online: boolean;
    device?: string;
    gpuName?: string | null;
    fps?: number;
    running?: boolean;
    error?: string;
  };
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
      label: "Locations & Volunteers",
      icon: <MapPin className="h-[18px] w-[18px]" />,
    },
    {
      href: "/operator/settings",
      label: "Settings",
      icon: <Settings className="h-[18px] w-[18px]" />,
    },
  ],
  volunteer: [
    {
      href: "/volunteer",
      label: "Dashboard",
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
      label: "Volunteers",
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

const PORTAL_TITLES: Record<UserRole, { portalName: string; headerTitle: string }> = {
  operator: {
    portalName: "Operator Portal",
    headerTitle: "Operator Console",
  },
  volunteer: {
    portalName: "Volunteer Portal",
    headerTitle: "Volunteer Dashboard",
  },
  admin: {
    portalName: "Admin Portal",
    headerTitle: "Admin Portal",
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
  const [statusOpen, setStatusOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [sysStatus, setSysStatus] = useState<SystemStatusPayload | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const loadStatus = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      const res = await fetch("/api/system/status", { cache: "no-store" });
      if (res.ok) {
        const data = (await res.json()) as SystemStatusPayload;
        setSysStatus(data);
      }
    } catch {
      // Keep last known status
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const initial = setTimeout(() => void loadStatus(false), 0);
    const timer = setInterval(() => void loadStatus(false), 10000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [pathname, loadStatus]);

  useEffect(() => {
    function handleOutsideClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setStatusOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const dbOk = sysStatus?.dbMode === "mongodb_atlas";
  const aiOk = Boolean(sysStatus?.aiService?.online);
  const tgOk = Boolean(sysStatus?.telegram?.configured && !sysStatus?.telegram?.error);
  const hasFailure = sysStatus !== null && (!dbOk || !aiOk || !tgOk);

  const navItems = PORTAL_NAV[role] || [];
  const meta = PORTAL_TITLES[role];

  return (
    <div className="min-h-screen flex flex-col bg-[#160E1F] text-[#F8F2F7]">
      {/* Top Header */}
      <header className="h-14 px-4 sm:px-6 bg-[#211829]/95 backdrop-blur border-b border-[#3D2B35] flex items-center justify-between gap-4 sticky top-0 z-30">
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={() => setMobileOpen((v) => !v)}
            className="rounded-lg p-1.5 text-[#BEA3E4] hover:bg-[#38203F] lg:hidden"
            aria-label="Toggle navigation"
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
          <Link href="/" className="shrink-0">
            <HerShieldLogo compact />
          </Link>
          <span className="hidden sm:inline-block h-4 w-px bg-[#3D2B35]" />
          <h1 className="font-heading text-sm sm:text-base font-semibold text-[#F8F2F7] truncate">
            {pageTitle || meta.headerTitle}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Single Backend Status Button (blinks when any integration fails) */}
          <div className="relative" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setStatusOpen((v) => !v)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${hasFailure
                ? "bg-[#93000A]/40 border-[#FFB4AB]/50 text-[#FFDAD6] animate-pulse"
                : "bg-[#241C2E] border-[#3D2B35] text-[#F8F2F7] hover:border-[#D946A8]"
                }`}
            >
              <span className="relative flex h-2 w-2">
                {hasFailure && (
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FFB4AB] opacity-75" />
                )}
                <span
                  className={`relative inline-flex rounded-full h-2 w-2 ${sysStatus === null
                    ? "bg-[#7E7388]"
                    : hasFailure
                      ? "bg-[#FFB4AB]"
                      : "bg-[#4EDEA3]"
                    }`}
                />
              </span>
              <span>
                {sysStatus === null
                  ? "Checking..."
                  : hasFailure
                    ? "Backend Issue"
                    : "System OK"}
              </span>
              <ChevronDown className="h-3.5 w-3.5 opacity-70" />
            </button>

            {statusOpen && (
              <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-[#3D2B35] bg-[#211829] p-4 shadow-xl z-50 space-y-3 text-[#F8F2F7]">
                <div className="flex items-center justify-between border-b border-[#3D2B35] pb-2">
                  <span className="text-xs font-semibold text-[#F8F2F7]">
                    Backend Integrations
                  </span>
                  <button
                    type="button"
                    onClick={() => void loadStatus(true)}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-[#FFAEDA] hover:underline cursor-pointer"
                  >
                    <RefreshCw
                      className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`}
                    />
                    Refresh
                  </button>
                </div>

                {/* MongoDB Atlas */}
                <div className="flex items-start justify-between gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Database className="h-4 w-4 text-[#BEA3E4] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-[#F8F2F7]">
                        MongoDB Atlas
                      </p>
                      <p className="text-[11px] text-[#A99CAF]">
                        {dbOk
                          ? "Connected"
                          : sysStatus?.dbNotice || "Local fallback active"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${dbOk
                      ? "bg-[#005236] text-[#6FFBBE]"
                      : "bg-[#93000A] text-[#FFDAD6]"
                      }`}
                  >
                    {dbOk ? "Online" : "Failed"}
                  </span>
                </div>

                {/* AI Engine */}
                <div className="flex items-start justify-between gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Cpu className="h-4 w-4 text-[#BEA3E4] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-[#F8F2F7]">
                        AI Engine
                      </p>
                      <p className="text-[11px] text-[#A99CAF]">
                        {aiOk
                          ? `${sysStatus?.aiService?.device === "cuda"
                            ? sysStatus.aiService.gpuName || "CUDA GPU"
                            : "CPU"
                          } • ${sysStatus?.aiService?.fps ?? 0} FPS`
                          : sysStatus?.aiService?.error || "Offline"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${aiOk
                      ? "bg-[#005236] text-[#6FFBBE]"
                      : "bg-[#93000A] text-[#FFDAD6]"
                      }`}
                  >
                    {aiOk ? "Live" : "Offline"}
                  </span>
                </div>

                {/* Telegram Bot */}
                <div className="flex items-start justify-between gap-2 text-xs">
                  <div className="flex items-start gap-2">
                    <Bot className="h-4 w-4 text-[#BEA3E4] mt-0.5 shrink-0" />
                    <div>
                      <p className="font-semibold text-[#F8F2F7]">
                        Telegram Bot
                      </p>
                      <p className="text-[11px] text-[#A99CAF]">
                        {tgOk
                          ? `@${sysStatus?.telegram?.username || "Connected"}`
                          : sysStatus?.telegram?.error || "Not configured"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${tgOk
                      ? "bg-[#005236] text-[#6FFBBE]"
                      : "bg-[#93000A] text-[#FFDAD6]"
                      }`}
                  >
                    {tgOk ? "Connected" : "Failed"}
                  </span>
                </div>
              </div>
            )}
          </div>

          {userName && (
            <div className="flex items-center gap-2 pl-3 border-l border-[#3D2B35]">
              <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#38203F] border border-[#3D2B35] text-xs font-semibold text-[#FFAEDA]">
                <Users className="h-3.5 w-3.5" />
              </div>
              <span className="hidden sm:inline text-xs font-medium text-[#F8F2F7] max-w-[140px] truncate">
                {userName}
              </span>
            </div>
          )}
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
                className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#F8F2F7] hover:bg-[#38203F]"
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>
        </div>
      )}

      {/* Floating Pill Icon Dock (Left Side Panel) */}
      <aside
        aria-label={`${role} navigation`}
        className="hidden lg:flex fixed left-4 top-1/2 -translate-y-1/2 z-20 flex-col items-center gap-1.5 rounded-full border border-[#3D2B35] bg-[#211829]/95 backdrop-blur p-1.5 shadow-xl"
      >
        {navItems.map((item) => {
          const active =
            item.href === `/${role}`
              ? pathname === item.href
              : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className={`group relative flex h-10 w-10 items-center justify-center rounded-full transition-all ${active
                ? "bg-[#D946A8] text-white shadow-sm"
                : "text-[#A99CAF] hover:bg-[#38203F] hover:text-[#F8F2F7]"
                }`}
            >
              {item.icon}
              <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-lg border border-[#3D2B35] bg-[#211829] px-2.5 py-1 text-xs font-medium text-[#F8F2F7] opacity-0 shadow-md transition-opacity group-hover:opacity-100">
                {item.label}
              </span>
            </Link>
          );
        })}

        <div className="my-0.5 h-px w-6 bg-[#3D2B35]" />

        <button
          type="button"
          onClick={handleSignOut}
          title="Home / Exit"
          aria-label="Home / Exit"
          className="group relative flex h-10 w-10 items-center justify-center rounded-full text-[#A99CAF] hover:bg-[#38203F] hover:text-[#FFAEDA] transition-all cursor-pointer"
        >
          <LogOut className="h-[18px] w-[18px]" />
          <span className="pointer-events-none absolute left-12 whitespace-nowrap rounded-lg border border-[#3D2B35] bg-[#211829] px-2.5 py-1 text-xs font-medium text-[#F8F2F7] opacity-0 shadow-md transition-opacity group-hover:opacity-100">
            Home
          </span>
        </button>
      </aside>

      <main className="flex-1 p-4 sm:p-6 lg:pl-20 flex flex-col gap-5 max-w-[1440px] w-full mx-auto">
        {children}
      </main>
    </div>
  );
}
