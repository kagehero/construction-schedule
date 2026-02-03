"use client";

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

type TabType = 'login' | 'signup';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState<TabType>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn, signUp, user } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push('/schedule');
    }
  }, [user, router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await signIn(email, password);
      router.push('/schedule');
    } catch (err: any) {
      let errorMessage = 'ログインに失敗しました';
      
      if (err.message?.includes('Invalid login credentials') || err.message?.includes('invalid_credentials')) {
        errorMessage = 'メールアドレスまたはパスワードが正しくありません。';
      } else if (err.message?.includes('Email not confirmed') || err.message?.includes('email_not_confirmed')) {
        errorMessage = 'メールアドレスが確認されていません。\n\n解決方法:\n1. メールボックスを確認して確認リンクをクリックする\n2. または、Supabaseダッシュボードで「Auto Confirm User」を有効にする\n\n設定手順:\n1. Supabaseダッシュボード → Authentication → Users\n2. 該当ユーザーを選択\n3. 「Auto Confirm User」にチェックを入れる';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    
    // Validation
    if (password.length < 6) {
      setError('パスワードは6文字以上である必要があります。');
      return;
    }
    
    if (password !== confirmPassword) {
      setError('パスワードが一致しません。');
      return;
    }

    setLoading(true);

    try {
      await signUp(email, password);
      setSuccess('アカウントが作成されました。ログインしてください。');
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      // ログインタブに切り替え
      setTimeout(() => {
        setActiveTab('login');
      }, 100);
    } catch (err: any) {
      let errorMessage = 'アカウントの作成に失敗しました';
      
      if (err.message === 'EMAIL_CONFIRMATION_REQUIRED') {
        errorMessage = 'メール確認が必要です。\n\nSupabaseダッシュボードで「Auto Confirm User」を有効にしてください。\n\n設定手順:\n1. Supabaseダッシュボード → Authentication → Settings\n2. 「Enable email confirmations」を無効にする、または\n3. ユーザー作成時に「Auto Confirm User」にチェックを入れる';
      } else if (err.message?.includes('User already registered') || err.message?.includes('already registered')) {
        errorMessage = 'このメールアドレスは既に登録されています。';
      } else if (err.message?.includes('Password')) {
        errorMessage = 'パスワードは6文字以上である必要があります。';
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (user) {
    return null; // Will redirect
  }

  return (
    <div className="h-screen flex items-center justify-center bg-theme-body text-theme-text">
      <div className="w-full max-w-md">
        <div className="bg-theme-card border border-theme-border rounded-xl p-8 shadow-lg">
          {/* Tabs */}
          <div className="flex gap-2 mb-6 border-b border-theme-border">
            <button
              type="button"
              onClick={() => {
                setActiveTab('login');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                activeTab === 'login'
                  ? 'text-theme-accent border-b-2 border-theme-accent'
                  : 'text-theme-text-muted hover:text-theme-text-muted-strong'
              }`}
            >
              ログイン
            </button>
            <button
              type="button"
              onClick={() => {
                setActiveTab('signup');
                setError('');
                setSuccess('');
              }}
              className={`flex-1 pb-2 text-sm font-medium transition-colors ${
                activeTab === 'signup'
                  ? 'text-theme-accent border-b-2 border-theme-accent'
                  : 'text-theme-text-muted hover:text-theme-text-muted-strong'
              }`}
            >
              新規登録
            </button>
          </div>

          <h1 className="text-2xl font-semibold mb-2 text-theme-text">
            {activeTab === 'login' ? 'ログイン' : '新規登録'}
          </h1>
          <p className="text-sm text-theme-text-muted mb-6">
            {activeTab === 'login'
              ? '工程管理システムにログインしてください'
              : '新しいアカウントを作成してください'}
          </p>

          {success && (
            <div className="mb-4 text-sm text-green-400 bg-green-900/20 border border-green-800 rounded-md p-3">
              <div className="font-semibold mb-1">成功</div>
              <div className="text-xs">{success}</div>
            </div>
          )}

          {error && (
            <div className="mb-4 text-sm text-red-400 bg-red-900/20 border border-red-800 rounded-md p-3">
              <div className="font-semibold mb-1">エラー</div>
              <div className="whitespace-pre-line text-xs">{error}</div>
              {(error.includes('メール確認') || error.includes('Email not confirmed') || error.includes('EMAIL_CONFIRMATION_REQUIRED')) && (
                <div className="mt-3 pt-3 border-t border-red-800 text-xs">
                  <div className="font-semibold mb-2 text-red-300">解決方法:</div>
                  <div className="space-y-2 text-red-300">
                    <div>
                      <strong>方法1: Supabase設定を変更（推奨）</strong>
                      <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                        <li>Supabaseダッシュボード → Authentication → Settings</li>
                        <li>「Enable email confirmations」を<strong>無効</strong>にする</li>
                        <li>または、ユーザー作成時に「Auto Confirm User」にチェックを入れる</li>
                      </ol>
                    </div>
                    <div>
                      <strong>方法2: 既存ユーザーを確認済みにする</strong>
                      <ol className="list-decimal list-inside ml-2 mt-1 space-y-1">
                        <li>Supabaseダッシュボード → Authentication → Users</li>
                        <li>該当ユーザーを選択</li>
                        <li>「Auto Confirm User」にチェックを入れる</li>
                      </ol>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab === 'login' ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-theme-text-muted-strong">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent"
                  placeholder="メールアドレスを入力"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-theme-text-muted-strong">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent"
                  placeholder="パスワードを入力"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? 'ログイン中...' : 'ログイン'}
              </button>
            </form>
          ) : (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="block text-sm mb-1 text-theme-text-muted-strong">
                  メールアドレス
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent"
                  placeholder="your@email.com"
                />
              </div>

              <div>
                <label className="block text-sm mb-1 text-theme-text-muted-strong">
                  パスワード
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent"
                  placeholder="6文字以上"
                />
                <p className="mt-1 text-xs text-theme-text-muted">
                  パスワードは6文字以上である必要があります
                </p>
              </div>

              <div>
                <label className="block text-sm mb-1 text-theme-text-muted-strong">
                  パスワード（確認）
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={6}
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border px-3 py-2 text-sm text-theme-text focus:outline-none focus:ring-2 focus:ring-theme-accent"
                  placeholder="パスワードを再入力"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading ? '登録中...' : 'アカウントを作成'}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
