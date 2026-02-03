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

function Sidebar() {
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
    } catch (error) {
      console.error('Failed to sign out:', error);
    }
  };

  // 管理者用のナビゲーションメニュー
  const adminMenuItems = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/schedule', label: '工程・人員配置' },
    { href: '/projects', label: '案件立ち上げ' },
    { href: '/members', label: 'メンバー管理' },
  ];

  // ビューア用のナビゲーションメニュー
  const viewerMenuItems = [
    { href: '/dashboard', label: 'ダッシュボード' },
    { href: '/schedule', label: '工程・人員配置' },
  ];

  const menuItems = isAdmin ? adminMenuItems : viewerMenuItems;

  return (
    <aside className="w-56 bg-theme-sidebar text-theme-text flex flex-col">
      <div className="px-4 py-3 text-lg font-semibold border-b border-theme-border">
        工程管理
      </div>
      <nav className="flex-1 px-2 py-4 space-y-2 text-sm">
        {menuItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <a
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-md transition-colors ${
                isActive
                  ? 'bg-theme-bg-elevated text-theme-accent'
                  : 'hover:bg-theme-bg-elevated text-theme-text-muted'
              }`}
            >
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div className="px-2 py-4 border-t border-theme-border">
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

  if (isLoginPage) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="flex-1 bg-theme-main border-l border-theme-border">
        {children}
      </main>
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


