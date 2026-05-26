"use client";

import { useEffect } from "react";
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
  ],
  sales: [["sales"], ["dashboard"], ["reports"]],
  sale_items: [["sales"], ["dashboard"], ["reports"]],
  purchases: [["purchases"], ["dashboard"], ["reports"]],
  purchase_items: [["purchases"], ["products"], ["pos-products"], ["dashboard"], ["restock"]],
  users: [["users"]],
  stock_logs: [["audit-logs"]],
  expenses: [["expenses"]],
};

const WATCHED_TABLES = Object.keys(TABLE_TO_QUERY_KEYS);

export function useRealtimeSync() {
  const qc = useQueryClient();

  useEffect(() => {
    if (!supabase) return;

    const session = getSession();
    if (session?.access_token) {
      supabase.realtime.setAuth(session.access_token);
    }

    const channel = supabase.channel("pos-realtime");

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

    channel.subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [qc]);
}
