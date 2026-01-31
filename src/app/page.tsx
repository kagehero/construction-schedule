"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function IndexPage() {
  const router = useRouter();
  const { user, isAdmin, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // 管理者はスケジュールページ、ビューアはダッシュボードにリダイレクト
        if (isAdmin) {
          router.push("/schedule");
        } else {
          router.push("/dashboard");
        }
      } else {
        router.push("/login");
      }
    }
  }, [user, isAdmin, loading, router]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-slate-400">読み込み中...</div>
    </div>
  );
}


