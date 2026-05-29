"use client";
// Pembungkus StatCard yang bisa diklik (membuka modal detail metric).

import { StatCard } from "@/components/ui";

export function ClickableStat({ label, value, hint, tone, icon, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group h-full w-full rounded-xl text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="h-full rounded-xl transition-transform duration-150 group-hover:-translate-y-0.5">
        <StatCard label={label} value={value} hint={hint} tone={tone} icon={icon} />
      </div>
    </button>
  );
}
