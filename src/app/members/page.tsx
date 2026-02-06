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
  color: z.string().optional(), // #RRGGBB を想定（未指定なら自動色）
});

type FormState = z.infer<typeof memberSchema>;

export default function MembersPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [form, setForm] = useState<FormState>({
    name: "",
    color: "#3b82f6",
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingMember, setEditingMember] = useState<Member | null>(null);
  const [deletingMemberId, setDeletingMemberId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteModalClosing, setDeleteModalClosing] = useState(false);
  const [deleteModalAnimatingIn, setDeleteModalAnimatingIn] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [addModalClosing, setAddModalClosing] = useState(false);
  const [addModalAnimatingIn, setAddModalAnimatingIn] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editModalClosing, setEditModalClosing] = useState(false);
  const [editModalAnimatingIn, setEditModalAnimatingIn] = useState(false);
  const { isAdmin, signOut, profile } = useAuth();

  // 追加モーダル: 開閉アニメーション
  useEffect(() => {
    if (!showAddModal || addModalClosing) return;
    setAddModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setAddModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showAddModal, addModalClosing]);
  useEffect(() => {
    if (!addModalClosing) return;
    const t = setTimeout(() => {
      setShowAddModal(false);
      setAddModalClosing(false);
      setAddModalAnimatingIn(false);
      setForm({ name: "", color: "#3b82f6" });
      setErrors({});
    }, 220);
    return () => clearTimeout(t);
  }, [addModalClosing]);

  // 編集モーダル: 開閉アニメーション
  useEffect(() => {
    if (!showEditModal || !editingMember || editModalClosing) return;
    setEditModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setEditModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showEditModal, editingMember, editModalClosing]);
  useEffect(() => {
    if (!editModalClosing) return;
    const t = setTimeout(() => {
      setEditingMember(null);
      setShowEditModal(false);
      setEditModalClosing(false);
      setEditModalAnimatingIn(false);
      setForm({ name: "", color: "#3b82f6" });
      setErrors({});
    }, 220);
    return () => clearTimeout(t);
  }, [editModalClosing]);

  // 削除確認モーダル: 開くアニメーション
  useEffect(() => {
    if (!deletingMemberId || deleteModalClosing) return;
    setDeleteModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDeleteModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [deletingMemberId, deleteModalClosing]);

  // 削除確認モーダル: 閉じるアニメーション後にクリア
  useEffect(() => {
    if (!deleteModalClosing) return;
    const t = setTimeout(() => {
      setDeletingMemberId(null);
      setDeleteModalClosing(false);
      setDeleteModalAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [deleteModalClosing]);

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
        color: form.color,
      };

      const createdMember = await createMember(newMember);
      setMembers((prev) => [createdMember, ...prev]);
      toast.success("メンバーが登録されました。");
      setAddModalClosing(true);
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
    setForm({ name: member.name, color: member.color ?? "#3b82f6" });
    setShowEditModal(true);
    setEditModalClosing(false);
  };

  const openAddModal = () => {
    setForm({ name: "", color: "#3b82f6" });
    setErrors({});
    setShowAddModal(true);
    setAddModalClosing(false);
  };

  const closeAddModal = () => setAddModalClosing(true);
  const closeEditModal = () => setEditModalClosing(true);

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
        color: form.color,
      };

      const updatedMember = await updateMember(editingMember.id, updateData);
      setMembers((prev) => 
        prev.map((m) => (m.id === updatedMember.id ? updatedMember : m))
      );
      toast.success("メンバーが更新されました。");
      setEditModalClosing(true);
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
    setDeleteModalClosing(false);
  };

  const closeDeleteModal = () => setDeleteModalClosing(true);

  const handleDeleteConfirm = async () => {
    if (!deletingMemberId) return;

    setIsDeleting(true);
    try {
      await deleteMember(deletingMemberId);
      setMembers((prev) => prev.filter((m) => m.id !== deletingMemberId));
      setDeleteModalClosing(true);
      toast.success("メンバーが削除されました。");
    } catch (error: any) {
      console.error("Failed to delete member:", error);
      toast.error(error.message || "メンバーの削除に失敗しました。もう一度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  };


  return (
    <AuthGuard requireAdmin={true}>
    <div className="h-screen flex flex-col">
      <header className="px-4 md:px-6 py-3 border-b border-theme-border flex items-center justify-between">
        <h1 className="text-lg font-semibold text-theme-text">メンバー管理</h1>
        <button
          type="button"
          onClick={openAddModal}
          className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110"
        >
          追加
        </button>
      </header>
      <div className="flex-1 overflow-auto p-3 md:p-4">
        <Card title="メンバー一覧">
          <div className="space-y-2 text-xs max-h-[calc(100vh-140px)] overflow-auto pr-1" >
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

      {/* 追加モーダル（開閉アニメーション） */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              addModalClosing || !addModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={closeAddModal}
          />
          <div
            className={`relative w-full max-w-[400px] rounded-xl bg-theme-bg-input border border-theme-border shadow-lg p-4 text-theme-text transition-all duration-200 ease-out ${
              addModalClosing || !addModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">メンバー追加</h3>
              <button
                type="button"
                onClick={closeAddModal}
                className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
              <div>
                <label className="block mb-1">メンバー名</label>
                <input
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-3 py-2"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="例: 寺道雅気"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block mb-1 text-xs text-theme-text-muted-strong">表示色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-8 rounded border border-theme-border bg-theme-bg-elevated cursor-pointer"
                    value={form.color ?? "#3b82f6"}
                    onChange={(e) => handleChange("color", e.target.value)}
                    title="工程表でのメンバー色"
                  />
                  <span className="text-[11px] text-theme-text-muted">
                    工程表のメンバー丸アイコンの色になります
                  </span>
                </div>
              </div>
              {errors.submit && (
                <p className="text-xs text-red-400">{errors.submit}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeAddModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md border border-theme-border text-theme-text text-xs hover:bg-theme-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "登録中..." : "登録"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 編集モーダル（開閉アニメーション） */}
      {showEditModal && editingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              editModalClosing || !editModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={closeEditModal}
          />
          <div
            className={`relative w-full max-w-[400px] rounded-xl bg-theme-bg-input border border-theme-border shadow-lg p-4 text-theme-text transition-all duration-200 ease-out ${
              editModalClosing || !editModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-base font-semibold">メンバー編集</h3>
              <button
                type="button"
                onClick={closeEditModal}
                className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <form className="space-y-4 text-sm" onSubmit={handleUpdate}>
              <div>
                <label className="block mb-1">メンバー名</label>
                <input
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-3 py-2"
                  value={form.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  placeholder="例: 寺道雅気"
                />
                {errors.name && (
                  <p className="mt-1 text-xs text-red-400">{errors.name}</p>
                )}
              </div>
              <div>
                <label className="block mb-1 text-xs text-theme-text-muted-strong">表示色</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="w-10 h-8 rounded border border-theme-border bg-theme-bg-elevated cursor-pointer"
                    value={form.color ?? "#3b82f6"}
                    onChange={(e) => handleChange("color", e.target.value)}
                    title="工程表でのメンバー色"
                  />
                  <span className="text-[11px] text-theme-text-muted">
                    工程表のメンバー丸アイコンの色になります
                  </span>
                </div>
              </div>
              {errors.submit && (
                <p className="text-xs text-red-400">{errors.submit}</p>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md border border-theme-border text-theme-text text-xs hover:bg-theme-bg-elevated disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  キャンセル
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? "更新中..." : "更新"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal（開閉アニメーション） */}
      {deletingMemberId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              deleteModalClosing || !deleteModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={closeDeleteModal}
          />
          <div
            className={`relative w-full max-w-[400px] rounded-xl bg-theme-bg-input border border-theme-border shadow-lg p-4 text-theme-text transition-all duration-200 ease-out ${
              deleteModalClosing || !deleteModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
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
                onClick={closeDeleteModal}
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
