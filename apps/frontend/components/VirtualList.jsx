"use client";
// VirtualList — list ter-virtualisasi sederhana untuk ribuan baris berukuran
// TETAP (rowHeight px). Hanya baris yang terlihat (+ overscan) yang dirender,
// sehingga scroll tetap mulus walau data ribuan (mis. katalog Browse kasir).
//
// Pemakaian:
//   <VirtualList items={data} rowHeight={64} height={380}
//     renderRow={(item, index) => <Row .../>} />
// renderRow WAJIB menghasilkan elemen setinggi rowHeight px.

import { useState } from "react";

export function VirtualList({ items, rowHeight = 64, height = 380, overscan = 6, renderRow }) {
  const [scrollTop, setScrollTop] = useState(0);
  const total = items.length;
  const start = Math.max(0, Math.floor(scrollTop / rowHeight) - overscan);
  const visible = Math.ceil(height / rowHeight) + overscan * 2;
  const end = Math.min(total, start + visible);

  return (
    <div
      className="overflow-y-auto thin-scroll"
      style={{ height }}
      onScroll={(e) => setScrollTop(e.currentTarget.scrollTop)}
    >
      {/* Spacer setinggi total agar scrollbar proporsional */}
      <div style={{ height: total * rowHeight, position: "relative" }}>
        {/* Jendela baris yang dirender, digeser ke posisi yang benar */}
        <div style={{ position: "absolute", top: start * rowHeight, left: 0, right: 0 }}>
          {items.slice(start, end).map((item, i) => renderRow(item, start + i))}
        </div>
      </div>
    </div>
  );
}
