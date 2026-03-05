"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { format } from "date-fns";
import { ja } from "date-fns/locale";
import SchedulePage from "@/app/schedule/page";

export default function DashboardPage() {
  const { profile } = useAuth();
  const today = format(new Date(), "yyyy年M月d日（E）", { locale: ja });

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col">
        <header className="shrink-0 px-4 md:px-6 py-3 border-b border-theme-border">
          <h1 className="text-lg font-semibold text-theme-text">本日の工程表</h1>
          <p className="text-xs text-theme-text-muted mt-1">
            {today}の工程です。セルをタップしてメンバーを配置・編集できます。
            {profile?.role === "admin" ? " 管理者は編集可能です。" : " 閲覧のみです。"}
          </p>
        </header>

        <div className="flex-1 flex flex-col min-h-0">
          <SchedulePage />
        </div>
      </div>
    </AuthGuard>
  );
}
