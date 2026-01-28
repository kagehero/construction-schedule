import type { ReactNode } from "react";
import "./globals.css";

export const metadata = {
  title: "工程・人員配置システム",
  description: "案件立ち上げと工程・人員配置のためのWebアプリケーション"
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="ja">
      <body className="min-h-screen bg-slate-950 text-slate-100">
        <div className="flex min-h-screen">
          <aside className="w-56 bg-sidebar text-slate-100 flex flex-col">
            <div className="px-4 py-3 text-lg font-semibold border-b border-slate-800">
              工程管理
            </div>
            <nav className="flex-1 px-2 py-4 space-y-2 text-sm">
              <a
                href="/schedule"
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800"
              >
                <span>工程・人員配置</span>
              </a>
              <a
                href="/projects"
                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-slate-800"
              >
                <span>案件立ち上げ</span>
              </a>
            </nav>
          </aside>
          <main className="flex-1 bg-slate-900 border-l border-slate-800">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}


