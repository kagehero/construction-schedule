"use client";

import type { ReactNode } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import "./globals.css";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SupabaseStatus } from "@/components/SupabaseStatus";
import { Toaster } from "react-hot-toast";

const THEME_KEY = "app-theme";
const THEMES = [
  { value: "dark", label: "ダーク（スレート）" },
  { value: "dark-blue", label: "ダークブルー" },
  { value: "dark-green", label: "ダークグリーン" },
  { value: "light", label: "ライト" },
] as const;

function Sidebar() {
  const { signOut, profile, isAdmin, isViewer } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [theme, setThemeState] = useState<string>("dark");

  useEffect(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem(THEME_KEY) : null;
    const initial = (stored && THEMES.some((t) => t.value === stored)) ? stored : "dark";
    setThemeState(initial);
    document.documentElement.setAttribute("data-theme", initial);
  }, []);

  const handleThemeChange = (value: string) => {
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
    <aside className="w-56 bg-theme-sidebar text-slate-100 flex flex-col">
      <div className="px-4 py-3 text-lg font-semibold border-b border-slate-800">
        工程管理
      </div>
      <div className="px-3 py-2 border-b border-slate-800">
        <label className="block text-[10px] text-slate-400 mb-1">背景テーマ</label>
        <select
          value={theme}
          onChange={(e) => handleThemeChange(e.target.value)}
          className="w-full rounded bg-slate-800 border border-slate-600 px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-accent"
        >
          {THEMES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
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
                  ? 'bg-slate-800 text-accent'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <span>{item.label}</span>
            </a>
          );
        })}
      </nav>
      <div className="px-2 py-4 border-t border-slate-800">
        {profile && (
          <div className="px-3 py-2 mb-2 text-xs text-slate-400">
            <div className="truncate">{profile.email}</div>
            <div className="mt-1">
              <span className={`px-2 py-0.5 rounded text-[10px] ${
                profile.role === 'admin' 
                  ? 'bg-blue-900/30 text-blue-300' 
                  : 'bg-slate-700 text-slate-300'
              }`}>
                {profile.role === 'admin' ? '管理者' : '閲覧者'}
              </span>
            </div>
          </div>
        )}
        <button
          onClick={handleSignOut}
          className="w-full px-3 py-2 text-sm rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
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
      <main className="flex-1 bg-theme-main border-l border-slate-800">
        {children}
      </main>
    </div>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-950 text-slate-100">
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


