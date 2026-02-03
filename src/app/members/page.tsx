"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import type { Member } from "@/domain/schedule/types";
import { Card } from "@/components/ui/card";
import { getMembers, createMember, updateMember, deleteMember } from "@/lib/supabase/schedule";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import toast from "react-hot-toast";

const memberSchema = z.object({
  name: z.string().min(1, "メンバー名は必須です"),
});

type FormState = z.infer<typeof memberSchema>;

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { isAdmin, signOut, profile } = useAuth();

  // Load members from database on mount
  useEffect(() => {
    loadMembers();
  }, []);

  const loadMembers = async () => {
    try {
      setIsLoading(true);
      const data = await getMembers();
      setMembers(data);
    } catch (error: any) {
      console.error("Failed to load members:", error);
      setErrors({ 
        submit: error.message || "データの読み込みに失敗しました。環境変数が正しく設定されているか確認してください。" 
      });
      toast.error("メンバーデータの読み込みに失敗しました。");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (field: keyof FormState, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = memberSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const newMember: Omit<Member, 'id'> = {
        name: form.name,
      };

      const createdMember = await createMember(newMember);
      setMembers((prev) => [createdMember, ...prev]);
      toast.success("メンバーが登録されました。");
      
      // Reset form
      setForm({
        name: "",
      });
    } catch (error: any) {
      console.error("Failed to create member:", error);
      setErrors({ 
        submit: error.message || "メンバーの登録に失敗しました。もう一度お試しください。" 
      });
      toast.error("メンバーの登録に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (member: Member) => {
    setEditingMember(member);
    setForm({
      name: member.name,
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingMember) return;

    const parsed = memberSchema.safeParse(form);
    if (!parsed.success) {
      const fieldErrors: Record<string, string> = {};
      parsed.error.issues.forEach((issue) => {
        const key = issue.path[0]?.toString();
        if (key && !fieldErrors[key]) {
          fieldErrors[key] = issue.message;
        }
      });
      setErrors(fieldErrors);
      return;
    }
    setErrors({});
    setIsSubmitting(true);

    try {
      const updateData: Partial<Omit<Member, 'id'>> = {
        name: form.name,
      };

      const updatedMember = await updateMember(editingMember.id, updateData);
      setMembers((prev) => 
        prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
      );
      toast.success("メンバーが更新されました。");
      
      // Reset form and editing state
      setEditingMember(null);
      setForm({
        name: "",
      });
    } catch (error: any) {
      console.error("Failed to update member:", error);
      setErrors({ 
        submit: error.message || "メンバーの更新に失敗しました。もう一度お試しください。" 
      });
      toast.error("メンバーの更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (memberId: string) => {
    setDeletingMemberId(memberId);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingMemberId) return;

    setIsDeleting(true);
    try {
      await deleteMember(deletingMemberId);
      setMembers((prev) => prev.filter((m) => m.id !== deletingMemberId));
      setDeletingMemberId(null);
      toast.success("メンバーが削除されました。");
    } catch (error: any) {
      console.error("Failed to delete member:", error);
      toast.error(error.message || "メンバーの削除に失敗しました。もう一度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingMember(null);
    setForm({
      name: "",
    });
    setErrors({});
  };

  return (
    <AuthGuard requireAdmin={true}>
    <div className="h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-theme-border flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-semibold text-theme-text">メンバー管理</h1>
          <span className="text-xs text-theme-text-muted">
            作業メンバーの追加・編集・削除
          </span>
        </div>
          <div className="flex items-center gap-2 text-[11px]">
            {profile && (
              <>
                <span className="px-2 py-0.5 rounded-full border border-theme-border text-theme-text">
                  {profile.email}
                </span>
                <button
                  onClick={signOut}
                  className="px-2 py-0.5 rounded-full border border-theme-border text-theme-text hover:bg-slate-800 text-[10px]"
                >
                  ログアウト
                </button>
              </>
            )}
          </div>
      </header>
      <div className="flex-1 overflow-hidden grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] gap-4 p-4">
        <Card title={editingMember ? "メンバー編集" : "新規メンバー登録"}>
          <form className="space-y-4 text-sm" onSubmit={editingMember ? handleUpdate : handleSubmit}>
            <div>
              <label className="block mb-1">メンバー名</label>
              <input
                className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                value={form.name}
                onChange={(e) => handleChange("name", e.target.value)}
                placeholder="例: 寺道雅気"
              />
              {errors.name && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.name}
                </p>
              )}
            </div>
            {errors.submit && (
              <p className="text-xs text-red-400">{errors.submit}</p>
            )}
            <div className="pt-2 flex gap-2">
              {editingMember && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text text-sm font-medium hover:bg-theme-bg-elevated-hover disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  キャンセル
                </button>
              )}
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting 
                  ? (editingMember ? "更新中..." : "登録中...") 
                  : (editingMember ? "更新" : "登録")
                }
              </button>
            </div>
          </form>
        </Card>
        <Card title="メンバー一覧">
          <div className="space-y-2 text-xs max-h-[calc(100vh-140px)] overflow-auto pr-1">
            {errors.submit && !isLoading && (
              <div className="mb-2 p-2 bg-red-900/20 border border-red-800 rounded-md">
                <p className="text-xs text-red-400">{errors.submit}</p>
                <p className="text-xs text-red-500 mt-1">
                  .env.localファイルにNEXT_PUBLIC_SUPABASE_URLとNEXT_PUBLIC_SUPABASE_ANON_KEYが設定されているか確認してください。
                </p>
              </div>
            )}
            {isLoading ? (
              <p className="text-theme-text-muted text-xs">読み込み中...</p>
            ) : (
              <>
            {members.map((m) => (
              <div
                key={m.id}
                className="rounded-lg border border-theme-border bg-theme-bg-input text-theme-text px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{m.name}</div>
                  <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(m)}
                        className="px-2 py-1 text-[10px] rounded border border-theme-border bg-slate-800 hover:bg-theme-bg-elevated-hover text-theme-text-muted-strong"
                        title="編集"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(m.id)}
                        className="px-2 py-1 text-[10px] rounded border border-red-600 bg-slate-800 hover:bg-red-900/20 text-red-400"
                        title="削除"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
            ))}
            {members.length === 0 && (
              <p className="text-theme-text-muted text-xs">
                まだメンバーが登録されていません。
              </p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingMemberId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[400px] rounded-xl bg-theme-bg-input border border-theme-border shadow-lg p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2 text-theme-text">メンバーの削除</h3>
              <p className="text-xs text-theme-text-muted">
                このメンバーを削除してもよろしいですか？この操作は取り消せません。
                <br />
                <span className="text-red-400 mt-2 block">
                  注意: このメンバーが工程表に割り当てられている場合、割り当て情報も削除されます。
                </span>
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingMemberId(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md border border-theme-border text-theme-text text-xs hover:bg-theme-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md bg-red-600 text-xs font-medium hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isDeleting ? "削除中..." : "削除"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}
