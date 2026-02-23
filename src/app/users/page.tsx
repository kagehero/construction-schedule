"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import { Card } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { useState, useEffect } from "react";
import toast from "react-hot-toast";

type UserRow = {
  id: string;
  email: string;
  role: "admin" | "viewer";
};

/** 主管理者メール（削除・ロール変更不可、他ユーザーと識別表示） */
const PRIMARY_ADMIN_EMAIL = "admin@gmail.com";

export default function UsersPage() {
  const { profile } = useAuth();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [userRoleUpdatingId, setUserRoleUpdatingId] = useState<string | null>(null);
  const [userDeletingId, setUserDeletingId] = useState<string | null>(null);
  const [userSearch, setUserSearch] = useState("");

  const loadUsers = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from("user_profiles")
        .select("id, email, role")
        .order("email", { ascending: true });
      if (error) {
        console.error("Failed to load users:", error);
        toast.error("ユーザー一覧の取得に失敗しました。");
        return;
      }
      setUsers((data || []) as UserRow[]);
    } catch (error) {
      console.error("Failed to load users:", error);
      toast.error("ユーザー一覧の取得に失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadUsers();
  }, []);

  const handleChangeUserRole = async (user: UserRow, role: "admin" | "viewer") => {
    if (user.role === role) return;
    if (user.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase()) return;
    setUserRoleUpdatingId(user.id);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .update({ role })
        .eq("id", user.id);
      if (error) {
        console.error("Failed to update user role:", error);
        toast.error("ロールの更新に失敗しました。");
        return;
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, role } : u))
      );
      toast.success(`ロールを ${role === "admin" ? "管理者" : "閲覧者"} に変更しました。`);
    } catch (error) {
      console.error("Failed to update user role:", error);
      toast.error("ロールの更新に失敗しました。");
    } finally {
      setUserRoleUpdatingId(null);
    }
  };

  const handleDeleteUser = async (user: UserRow) => {
    if (user.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase()) {
      toast.error("主管理者は削除できません。");
      return;
    }
    if (!window.confirm(`ユーザー「${user.email}」を削除しますか？\n※ Supabase Auth 上のユーザーはダッシュボード側で削除してください。`)) {
      return;
    }
    setUserDeletingId(user.id);
    try {
      const { error } = await supabase
        .from("user_profiles")
        .delete()
        .eq("id", user.id);
      if (error) {
        console.error("Failed to delete user profile:", error);
        toast.error("ユーザーの削除に失敗しました。");
        return;
      }
      setUsers((prev) => prev.filter((u) => u.id !== user.id));
      toast.success("ユーザーを削除しました。（Auth ユーザーは Supabase 側で削除してください）");
    } catch (error) {
      console.error("Failed to delete user profile:", error);
      toast.error("ユーザーの削除に失敗しました。");
    } finally {
      setUserDeletingId(null);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = userSearch.trim().toLowerCase();
    if (!q) return true;
    return (
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q)
    );
  });

  return (
    <AuthGuard requirePrimaryAdmin>
      <div className="h-screen flex flex-col">
        <header className="px-4 md:px-6 py-3 border-b border-theme-border">
          <h1 className="text-lg font-semibold text-theme-text">ユーザー管理</h1>
          <p className="text-xs text-theme-text-muted mt-1">
            登録ユーザーの一覧・ロール変更・削除（管理者のみ）
          </p>
        </header>

        <div className="flex-1 overflow-auto p-3 md:p-4">
          <Card title="ユーザー一覧">
            <div className="space-y-2 text-xs max-h-[calc(100vh-180px)] overflow-auto pr-1">
              <div className="sticky top-0 z-10 bg-theme-card pb-2 -mt-1 pt-1">
                <input
                  type="search"
                  placeholder="メールアドレス・ロールで検索..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2 text-sm placeholder:text-theme-text-muted"
                  aria-label="ユーザーを検索"
                />
                {userSearch.trim() && (
                  <p className="mt-1 text-[11px] text-theme-text-muted">
                    {filteredUsers.length}件 / {users.length}件
                  </p>
                )}
                <p className="mt-1 text-[11px] text-theme-text-muted">
                  ロール変更は即時反映されます。admin@gmail.com は主管理者のため編集・削除できません。
                </p>
              </div>
              {isLoading ? (
                <p className="text-theme-text-muted text-xs">ユーザーを読み込み中...</p>
              ) : filteredUsers.length === 0 ? (
                <p className="text-theme-text-muted text-xs">
                  {userSearch.trim() ? "検索に一致するユーザーがいません。" : "まだユーザーが登録されていません。"}
                </p>
              ) : (
                <table className="w-full text-xs border-collapse">
                  <thead>
                    <tr className="bg-theme-bg-elevated text-theme-text-muted-strong">
                      <th className="px-3 py-2 text-left border-b border-theme-border">メールアドレス</th>
                      <th className="px-3 py-2 text-left border-b border-theme-border w-32">ロール</th>
                      <th className="px-3 py-2 text-left border-b border-theme-border w-28">操作</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredUsers.map((u) => {
                      const isPrimaryAdmin = u.email.toLowerCase().trim() === PRIMARY_ADMIN_EMAIL.toLowerCase();
                      return (
                        <tr
                          key={u.id}
                          className={`border-b border-theme-border/60 ${isPrimaryAdmin ? "bg-amber-500/10 border-l-2 border-l-amber-500" : ""}`}
                        >
                          <td className="px-3 py-2 align-middle">
                            <span className="break-all">{u.email}</span>
                            {isPrimaryAdmin && (
                              <span className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-medium bg-amber-500/25 text-amber-600 dark:text-amber-400 border border-amber-500/40">
                                主管理者
                              </span>
                            )}
                            {!isPrimaryAdmin && profile?.id === u.id && (
                              <span className="ml-1 text-[10px] text-theme-text-muted-strong">
                                （あなた）
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            {isPrimaryAdmin ? (
                              <span className="text-xs text-theme-text-muted-strong">管理者（主管理者）</span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) =>
                                  handleChangeUserRole(
                                    u,
                                    e.target.value as "admin" | "viewer"
                                  )
                                }
                                disabled={userRoleUpdatingId === u.id}
                                className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1 text-xs"
                              >
                                <option value="admin">管理者</option>
                                <option value="viewer">閲覧者</option>
                              </select>
                            )}
                          </td>
                          <td className="px-3 py-2 align-middle">
                            {isPrimaryAdmin ? (
                              <span className="text-[11px] text-theme-text-muted">—</span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => handleDeleteUser(u)}
                                disabled={userDeletingId === u.id}
                                className="px-2 py-1 rounded-md border border-red-600 text-[11px] text-red-400 bg-theme-bg-elevated hover:bg-red-900/20 disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                削除
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </Card>
        </div>
      </div>
    </AuthGuard>
  );
}
