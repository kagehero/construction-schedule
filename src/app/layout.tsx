"use client";

import type { ReactNode, CSSProperties } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import Image from "next/image";
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

/** モバイル用ボトムナビ・メニュー共通の項目 */
type BottomNavItem = {
  href: string | "menu";
  label: string;
  icon: ReactNode;
};

function BottomNav({
  pathname,
  isAdmin,
  onOpenMenu,
}: {
  pathname: string;
  isAdmin: boolean;
  onOpenMenu: () => void;
}) {
  const router = useRouter();

  const navItems: BottomNavItem[] = [
    { href: "/dashboard", label: "ダッシュボード", icon: <HomeIcon /> },
    { href: "/schedule", label: "工程・人員配置", icon: <CalendarIcon /> },
    ...(isAdmin ? [{ href: "/projects" as const, label: "案件管理", icon: <BriefcaseIcon /> }] : []),
    ...(isAdmin ? [{ href: "/members" as const, label: "メンバー管理", icon: <UsersIcon /> }] : []),
    { href: "menu", label: "メニュー", icon: <MenuIcon /> },
  ];

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 flex md:hidden items-center justify-around bg-theme-sidebar border-t border-theme-border text-theme-text pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
      aria-label="メインナビゲーション"
    >
      {navItems.map((item) => {
        const isActive = item.href !== "menu" && pathname === item.href;
        return (
          <button
            key={item.href}
            type="button"
            onClick={() => {
              if (item.href === "menu") {
                onOpenMenu();
              } else {
                router.push(item.href);
              }
            }}
            className={`flex flex-col items-center justify-center gap-0.5 py-2 px-2 min-w-0 flex-1 ${
              isActive ? "text-theme-accent" : "text-theme-text-muted"
            }`}
            aria-current={isActive ? "page" : undefined}
            aria-label={item.label}
          >
            <span className="shrink-0 w-6 h-6 flex items-center justify-center">{item.icon}</span>
            <span className="text-[10px] truncate max-w-full">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HomeIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  );
}
function CalendarIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
    </svg>
  );
}
function BriefcaseIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  );
}
function UsersIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
    </svg>
  );
}
function UserAdminIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 14a3 3 0 11-6 0 3 3 0 016 0zM4 20a6 6 0 1112 0v1H4v-1zM19.5 8.25l.75 1.5 1.5.75-1.5.75-.75 1.5-.75-1.5-1.5-.75 1.5-.75.75-1.5z"
      />
    </svg>
  );
}
function MenuIcon() {
  return (
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden>
      <line x1="3" y1="6" x2="21" y2="6" strokeWidth={2} strokeLinecap="round" />
      <line x1="3" y1="12" x2="21" y2="12" strokeWidth={2} strokeLinecap="round" />
      <line x1="3" y1="18" x2="21" y2="18" strokeWidth={2} strokeLinecap="round" />
    </svg>
  );
}

