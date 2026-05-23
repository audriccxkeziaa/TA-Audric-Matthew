"use client";
// Halaman root: tampilkan splash dulu, lalu arahkan sesuai status & role.

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import SplashScreen from "@/components/SplashScreen";

export default function RootPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [splashDone, setSplashDone] = useState(false);

  useEffect(() => {
    if (loading || !splashDone) return;
    if (!user) router.replace("/login");
    else if (user.role === "admin") router.replace("/dashboard");
    else router.replace("/kasir");
  }, [user, loading, splashDone, router]);

  return <SplashScreen onDone={() => setSplashDone(true)} />;
}
