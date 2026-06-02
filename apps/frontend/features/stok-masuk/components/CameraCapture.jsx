"use client";
// CameraCapture — kamera in-app via MediaDevices getUserMedia (Bab 3.2.6.3).
// Menampilkan live preview kamera belakang, ambil 1 frame → File JPEG, lalu
// diteruskan ke pipeline OCR yang sama (Tesseract → Groq Vision) lewat onCapture.
// Fallback: jika getUserMedia tidak didukung / izin ditolak, panggil onFallback
// (kamera bawaan via <input capture>) agar fitur tetap berjalan.

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui";

export function CameraCapture({ onCapture, onClose, onFallback }) {
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const [status, setStatus] = useState("starting"); // starting | ready | error
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMsg("Browser ini tidak mendukung akses kamera langsung.");
        return;
      }
      try {
        // facingMode 'environment' = kamera belakang (sesuai skripsi). Minta
        // resolusi tinggi agar kualitas OCR tetap baik.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 2560 },
            height: { ideal: 1440 },
          },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play().catch(() => {});
        }
        setStatus("ready");
      } catch (err) {
        setStatus("error");
        if (err?.name === "NotAllowedError")
          setErrorMsg("Izin kamera ditolak. Aktifkan izin kamera di browser, atau gunakan kamera bawaan.");
        else if (err?.name === "NotFoundError")
          setErrorMsg("Kamera tidak ditemukan pada perangkat ini.");
        else setErrorMsg(err?.message || "Gagal mengakses kamera.");
      }
    }

    start();
    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, []);

  function handleCapture() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (!blob) return;
        const file = new File([blob], `nota-kamera-${Date.now()}.jpg`, {
          type: "image/jpeg",
        });
        onCapture?.(file);
      },
      "image/jpeg",
      0.92
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black/90">
      <div className="flex items-center justify-between p-3 text-white">
        <span className="text-sm font-medium">Foto Nota Supplier</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg px-3 py-1 text-sm hover:bg-white/10"
        >
          Tutup
        </button>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden">
        {status === "error" ? (
          <div className="max-w-sm space-y-4 p-6 text-center text-white">
            <p className="text-sm">{errorMsg}</p>
            <div className="flex flex-col gap-2">
              {onFallback && (
                <Button onClick={onFallback}>Gunakan Kamera Bawaan</Button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="text-sm text-slate-300 underline"
              >
                Batal
              </button>
            </div>
          </div>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            className="max-h-full max-w-full object-contain"
          />
        )}
        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center text-sm text-white">
            Memulai kamera…
          </div>
        )}
      </div>

      {status === "ready" && (
        <div className="flex items-center justify-center gap-4 p-5">
          <button
            type="button"
            onClick={handleCapture}
            className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 transition active:scale-95"
            aria-label="Ambil foto"
          >
            <span className="h-12 w-12 rounded-full bg-white" />
          </button>
        </div>
      )}
    </div>
  );
}

export default CameraCapture;