function Sidebar({ onNavigate, showCloseButton, onClose }: SidebarProps) {
  const { signOut, profile, isAdmin, isPrimaryAdmin, isViewer } = useAuth();
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

  // 管理者用のナビゲーションメニュー（ユーザー管理は主管理者のみ）
  const adminMenuItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: <HomeIcon /> },
    { href: '/schedule', label: '工程・人員配置', icon: <CalendarIcon /> },
    { href: '/projects', label: '案件管理', icon: <BriefcaseIcon /> },
    { href: '/members', label: 'メンバー管理', icon: <UsersIcon /> },
    ...(isPrimaryAdmin ? [{ href: '/users', label: 'ユーザー管理', icon: <UserAdminIcon /> }] : []),
  ];

  // ビューア用のナビゲーションメニュー
  const viewerMenuItems = [
    { href: '/dashboard', label: 'ダッシュボード', icon: <HomeIcon /> },
    { href: '/schedule', label: '工程・人員配置', icon: <CalendarIcon /> },
  ];

  const menuItems = isAdmin ? adminMenuItems : viewerMenuItems;

  return (
    <aside className="w-56 h-full min-h-0 bg-theme-sidebar text-theme-text flex flex-col" aria-label="メニュー">
      <div className="flex items-center justify-between shrink-0 px-4 py-3 text-lg font-semibold border-b border-theme-border">
        {/* ロゴ：クリックで工程・人員配置へ移動 */}
        <button
          type="button"
          onClick={() => {
            router.push('/schedule');
            onNavigate?.();
          }}
          className="inline-flex items-center gap-2 text-theme-text hover:text-theme-accent transition-colors"
        >
          <span className="relative h-8 w-8 flex-shrink-0">
            <Image
              src="/image/logo.png"
              alt="工程管理ロゴ"
              fill
              sizes="32px"
              className="object-contain"
              priority
            />
          </span>
          <span className="truncate">工程管理</span>
        </button>
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
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 flex items-center justify-center">{item.icon}</span>
                <span className="truncate">{item.label}</span>
              </span>
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
  const router = useRouter();
  const { isAdmin, isPrimaryAdmin } = useAuth();
  const isLoginPage = pathname === '/login';
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  if (isLoginPage) {
    return <>{children}</>;
  }

  // モバイル用メニューシートに表示する項目（アイコンのみ表示）
  const sheetItems: BottomNavItem[] = [
    { href: "/dashboard", label: "ダッシュボード", icon: <HomeIcon /> },
    { href: "/schedule", label: "工程・人員配置", icon: <CalendarIcon /> },
    ...(isAdmin ? [{ href: "/projects" as const, label: "案件管理", icon: <BriefcaseIcon /> }] : []),
    ...(isAdmin ? [{ href: "/members" as const, label: "メンバー管理", icon: <UsersIcon /> }] : []),
    ...(isPrimaryAdmin ? [{ href: "/users" as const, label: "ユーザー管理", icon: <UserAdminIcon /> }] : []),
  ];

  return (
    <div className="flex min-h-screen bg-theme-main">
      {/* デスクトップ用サイドバー */}
      <div className="hidden md:flex">
        <Sidebar />
      </div>

      {/* メインコンテンツ（モバイルヘッダー付き） */}
      <div className="flex-1 flex flex-col">
        {/* モバイル用ヘッダー */}
        <header className="flex items-center justify-between px-4 py-3 border-b border-theme-border md:hidden">
          <button
            type="button"
            onClick={() => router.push('/schedule')}
            className="flex items-center gap-2 text-sm font-semibold truncate text-theme-text hover:text-theme-accent"
          >
            <span className="relative h-7 w-7 flex-shrink-0">
              <Image
                src="/image/logo.png"
                alt="工程管理ロゴ"
                fill
                sizes="28px"
                className="object-contain"
                priority
              />
            </span>
            <span className="truncate">工程管理システム</span>
          </button>
          <span className="w-9" aria-hidden="true" />
        </header>

        <main className="flex-1 bg-theme-main md:border-l md:border-theme-border pb-16 md:pb-0">
          {children}
        </main>
      </div>

      {/* モバイル用メニュー（下段ナビの「メニュー」タップ時・右下からアイコンが上方向に順番に現れる） */}
      <div className="fixed bottom-[-180px] right-3 z-40 md:hidden">
        {isMenuOpen &&
          sheetItems.map((item, index) => {
            const isActive = pathname === item.href;
            return (
              <button
                key={item.href}
                type="button"
                onClick={() => {
                  router.push(item.href);
                  setIsMenuOpen(false);
                }}
                className={`menu-pop w-10 h-10 flex items-center justify-center rounded-full shadow-lg border border-theme-border ${
                  isActive ? "bg-theme-bg-elevated text-theme-accent" : "bg-theme-sidebar text-theme-text-muted"
                }`}
                style={{
                  animationDelay: `${index * 140}ms`,
                  // 各アイコンごとに最終位置までのオフセットを変える（クリックしたメニューアイコン位置から上に並ぶ）
                  ["--menu-offset" as keyof CSSProperties]: `-${(index + 1) * 100}px`,
                }}
                aria-label={item.label}
              >
                {item.icon}
              </button>
            );
          })}
      </div>

      {/* モバイル用固定ボトムナビ（添付画像のように画面下に固定） */}
      {!isLoginPage && (
        <BottomNav
          pathname={pathname}
          isAdmin={isAdmin}
          onOpenMenu={() => setIsMenuOpen((prev) => !prev)}
        />
      )}
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


