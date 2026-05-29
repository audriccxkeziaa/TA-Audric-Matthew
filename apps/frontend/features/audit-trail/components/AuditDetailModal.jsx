"use client";
// Modal detail forensik audit log. Bagian "Detail Forensik" hanya untuk admin.

import { Modal } from "@/components/ui";
import { tanggalJam } from "@/lib/format";
import {
  ruleBadge,
  actionBadge,
  humanSource,
  humanReason,
  ContextPayloadTable,
} from "./auditHelpers";

export function AuditDetailModal({ detailRow, onClose, isAdmin }) {
  return (
    <Modal
      open={Boolean(detailRow)}
      onClose={onClose}
      title="Detail Audit Log"
      width="max-w-2xl"
    >
      {detailRow && (
        <div className="space-y-3 text-sm">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs uppercase text-slate-400">Waktu</p>
              <p>{tanggalJam(detailRow.created_at)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">User</p>
              <p>
                {detailRow.username || "—"}{" "}
                <span className="text-slate-400">
                  ({detailRow.user_role || "—"})
                </span>
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Barang</p>
              <p>
                {detailRow.nama_barang || "—"}
                {detailRow.kode_barang && (
                  <span className="block font-mono text-xs text-slate-400">
                    {detailRow.kode_barang}
                  </span>
                )}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Sumber</p>
              <p className="capitalize">{humanSource(detailRow.source_type)}</p>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Rule</p>
              <div className="mt-0.5">{ruleBadge(detailRow.rule_triggered)}</div>
            </div>
            <div>
              <p className="text-xs uppercase text-slate-400">Aksi</p>
              <div className="mt-0.5">{actionBadge(detailRow.rule_action)}</div>
            </div>
          </div>

          <div className="rounded-lg bg-slate-50 p-3">
            <p className="text-xs uppercase text-slate-400">Perubahan Stok</p>
            <p className="mt-1 font-semibold">
              {detailRow.stok_sebelum ?? "—"}{" "}
              <span className="text-slate-400">→</span>{" "}
              {detailRow.stok_sesudah ?? "—"}
              <span className="ml-2 text-xs text-slate-500">
                (Δ {detailRow.delta_qty > 0 ? "+" : ""}
                {detailRow.delta_qty})
              </span>
            </p>
          </div>

          <div>
            <p className="text-xs uppercase text-slate-400">Alasan</p>
            <p className="mt-1 text-slate-700">
              {humanReason(detailRow) || "—"}
            </p>
          </div>

          {isAdmin && detailRow.context_payload && (
            <div className="mt-2 border-t border-slate-100 pt-3">
              <span className="text-xs font-semibold uppercase tracking-wider text-red-500">
                Detail Forensik (Admin)
              </span>
              <ContextPayloadTable payload={detailRow.context_payload} />
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
