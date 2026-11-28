"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  Activity,
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
  const [aiOnline, setAiOnline] = useState<boolean>(false);

  useEffect(() => {
    let active = true;
    fetch("/api/system/status")
      .then((r) => r.json())
      .then((d) => {
        if (!active) return;
        setAiOnline(Boolean(d.aiService?.online));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [pathname]);

  async function handleSignOut() {
    await fetch("/api/auth/session", { method: "DELETE" });
    router.push("/");
    router.refresh();
  }

  const navItems = PORTAL_NAV[role] || [];
  const meta = PORTAL_TITLES[role];

  return (
    <div className="min-h-screen flex bg-[#FFF7FA] text-[#2B1324]">
      <aside className="w-56 shrink-0 min-h-screen bg-white border-r border-[#F3D5E5] hidden lg:flex flex-col justify-between p-4 sticky top-0 h-screen">
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
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                    active
                      ? "bg-[#FCE7F3] text-[#DB2777]"
                      : "text-[#7A566E] hover:bg-[#FDF2F8] hover:text-[#2B1324]"
                  }`}
                >
                  <span className={active ? "text-[#DB2777]" : "text-[#9E7B92]"}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        <button
          type="button"
          onClick={handleSignOut}
          className="w-full flex items-center justify-center gap-2 rounded-xl border border-[#F3D5E5] bg-[#FDF2F8] px-3 py-2 text-xs font-medium text-[#7A566E] hover:border-[#DB2777] hover:text-[#DB2777] transition-colors cursor-pointer"
        >
          <LogOut className="h-3.5 w-3.5" />
          Home
        </button>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 px-4 sm:px-6 bg-white/95 backdrop-blur border-b border-[#F3D5E5] flex items-center justify-between gap-4 sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setMobileOpen((v) => !v)}
              className="rounded-lg p-1.5 text-[#DB2777] hover:bg-[#FCE7F3] lg:hidden"
              aria-label="Toggle navigation"
            >
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
            <h1 className="font-heading text-base sm:text-lg font-semibold text-[#2B1324] truncate">
              {pageTitle || meta.headerTitle}
            </h1>
          </div>

          <div className="flex items-center gap-3">
            {role === "operator" && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#FDF2F8] border border-[#F3D5E5] text-xs font-medium text-[#2B1324]">
                <span
                  className={`inline-block w-2 h-2 rounded-full ${
                    aiOnline ? "bg-emerald-500" : "bg-rose-400"
                  }`}
                />
                <span>{aiOnline ? "AI Online" : "AI Offline"}</span>
              </div>
            )}

            {userName && (
              <div className="flex items-center gap-2 pl-3 border-l border-[#F3D5E5]">
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#FCE7F3] text-xs font-semibold text-[#DB2777]">
                  <Users className="h-3.5 w-3.5" />
                </div>
                <span className="hidden sm:inline text-xs font-medium text-[#2B1324] max-w-[140px] truncate">
                  {userName}
                </span>
              </div>
            )}
          </div>
        </header>

        {mobileOpen && (
          <div className="border-b border-[#F3D5E5] bg-white px-4 py-3 lg:hidden">
            <nav className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-medium text-[#2B1324] hover:bg-[#FCE7F3]"
                >
                  {item.icon}
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        )}

        <main className="flex-1 p-4 sm:p-6 flex flex-col gap-5 max-w-[1400px] w-full mx-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
