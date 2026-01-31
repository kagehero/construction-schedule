"use client";

import { useEffect, useState } from 'react';

export function SupabaseStatus() {
  const [isConfigured, setIsConfigured] = useState(true);
  const [missingVars, setMissingVars] = useState<string[]>([]);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    const missing: string[] = [];
    if (!url) missing.push('NEXT_PUBLIC_SUPABASE_URL');
    if (!key) missing.push('NEXT_PUBLIC_SUPABASE_ANON_KEY');
    
    if (missing.length > 0) {
      setIsConfigured(false);
      setMissingVars(missing);
    }
  }, []);

  if (isConfigured) return null;

  return (
    <div className="fixed bottom-4 right-4 bg-yellow-900/80 border border-yellow-700 rounded-lg p-3 text-xs max-w-md z-50">
      <div className="font-semibold text-yellow-300 mb-1">⚠️ Supabase設定エラー</div>
      <div className="text-yellow-200 mb-2">
        以下の環境変数が設定されていません:
      </div>
      <ul className="list-disc list-inside text-yellow-300 mb-2">
        {missingVars.map((v) => (
          <li key={v}>{v}</li>
        ))}
      </ul>
      <div className="text-yellow-200 text-[10px]">
        .env.localファイルを作成し、Supabaseの認証情報を設定してください。
      </div>
    </div>
  );
}
