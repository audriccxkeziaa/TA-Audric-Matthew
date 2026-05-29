"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";
import { getSession } from "@/lib/api-client";

const TABLE_TO_QUERY_KEYS = {
  products: [
    ["products"],
    ["pos-products"],
    ["dashboard"],
    ["low-stock"],
    ["restock"],
    ["notifications"],
    ["notif-low-stock"], // lonceng "Stok Menipis" di Topbar → update instan
  ],
  sales: [["sales"], ["dashboard"], ["reports"]],
  sale_items: [["sales"], ["dashboard"], ["reports"]],
  purchases: [["purchases"], ["dashboard"], ["reports"]],
  purchase_items: [["purchases"], ["products"], ["pos-products"], ["dashboard"], ["restock"], ["notif-low-stock"]],
  users: [["users"]],
  stock_logs: [["audit-logs"]],
  expenses: [["expenses"]],
  stock_adjustments: [["adjustments"], ["adjustments-pending"], ["notif-pending-approval"], ["history"]],
  stock_adjustment_items: [["adjustments"]],
};

const WATCHED_TABLES = Object.keys(TABLE_TO_QUERY_KEYS);
const RETRY_DELAY_MS = 5000;

export function useRealtimeSync() {
  const qc = useQueryClient();
  // Unique channel name per hook instance agar tidak konflik antar tab/mount
  const channelName = useRef(`pos-realtime-${Math.random().toString(36).slice(2)}`);
  const retryRef = useRef(null);

  useEffect(() => {
    if (!supabase) return;

    let channel = null;
    let destroyed = false;

    function connect() {
      const session = getSession();
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }

      channel = supabase.channel(channelName.current);

      for (const table of WATCHED_TABLES) {
        channel.on(
          "postgres_changes",
          { event: "*", schema: "public", table },
          () => {
            const keys = TABLE_TO_QUERY_KEYS[table] || [];
            for (const key of keys) {
              qc.invalidateQueries({ queryKey: key });
            }
          }
        );
      }

      channel.subscribe((status, err) => {
        if (destroyed) return;
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          console.warn("[Realtime] Koneksi gagal, mencoba ulang dalam 5 detik...", status, err);
          supabase.removeChannel(channel);
          channel = null;
          retryRef.current = setTimeout(connect, RETRY_DELAY_MS);
        }
      });
    }

    connect();

    return () => {
      destroyed = true;
      if (retryRef.current) clearTimeout(retryRef.current);
      if (channel) supabase.removeChannel(channel);
    };
  }, [qc]);
}
