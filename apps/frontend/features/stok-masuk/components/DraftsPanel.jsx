"use client";
// Panel daftar Draft (Cross-device Resume): foto + OCR di HP, koreksi di laptop.

import { Card, Button, Badge } from "@/components/ui";

function timeAgo(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const diff = Math.max(0, Date.now() - d.getTime());
  const min = Math.floor(diff / 60000);
  if (min < 1) return "baru saja";
  if (min < 60) return `${min} menit lalu`;
  const jam = Math.floor(min / 60);
  if (jam < 24) return `${jam} jam lalu`;
  return d.toLocaleDateString("id-ID");
}

export function DraftsPanel({ drafts, loading, onOpen, onDelete, onRefresh }) {
  if (!loading && (!drafts || drafts.length === 0)) {
    return null; // jangan tampilkan kalau kosong
  }

  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-slate-800">
            📥 Draft Tersimpan
            {drafts.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                {drafts.length}
              </span>
            )}
          </p>
          <p className="mt-0.5 text-xs text-slate-500">
            Nota yang sudah di draft sementara, buka di sini untuk diedit kembali &amp;
            dikonfirmasi untuk disimpan.
          </p>
        </div>
        <Button size="sm" variant="ghost" onClick={onRefresh}>
          ↻ Refresh
        </Button>
      </div>

      {loading ? (
        <p className="py-2 text-center text-xs text-slate-400">Memuat draft...</p>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {drafts.map((d) => (
            <div
              key={d.id}
              className="flex gap-3 rounded-lg border border-slate-200 bg-slate-50 p-2 transition hover:border-brand-400"
            >
              <div className="h-20 w-20 shrink-0 overflow-hidden rounded-md border border-slate-200 bg-white">
                {d.file_nota_signed_url ? (
                  <img src={d.file_nota_signed_url} alt="Nota" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center text-xs text-slate-400">
                    📄
                  </div>
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-800">
                    {d.no_nota_supplier || "(tanpa no. nota)"}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                    <Badge tone={d.nota_type === "tulisan_tangan" ? "amber" : "blue"}>
                      {d.nota_type === "tulisan_tangan"
                        ? "Tulisan Tangan"
                        : d.nota_type === "cetak"
                        ? "Cetak"
                        : "—"}
                    </Badge>
                    <span>{d.item_count} item</span>
                    <span>· {timeAgo(d.updated_at)}</span>
                  </p>
                </div>
                <div className="mt-2 flex justify-end gap-1">
                  <button
                    onClick={() => onDelete(d.id)}
                    className="rounded-md px-2 py-1 text-[11px] text-red-600 hover:bg-red-50"
                  >
                    Delete
                  </button>
                  <button
                    onClick={() => onOpen(d.id)}
                    className="rounded-md bg-brand-600 px-2.5 py-1 text-[11px] font-medium text-white hover:bg-brand-700"
                  >
                    Continue →
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
