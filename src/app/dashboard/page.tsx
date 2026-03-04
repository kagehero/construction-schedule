"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { Card } from "@/components/ui/card";
import { getProjects } from "@/lib/supabase/projects";
import { useState, useEffect } from "react";
import type { Project } from "@/domain/projects/types";
import { ScheduleEmbedded } from "@/app/schedule/page";

export default function DashboardPage() {
  const { profile } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [projectSearch, setProjectSearch] = useState("");
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [scheduleModalClosing, setScheduleModalClosing] = useState(false);
  const [scheduleModalAnimatingIn, setScheduleModalAnimatingIn] = useState(false);

  const filteredProjects = projectSearch.trim()
    ? projects.filter(
        (p) =>
          p.siteName?.toLowerCase().includes(projectSearch.trim().toLowerCase()) ||
          p.customerName?.toLowerCase().includes(projectSearch.trim().toLowerCase()) ||
          p.siteAddress?.toLowerCase().includes(projectSearch.trim().toLowerCase()) ||
          p.title?.toLowerCase().includes(projectSearch.trim().toLowerCase())
      )
    : projects;

  useEffect(() => {
    loadProjects();
  }, []);

  // ログイン直後（このタブで初回のダッシュボード表示時）に工程表モーダルを自動表示
  useEffect(() => {
    if (typeof window === "undefined") return;
    const KEY = "dashboard-schedule-modal-shown";
    const alreadyShown = window.sessionStorage.getItem(KEY);
    if (!alreadyShown) {
      setShowScheduleModal(true);
      setScheduleModalClosing(false);
      window.sessionStorage.setItem(KEY, "1");
    }
  }, []);

  // モーダル開くときのアニメーション開始
  useEffect(() => {
    if (!showScheduleModal || scheduleModalClosing) return;
    setScheduleModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setScheduleModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showScheduleModal, scheduleModalClosing]);

  // モーダル閉じるときのアニメーション完了後にアンマウント
  useEffect(() => {
    if (!scheduleModalClosing) return;
    const t = setTimeout(() => {
      setShowScheduleModal(false);
      setScheduleModalClosing(false);
      setScheduleModalAnimatingIn(false);
    }, 200);
    return () => clearTimeout(t);
  }, [scheduleModalClosing]);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (error: any) {
      console.error("Failed to load projects:", error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AuthGuard>
      <div className="h-screen flex flex-col">
        <header className="px-6 py-3 border-b border-theme-border flex items-center justify-between gap-4">
          <div>
            <h1 className="text-lg font-semibold text-theme-text">ダッシュボード</h1>
            <p className="text-xs text-theme-text-muted mt-1">
              閲覧者用ダッシュボード
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setShowScheduleModal(true);
              setScheduleModalClosing(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-md bg-theme-bg-elevated hover:bg-theme-bg-elevated-hover border border-theme-border px-3 py-1.5 text-xs md:text-sm text-theme-text shadow-sm"
          >
            <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-theme-accent text-[10px] font-semibold text-white">
              今
            </span>
            <span>本日の工程を見る</span>
          </button>
        </header>

        <div className="flex-1 overflow-auto p-6" >
          <div className="max-w-7xl mx-auto space-y-6">
            <Card title="案件一覧">
              <div className="space-y-2 text-xs max-h-[calc(100vh-200px)] overflow-auto pr-1">
                {!isLoading && projects.length > 0 && (
                  <div className="sticky top-0 z-10 bg-theme-card pb-2 -mt-1 pt-1">
                    <input
                      type="search"
                      placeholder="現場名・取引先・住所で検索..."
                      value={projectSearch}
                      onChange={(e) => setProjectSearch(e.target.value)}
                      className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2 text-sm placeholder:text-theme-text-muted"
                      aria-label="案件を検索"
                    />
                    {projectSearch.trim() && (
                      <p className="mt-1 text-[11px] text-theme-text-muted">
                        {filteredProjects.length}件 / {projects.length}件
                      </p>
                    )}
                  </div>
                )}
                {isLoading ? (
                  <p className="text-theme-text-muted text-xs">読み込み中...</p>
                ) : (
                  <>
                    {filteredProjects.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-lg border border-theme-border bg-theme-bg-elevated text-theme-text px-3 py-2"
                      >
                        <div className="flex items-center justify-between gap-2 flex-wrap">
                          <div className="font-semibold min-w-0">{p.siteName}</div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            <span className="text-[10px] text-theme-text-muted whitespace-nowrap">
                              {p.startDate}～{p.endDate}
                            </span>
                          </div>
                        </div>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          <span className="text-[11px] text-theme-text-muted-strong">
                            {p.customerName}
                          </span>
                          {p.contractAmount && (
                            <span className="text-[11px] text-theme-text-muted">
                              ¥{p.contractAmount.toLocaleString()}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-[11px] text-theme-text-muted truncate">
                          {p.siteAddress}
                        </div>
                      </div>
                    ))}
                    {filteredProjects.length === 0 && (
                      <p className="text-theme-text-muted text-xs">
                        {projectSearch.trim() ? "検索に一致する案件がありません。" : "まだ案件が登録されていません。"}
                      </p>
                    )}
                  </>
                )}
              </div>
            </Card>

            <Card title="権限情報">
              <div className="space-y-2 text-xs">
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">ロール</span>
                  <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                    {profile?.role === 'admin' ? '管理者' : '閲覧者'}
                  </span>
                </div>
                <div className="flex items-center justify-between py-2 border-b border-slate-800">
                  <span className="text-slate-400">メールアドレス</span>
                  <span className="text-slate-300">{profile?.email}</span>
                </div>
                <div className="pt-2 text-slate-500 text-[11px]">
                  <p>閲覧者は案件の閲覧のみ可能です。</p>
                  <p className="mt-1">編集・削除機能は管理者のみが利用できます。</p>
                </div>
              </div>
            </Card>
          </div>
        </div>

        {/* 工程・人員配置の工程表のみを表示するモーダル（期間まとめて配置モーダルと同じアニメーション） */}
        {showScheduleModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <button
              type="button"
              className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
                scheduleModalClosing || !scheduleModalAnimatingIn ? "opacity-0" : "opacity-100"
              }`}
              aria-label="閉じる"
              onClick={() => setScheduleModalClosing(true)}
            />
            <div
              className={`relative w-full max-w-[720px] bg-theme-main border border-theme-border rounded-lg shadow-lg overflow-hidden md:mx-4 transition-all duration-200 ease-out ${
                scheduleModalClosing || !scheduleModalAnimatingIn
                  ? "opacity-0 scale-95 translate-y-2"
                  : "opacity-100 scale-100 translate-y-0"
              }`}
            >
              <div className="absolute top-2 right-2 z-10 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setScheduleModalClosing(true)}
                  className="inline-flex items-center justify-center rounded-full bg-black/50 hover:bg-black/70 text-theme-text w-7 h-7"
                  aria-label="閉じる"
                >
                  <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="w-full bg-theme-main">
                <div className="px-4 pt-3 pb-2 border-b border-theme-border">
                  <p className="text-xs md:text-sm font-semibold text-theme-text">本日の工程表</p>
                  <p className="text-[11px] text-theme-text-muted mt-0.5">
                    工程・人員配置の工程表のうち、本日分のみを表示しています。
                  </p>
                </div>
                <ScheduleEmbedded />
              </div>
            </div>
          </div>
        )}
      </div>
    </AuthGuard>
  );
}
