"use client";
// Satu baris item pada tabel validasi: keputusan produk (restock/baru/cari),
// lookup kode (debounce + Enter scanner, auto-fill bila cocok 100%), field
// editable, subtotal, dan checkbox 'Diperiksa' untuk jalur tulisan tangan.
// Untuk restock: field TIDAK dikunci — user bisa edit untuk update master barang.

import { useState, useRef, useEffect } from "react";
import { productsApi } from "@/lib/api";
import { rupiah, persen } from "@/lib/format";
import { Badge } from "@/components/ui";
import { kodeSimilarity } from "../lib/rows";
import { MerkPopup } from "@/components/MerkPopup";

export function ItemRow({
  index,
  row,
  isHandwritten,
  merkList,
  onPatch,
  onRemove,
  onDecisionChange,
}) {
  const [autoFillMsg, setAutoFillMsg] = useState("");
  const debounceRef = useRef(null);
  const onPatchRef = useRef(onPatch);
  const onDecisionRef = useRef(onDecisionChange);
  onPatchRef.current = onPatch;
  onDecisionRef.current = onDecisionChange;

  // Lookup kode ke database — dipakai oleh debounce (onChange) dan Enter (scanner).
  // Tidak dipakai untuk item yang sudah berstatus 'restock' (jaga product_id).
  async function lookupKode(trimmed) {
    if (!trimmed || trimmed.length < 3) return;
    try {
      const res = await productsApi.list({ q: trimmed, limit: 5 });
      const products = res?.data || [];
      const norm = (k) => (k || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();

      const exact = products.find((p) => norm(p.kode_barang) === norm(trimmed));
      if (exact) {
        onPatchRef.current({
          nama_barang: exact.nama_barang || "",
          harga_beli: exact.harga_beli ?? 0,
          harga_jual: exact.harga_jual ?? 0,
          merk: exact.merk || "",
          candidates: [{ product_id: exact.id, kode_barang: exact.kode_barang, nama_barang: exact.nama_barang, merk: exact.merk, harga_beli: exact.harga_beli, harga_jual: exact.harga_jual, similarity: 1.0 }],
          _orig_product: {
            kode_barang: exact.kode_barang,
            nama_barang: exact.nama_barang,
            merk: exact.merk || "",
            harga_beli: exact.harga_beli ?? 0,
            harga_jual: exact.harga_jual ?? 0,
          },
        });
        onDecisionRef.current(`cand:${exact.id}`);
        setAutoFillMsg(`Kode cocok 100% — data terisi dari "${exact.nama_barang}"`);
        return;
      }

      const withSim = products.map((p) => ({
        product_id: p.id,
        kode_barang: p.kode_barang,
        nama_barang: p.nama_barang,
        merk: p.merk,
        harga_beli: p.harga_beli,
        harga_jual: p.harga_jual,
        similarity: kodeSimilarity(trimmed, p.kode_barang),
      }));
      const highMatches = withSim.filter((c) => c.similarity >= 0.8);

      if (highMatches.length > 0) {
        onPatchRef.current({ candidates: highMatches, action: null, product_id: null, picked_label: "" });
      } else {
        onPatchRef.current({ candidates: [], action: "new", product_id: null, picked_label: "" });
      }
    } catch {
      // gagal fetch — diam saja
    }
  }

  function handleKodeChange(e) {
    const val = e.target.value;
    onPatch({ kode_barang: val });
    setAutoFillMsg("");

    // Untuk restock: mengedit kode hanya mengubah nilai untuk update master barang,
    // tidak men-trigger ulang product lookup agar product_id tetap.
    if (row.action === "restock") return;

    if (debounceRef.current) clearTimeout(debounceRef.current);
    const trimmed = val.trim();
    if (!trimmed || trimmed.length < 3) {
      onPatchRef.current({ candidates: [], action: null, product_id: null, picked_label: "" });
      return;
    }
    debounceRef.current = setTimeout(() => lookupKode(trimmed), 500);
  }

  // Enter dari barcode scanner → langsung lookup tanpa tunggu debounce
  function handleKodeKeyDown(e) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    if (row.action === "restock") return; // edit kode pada restock tidak re-lookup
    if (debounceRef.current) clearTimeout(debounceRef.current);
    lookupKode(row.kode_barang.trim());
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current); }, []);

  function fieldClass(field) {
    if (
      isHandwritten &&
      row.source === "ocr" &&
      typeof row.confidence?.[field] === "number" &&
      row.confidence[field] < 70
    ) {
      return "bg-amber-50 border-amber-300";
    }
    return "";
  }

  let decisionValue = "";
  if (row.action === "new") decisionValue = "new";
  else if (row.action === "restock" && row.product_id)
    decisionValue = `cand:${row.product_id}`;

  const highCandidates = row.candidates.filter((c) => c.similarity >= 0.8);
  const candidateInList = highCandidates.some((c) => c.product_id === row.product_id);
  const showHighMatchAlert = highCandidates.length > 0 && !row.action;

  const inputBase =
    "w-full rounded-lg border px-2 py-1.5 text-sm outline-none focus:ring-2 focus:ring-brand-500 transition-all";

  // Subtotal per baris dengan diskon per item (opsional — kosong berarti 0).
  const qtyNum = Number(row.qty) || 0;
  const hargaNum = Number(row.harga_beli) || 0;
  const diskonNum = Math.min(Math.max(Number(row.diskon_persen) || 0, 0), 100);
  const lineGross = qtyNum * hargaNum;
  const lineNet = Math.round(lineGross * (1 - diskonNum / 100));

  return (
    <div className="rounded-lg border border-slate-200 p-3">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">
          Item #{index + 1}{" "}
          {row.source === "ocr" ? (
            <Badge tone="blue">OCR</Badge>
          ) : (
            <Badge tone="slate">Manual</Badge>
          )}
          {row.source === "ocr" && typeof row.confidence_avg === "number" && (
            <span className="ml-1 text-slate-400">conf {row.confidence_avg}</span>
          )}
        </span>
        <button onClick={onRemove} className="text-xs text-red-500 hover:underline">
          Delete Row
        </button>
      </div>

      {/* Peringatan validasi */}
      {row.needs_review && (row.review_reasons?.length > 0) && (
        <div className="mb-2 rounded-md border border-red-300 bg-red-50 px-3 py-2">
          <p className="text-xs font-semibold text-red-800">
            Perlu diperiksa — sistem mendeteksi kemungkinan salah baca:
          </p>
          <ul className="mt-0.5 list-disc pl-4 text-[11px] text-red-700">
            {row.review_reasons.map((reason, i) => (
              <li key={i}>{reason}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Alert kesamaan tinggi */}
      {showHighMatchAlert && (
        <div className="mb-2 rounded-md border border-amber-300 bg-amber-50 px-3 py-2">
          <p className="text-xs font-semibold text-amber-800">
            Ditemukan produk dengan kesamaan cukup tinggi — silakan periksa dropdown di bawah.
          </p>
          <p className="mt-0.5 text-[11px] text-amber-700">
            {highCandidates.map((c) => `${c.kode_barang} — ${c.nama_barang} (${persen(c.similarity)})`).join("; ")}
          </p>
        </div>
      )}

      {/* Keputusan produk */}
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          {highCandidates.length > 0 ? "Cocokkan ke produk yang ada" : "Pilih tindakan"}
        </span>
        <select
          value={decisionValue}
          onChange={(e) => onDecisionChange(e.target.value)}
          className={`w-full rounded-lg border bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500 ${
            showHighMatchAlert ? "border-amber-400" : "border-slate-300"
          }`}
        >
          <option value="">— Pilih tindakan —</option>
          {row.action === "restock" && !candidateInList && row.product_id && (
            <option value={`cand:${row.product_id}`}>
              {row.picked_label} (dipilih)
            </option>
          )}
          {highCandidates.map((c) => (
            <option key={c.product_id} value={`cand:${c.product_id}`}>
              {c.nama_barang} — {c.kode_barang} ({persen(c.similarity)})
            </option>
          ))}
          <option value="new">+ Buat produk baru</option>
          <option value="search">Cari produk lain di master barang...</option>
        </select>
      </label>

      {row.action === "restock" && row.picked_label && (
        <p className="mt-1 text-xs text-emerald-600">
          Restock: {row.picked_label}
          {row._orig_product && (
            <span className="ml-1 text-slate-400">(edit field di bawah untuk update data master)</span>
          )}
        </p>
      )}
      {row.action === "new" && (
        <p className="mt-1 text-xs text-blue-600">
          Produk baru akan dibuat dari kode &amp; nama di bawah.
        </p>
      )}

      {/* Field editable — semua aktif termasuk saat restock (perubahan update master barang) */}
      <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2 md:grid-cols-3">
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Kode Barang <span className="text-red-500">*</span>
          </span>
          <input
            value={row.kode_barang}
            onChange={handleKodeChange}
            onKeyDown={handleKodeKeyDown}
            placeholder="Ketik / scan barcode → Enter"
            className={`${inputBase} ${fieldClass("kode_barang") || "border-slate-300"}`}
          />
          {autoFillMsg && (
            <span className="mt-0.5 block text-[10px] font-medium text-emerald-600">{autoFillMsg}</span>
          )}
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Nama Barang <span className="text-red-500">*</span>
          </span>
          <input
            value={row.nama_barang}
            onChange={(e) => onPatch({ nama_barang: e.target.value })}
            className={`${inputBase} ${fieldClass("nama_barang") || "border-slate-300"}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Merk <span className="text-red-500">*</span>
          </span>
          <MerkPopup
            value={row.merk || ""}
            onChange={(v) => onPatch({ merk: v })}
            merkList={merkList}
            placeholder="Pilih merk..."
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Qty <span className="text-red-500">*</span>
          </span>
          <input
            type="number"
            min="1"
            value={row.qty}
            onChange={(e) => onPatch({ qty: e.target.value })}
            className={`${inputBase} ${fieldClass("qty") || "border-slate-300"}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Harga Beli <span className="text-red-500">*</span>
          </span>
          <input
            type="number"
            min="0"
            value={row.harga_beli}
            onChange={(e) => onPatch({ harga_beli: e.target.value })}
            className={`${inputBase} ${fieldClass("harga_beli") || "border-slate-300"}`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">
            Diskon (%) <span className="font-normal text-slate-400">— opsional</span>
          </span>
          <input
            type="number"
            min="0"
            max="100"
            step="0.5"
            value={row.diskon_persen ? row.diskon_persen : ""}
            onChange={(e) => onPatch({ diskon_persen: e.target.value })}
            placeholder="0"
            title="Diskon khusus barang ini. Kosongkan jika tidak ada."
            className={`${inputBase} border-slate-300`}
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs text-slate-500">Harga Jual</span>
          <input
            type="number"
            min="0"
            value={row.harga_jual || ""}
            onChange={(e) => onPatch({ harga_jual: e.target.value })}
            placeholder="0"
            className={`${inputBase} border-slate-300`}
          />
        </label>
      </div>

      {/* Subtotal per item — memperhitungkan diskon per barang bila ada */}
      {lineGross > 0 && (
        <div className="mt-1.5 flex items-center justify-between text-xs text-slate-500">
          <span className="flex items-center gap-1.5">
            Subtotal: {qtyNum} × {rupiah(hargaNum)}
            {diskonNum > 0 && (
              <span className="rounded bg-amber-50 px-1.5 py-0.5 font-medium text-amber-600">
                −{diskonNum}%
              </span>
            )}
          </span>
          <span className="font-semibold text-slate-700">
            {diskonNum > 0 && (
              <span className="mr-1.5 font-normal text-slate-400 line-through">
                {rupiah(lineGross)}
              </span>
            )}
            {rupiah(lineNet)}
          </span>
        </div>
      )}

      {/* Strategi 3: checkbox 'Diperiksa' wajib untuk jalur tulisan tangan */}
      {isHandwritten && (
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            checked={row.reviewed}
            onChange={(e) => onPatch({ reviewed: e.target.checked })}
          />
          Saya sudah memeriksa &amp; mengoreksi semua field baris ini
        </label>
      )}
    </div>
  );
}
