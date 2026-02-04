"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "./globals.css";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SupabaseStatus } from "@/components/SupabaseStatus";
import { Toaster } from "react-hot-toast";

const THEME_KEY = "app-theme";
const THEME_LIGHT = "light" as const; // 昼
const THEME_DARK = "dark" as const;   // 夜
type ThemeValue = typeof THEME_LIGHT | typeof THEME_DARK;

type SidebarProps = {
  onNavigate?: () => void;
  /** 閉じるボタンを表示（モバイルオーバーレイ用） */
  showCloseButton?: boolean;
  onClose?: () => void;
};

function Sidebar({ onNavigate, showCloseButton, onClose }: SidebarProps) {
  const { signOut, profile, isAdmin, isViewer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setThemeState] = useState<ThemeValue>(THEME_DARK);

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    const initial: ThemeValue = stored === THEME_LIGHT || stored === THEME_DARK ? stored : THEME_DARK;
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const handleThemeChange = (value: ThemeValue) => {
    setThemeState(value);
    document.documentElement.setAttribute("data-theme", value);
    if (typeof window !== "undefined") localStorage.setItem(THEME_KEY, value);
  };

  const handleSignOut = async () => {
    try {
      await signOut();
      router.push('/login');
      onNavigate?.();
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // 管理者用のナビゲーションメニュー
  const adminMenuItems = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/schedule', label: '工程・人員配置' },
    { href: '/projects', label: '案件管理' },
    { href: '/members', label: 'メンバー管理' },
  ];

  // ビューア用のナビゲーションメニュー
  const viewerMenuItems = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/schedule', label: '工程・人員配置' },
  ];

  const menuItems = isAdmin ? adminMenuItems : viewerMenuItems;

  return (
    <aside className="w-56 h-full min-h-0 bg-theme-sidebar text-theme-text flex flex-col">
      <div className="flex items-center justify-between shrink-0 px-4 py-3 text-lg font-semibold border-b border-theme-border">
        <span>工程管理</span>
        {showCloseButton && (
          <button
            type="button"
            onClick={onClose ?? onNavigate}
            className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text transition-colors"
            aria-label="メニューを閉じる"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <nav className="flex-1 min-h-0 overflow-y-auto px-2 py-4 space-y-2 text-sm">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <button
              key={item.href}
              type="button"
              onClick={() => {
                router.push(item.href);
                onNavigate?.();
              }}
              className={`w-full text-left flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-theme-bg-elevated text-theme-accent'
                  : 'hover:bg-theme-bg-elevated text-theme-text-muted'
              }`}
            >
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>
      <div className="shrink-0 px-2 py-4 border-t border-theme-border">
        {profile && (
          <div className="px-3 py-2 mb-2 text-xs text-theme-text-muted">
            <div className="truncate">{profile.email}</div>
            <div className="mt-1.5 flex items-center justify-between gap-2">
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                profile.role === 'admin'
                  ? 'bg-theme-accent/20 text-theme-accent'
                  : 'bg-theme-bg-elevated text-theme-text-muted'
              }`}>
                {profile.role === 'admin' ? '管理者（編集可）' : '閲覧者'}
              </span>
              <div className="flex shrink-0 gap-0.5 rounded-md bg-theme-bg-elevated p-0.5">
                <button
                  type="button"
                  onClick={() => handleThemeChange(THEME_LIGHT)}
                  title="昼（ライト）"
                  aria-label="昼（ライト）に切り替え"
                  className={`rounded p-1 transition-colors ${
                    theme === THEME_LIGHT
                      ? 'bg-amber-500/90 text-slate-900 shadow-sm'
                      : 'text-theme-text-muted hover:bg-theme-bg-elevated-hover hover:text-theme-text'
                  }`}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.166a.75.75 0 00-1.06-1.06l-1.591 1.59a.75.75 0 101.06 1.061l1.591-1.59zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.834 18.894a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 10-1.061 1.06l1.59 1.591zM12 18a.75.75 0 01.75.75V21a.75.75 0 01-1.5 0v-2.25A.75.75 0 0112 18zM7.758 17.303a.75.75 0 00-1.061-1.06l-1.591 1.59a.75.75 0 001.06 1.061l1.591-1.59zM6 12a.75.75 0 01-.75.75H3a.75.75 0 010-1.5h2.25A.75.75 0 016 12zM6.697 7.757a.75.75 0 001.06-1.06l-1.59-1.591a.75.75 0 00-1.061 1.06l1.59 1.591z" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => handleThemeChange(THEME_DARK)}
                  title="夜（ダーク）"
                  aria-label="夜（ダーク）に切り替え"
                  className={`rounded p-1 transition-colors ${
                    theme === THEME_DARK
                      ? 'bg-indigo-600 text-white shadow-sm'
                      : 'text-theme-text-muted hover:bg-theme-bg-elevated-hover hover:text-theme-text'
                  }`}
                >
                  <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69.75.75 0 01.981.98 10.503 10.503 0 01-9.694 6.46c-5.799 0-10.5-4.701-10.5-10.5 0-4.368 2.667-8.112 6.46-9.694a.75.75 0 01.818.162z" clipRule="evenodd" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full px-3 py-2 text-sm rounded-md bg-theme-bg-elevated hover:bg-theme-bg-elevated-hover text-theme-text transition-colors"
        >
          ログアウト
        </button>
      </div>
    </aside>
  );
}

function LayoutContent({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isLoginPage = pathname === '/login';
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isSidebarClosing, setIsSidebarClosing] = useState(false);
  const [isSidebarAnimatingIn, setIsSidebarAnimatingIn] = useState(false);

  const openSidebar = () => {
    setIsSidebarOpen(true);
    setIsSidebarClosing(false);
    setIsSidebarAnimatingIn(false);
  };

  const closeSidebar = () => {
    setIsSidebarClosing(true);
  };

  const closeSidebarImmediate = () => {
    setIsSidebarOpen(false);
    setIsSidebarClosing(false);
    setIsSidebarAnimatingIn(false);
  };

  // 開く: マウント後にスライドイン開始
  useEffect(() => {
    if (!isSidebarOpen || isSidebarClosing) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setIsSidebarAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [isSidebarOpen, isSidebarClosing]);

  // 閉じる: アニメーション後に非表示
  useEffect(() => {
    if (!isSidebarClosing) return;
    const t = setTimeout(closeSidebarImmediate, 280);
    return () => clearTimeout(t);
  }, [isSidebarClosing]);

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen bg-theme-main">
      {/* デスクトップ用サイドバー */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* モバイル用スライドインサイドバー（画面高・アニメーション・閉じるボタン） */}
      {isSidebarOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              isSidebarClosing ? "opacity-0" : isSidebarAnimatingIn ? "opacity-100" : "opacity-0"
            }`}
            aria-label="メニューを閉じる"
            onClick={closeSidebar}
          />
          <div
            className={`relative flex flex-col h-screen w-56 shadow-xl transition-transform duration-200 ease-out ${
              isSidebarClosing ? "-translate-x-full" : isSidebarAnimatingIn ? "translate-x-0" : "-translate-x-full"
            }`}
          >
            <Sidebar
              onNavigate={closeSidebar}
              showCloseButton
              onClose={closeSidebar}
            />
          </div>
        </div>
      )}

      {/* メインコンテンツ（モバイルヘッダー付き） */}
      <div className="flex-1 flex flex-col">
        {/* モバイル用ヘッダー */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-theme-border md:hidden">
          <button
            type="button"
            className="p-2 rounded-md bg-theme-bg-elevated text-theme-text hover:bg-theme-bg-elevated-hover"
            aria-label="メニューを開く"
            onClick={openSidebar}
          >
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span className="text-sm font-semibold truncate">工程管理システム</span>
          <span className="w-9" aria-hidden="true" />
        </header>

        <main className="flex-1 bg-theme-main md:border-l md:border-theme-border">
          {children}
        </main>
      </div>
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-theme-body text-theme-text">
        <AuthProvider>
          <LayoutContent>{children}</LayoutContent>
          <SupabaseStatus />
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#1e293b',
                color: '#f1f5f9',
                border: '1px solid #475569',
              },
              success: {
                iconTheme: {
                  primary: '#22c55e',
                  secondary: '#f1f5f9',
                },
              },
              error: {
                iconTheme: {
                  primary: '#ef4444',
                  secondary: '#f1f5f9',
                },
              },
            }}
          />
        </AuthProvider>
      </body>
    </html>
  );
}


