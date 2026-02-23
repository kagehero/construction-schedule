"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

interface AuthGuardProps {
  children: React.ReactNode;
  requireAdmin?: boolean;
  /** 主管理者（admin@gmail.com）のみ許可。requireAdmin より厳しい */
  requirePrimaryAdmin?: boolean;
}

export function AuthGuard({ children, requireAdmin = false, requirePrimaryAdmin = false }: AuthGuardProps) {
  const { user, loading, isAdmin, isPrimaryAdmin } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.push('/login');
        return;
      }
      if (requirePrimaryAdmin && !isPrimaryAdmin) {
        router.push('/schedule');
        return;
      }
      if (requireAdmin && !isAdmin) {
        router.push('/schedule');
        return;
      }
    }
  }, [user, loading, isAdmin, isPrimaryAdmin, requireAdmin, requirePrimaryAdmin, router]);

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center">
        <div className="text-slate-400">読み込み中...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  if (requirePrimaryAdmin && !isPrimaryAdmin) {
    return null;
  }

  if (requireAdmin && !isAdmin) {
    return null;
  }

  return <>{children}</>;
}
