import React from "react";

export function HerShieldLogo({
  subtitle = "Gov-Independent CivicTech",
  compact = false,
}: {
  dark?: boolean;
  subtitle?: string;
  compact?: boolean;
}) {
  return (
    <div className="inline-flex items-center gap-2.5 select-none">
      <div className="w-9 h-9 rounded-lg bg-[#38203F] border border-[#3D2B35] flex items-center justify-center shrink-0">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2L4 5.5V11.5C4 16.8 7.4 21.6 12 23C16.6 21.6 20 16.8 20 11.5V5.5L12 2Z"
            stroke="#BEA3E4"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <circle cx="12" cy="11.5" r="3" fill="#D946A8" />
        </svg>
      </div>
      <div className="flex flex-col leading-tight">
        <span className="font-heading text-[15px] font-semibold text-[#F8F2F7] tracking-tight">
          Her<span className="text-[#FFAEDA]">Shield</span>
        </span>
        {!compact && (
          <span className="text-[11px] font-medium text-[#A99CAF] tracking-[0.2px]">
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );
}
