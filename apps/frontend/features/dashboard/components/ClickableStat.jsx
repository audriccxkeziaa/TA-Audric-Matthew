"use client";
// Pembungkus StatCard yang bisa diklik (membuka modal detail metric).

import { StatCard } from "@/components/ui";

export function ClickableStat({ label, value, hint, tone, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className="group rounded-xl text-left transition focus:outline-none focus:ring-2 focus:ring-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="rounded-xl transition group-hover:-translate-y-0.5 group-hover:shadow-md">
        <StatCard label={label} value={value} hint={hint} tone={tone} />
      </div>
    </button>
  );
}
