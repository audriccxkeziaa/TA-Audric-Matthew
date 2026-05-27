"use client";
// =================================================================
// components/ProductPicker.jsx — Modal pilih produk dari katalog
// =================================================================
// Dipakai di /stok-masuk ketika kandidat Levenshtein tidak cocok dan
// user ingin memilih produk lain secara manual.
// Mendukung pencarian teks DAN scan barcode via kamera (ZXing).
// =================================================================

import { useState, useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { productsApi } from "@/lib/api";
import { useDebounce } from "@/hooks/useDebounce";
import { rupiah, angka } from "@/lib/format";
import { Modal, Spinner, EmptyState } from "@/components/ui";

function IconCamera({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round"
        d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  );
}

function IconStop({ className = "h-4 w-4" }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <rect x="6" y="6" width="12" height="12" rx="1" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function ProductPicker({ open, onClose, onSelect }) {
  const [q, setQ] = useState("");
  const debouncedQ = useDebounce(q, 300);

  // Barcode scanner state
  const [scanning, setScanning]    = useState(false);
  const [initScan, setInitScan]    = useState(false); // sinyal: mulai scan setelah video mount
  const [scanStatus, setScanStatus] = useState(""); // "" | "found" | "error"
  const [scanError, setScanError]   = useState("");
  const [barcodeHit, setBarcodeHit] = useState(null);

  const videoRef    = useRef(null);
  const controlsRef = useRef(null);
  const activeRef   = useRef(false); // cegah callback stale setelah stop

  // ---------- Query produk ----------
  const { data, isFetching } = useQuery({
    queryKey: ["picker-products", debouncedQ],
    queryFn: () =>
      productsApi.list({ q: debouncedQ, status: "aktif", limit: 30 }),
    enabled: open,
  });
  const results = data?.data || [];

  // ---------- Auto-select jika scan → tepat 1 hasil ----------
  useEffect(() => {
    if (!barcodeHit || isFetching || results.length !== 1) return;
    onSelect(results[0]);
    handleClose();
  }, [barcodeHit, isFetching, results]);

  // ---------- Hentikan kamera saat modal ditutup ----------
  useEffect(() => {
    if (!open) stopCamera();
  }, [open]);

  // ---------- Inisialisasi ZXing SETELAH video element mount ----------
  // setInitScan(true) → React render <video> → useEffect ini berjalan →
  // videoRef.current sudah pasti ada di DOM.
  useEffect(() => {
    if (!initScan || !videoRef.current) return;
    setInitScan(false);
    activeRef.current = true;

    let localControls = null;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const reader = new BrowserMultiFormatReader();
        localControls = await reader.decodeFromVideoDevice(
          undefined,          // kamera default (belakang di HP, satu-satunya di laptop)
          videoRef.current,
          (result) => {
            if (!result || !activeRef.current) return;
            activeRef.current = false;
            const text = result.getText();
            try { localControls?.stop(); } catch {}
            controlsRef.current = null;
            setScanning(false);
            setScanStatus("found");
            setQ(text);
            setBarcodeHit(text);
          }
        );
        if (activeRef.current) {
          controlsRef.current = localControls;
        } else {
          // user sudah tekan Stop sebelum kamera siap
          try { localControls?.stop(); } catch {}
        }
      } catch (err) {
        activeRef.current = false;
        setScanning(false);
        setScanStatus("error");
        const msg =
          err?.name === "NotAllowedError"
            ? "Izin kamera ditolak. Aktifkan izin kamera di pengaturan browser."
            : err?.name === "NotFoundError"
            ? "Tidak ada kamera yang terdeteksi di perangkat ini."
            : "Kamera tidak dapat diakses: " + (err?.message || err?.name || "");
        setScanError(msg);
      }
    })();
  }, [initScan]);

  // ---------- Helpers ----------
  function startScanning() {
    setScanError("");
    setScanStatus("");
    setBarcodeHit(null);
    setScanning(true);
    setInitScan(true); // picu useEffect di atas setelah video mount
  }

  function stopCamera() {
    activeRef.current = false;
    if (controlsRef.current) {
      try { controlsRef.current.stop(); } catch {}
      controlsRef.current = null;
    }
    setScanning(false);
    setInitScan(false);
  }

  function handleClose() {
    stopCamera();
    setQ("");
    setScanStatus("");
    setScanError("");
    setBarcodeHit(null);
    onClose();
  }

  return (
    <Modal open={open} onClose={handleClose} title="Pilih Produk dari Katalog">

      {/* ── Search + tombol scan ── */}
      <div className="flex gap-2">
        <input
          autoFocus={!scanning}
          placeholder="Cari nama / kode barang..."
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            // Reset feedback scan kalau user ketik manual setelahnya
            if (scanStatus === "found") { setScanStatus(""); setBarcodeHit(null); }
          }}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-brand-500"
        />
        <button
          type="button"
          onClick={scanning ? stopCamera : startScanning}
          title={scanning ? "Hentikan scan kamera" : "Cari produk via scan barcode"}
          className={`flex shrink-0 items-center gap-1.5 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
            scanning
              ? "border-red-300 bg-red-50 text-red-600 hover:bg-red-100"
              : "border-brand-300 bg-brand-50 text-brand-700 hover:bg-brand-100"
          }`}
        >
          {scanning ? <IconStop /> : <IconCamera />}
          <span className="hidden sm:inline">{scanning ? "Stop" : "Scan"}</span>
        </button>
      </div>

      {/* ── Viewfinder kamera (muncul saat scanning=true) ── */}
      {scanning && (
        <div className="mt-3 overflow-hidden rounded-xl border-2 border-brand-400">
          <div className="relative bg-black">
            <video
              ref={videoRef}
              className="block w-full"
              style={{ maxHeight: "200px", objectFit: "cover" }}
              muted
              playsInline
            />
            {/* Panduan scan */}
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-14 w-3/4 rounded-md border-2 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 bg-brand-600 py-1.5 text-xs text-white">
            <span className="h-2 w-2 animate-ping rounded-full bg-emerald-300" />
            Arahkan barcode ke dalam kotak
          </div>
        </div>
      )}

      {/* ── Feedback hasil scan ── */}
      {scanStatus === "found" && (
        <div className="mt-2 flex flex-wrap items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          <span className="font-bold">✓</span>
          <span>
            Barcode: <span className="font-mono font-semibold">{q}</span>
          </span>
          {!isFetching && results.length === 0 && (
            <span className="ml-auto text-xs text-amber-600 font-medium">
              Produk tidak ditemukan di katalog
            </span>
          )}
        </div>
      )}
      {scanStatus === "error" && (
        <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
          {scanError}
        </p>
      )}

      {/* ── Daftar hasil ── */}
      <div className="mt-3 max-h-72 space-y-1.5 overflow-y-auto thin-scroll">
        {isFetching && (
          <div className="py-6">
            <Spinner label="Mencari..." />
          </div>
        )}
        {!isFetching && results.length === 0 && (
          <EmptyState title="Tidak ada produk" />
        )}
        {!isFetching &&
          results.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onSelect(p);
                handleClose();
              }}
              className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-brand-400 hover:bg-brand-50"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-800">
                  {p.nama_barang}
                </p>
                <p className="text-xs text-slate-400">
                  {p.kode_barang} · {p.merk || "-"}
                </p>
              </div>
              <div className="shrink-0 text-right text-xs text-slate-500">
                <p>Stok {angka(p.stok)}</p>
                <p>{rupiah(p.harga_beli)}</p>
              </div>
            </button>
          ))}
      </div>
    </Modal>
  );
}
