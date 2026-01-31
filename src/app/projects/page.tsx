"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import type { ContractType, Project } from "@/domain/projects/types";
import { Card } from "@/components/ui/card";
import { getProjects, createProject, updateProject, deleteProject } from "@/lib/supabase/projects";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import toast from "react-hot-toast";

const projectSchema = z.object({
  title: z.string().optional(), // Optional, will use siteName if empty
  customerName: z.string().min(1, "取引先会社名は必須です"),
  siteName: z.string().min(1, "現場名は必須です"),
  contractType: z.enum(["請負", "常用", "追加工事"]),
  contractAmount: z
    .number()
    .nullable()
    .refine(
      (val) => val === null || val >= 0,
      "請負金額は0以上で入力してください"
    ),
  siteAddress: z.string().min(1, "現場住所は必須です"),
  startDate: z.string().min(1, "開始日は必須です"),
  endDate: z.string().min(1, "終了日は必須です")
});

type FormState = z.infer<typeof projectSchema>;

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [form, setForm] = useState<FormState>({
    title: "",
    customerName: "",
    siteName: "",
    contractType: "請負",
    contractAmount: null,
    siteAddress: "",
    startDate: "",
    endDate: ""
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const { isAdmin, signOut, profile } = useAuth();

  // Load projects from database on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (error: any) {
      console.error("Failed to load projects:", error);
      setErrors({ 
        submit: error.message || "データの読み込みに失敗しました。環境変数が正しく設定されているか確認してください。" 
      });
    } finally {
      setIsLoading(false);
    }
  };

  const isUkeoi = form.contractType === "請負";

  const handleChange = (
    field: keyof FormState,
    value: string | number | null
  ) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = projectSchema.safeParse(form);
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
      const newProject: Omit<Project, 'id'> = {
        title: form.title || form.siteName, // Use siteName as title if title is empty
        customerName: form.customerName,
        siteName: form.siteName,
        contractType: form.contractType as ContractType,
        contractAmount: isUkeoi ? form.contractAmount ?? 0 : undefined,
        siteAddress: form.siteAddress,
        startDate: form.startDate,
        endDate: form.endDate
      };

      const createdProject = await createProject(newProject);
      setProjects((prev) => [createdProject, ...prev]);
      
      // Reset form
      setForm({
        title: "",
        customerName: "",
        siteName: "",
        contractType: "請負",
        contractAmount: null,
        siteAddress: "",
        startDate: "",
        endDate: ""
      });
    } catch (error) {
      console.error("Failed to create project:", error);
      setErrors({ 
        submit: "案件の登録に失敗しました。もう一度お試しください。" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (project: Project) => {
    setEditingProject(project);
    setForm({
      title: project.title || "",
      customerName: project.customerName,
      siteName: project.siteName,
      contractType: project.contractType,
      contractAmount: project.contractAmount ?? null,
      siteAddress: project.siteAddress,
      startDate: project.startDate,
      endDate: project.endDate
    });
    // Scroll to form
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject) return;

    const parsed = projectSchema.safeParse(form);
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
      const updateData: Partial<Omit<Project, 'id'>> = {
        title: form.title || form.siteName,
        customerName: form.customerName,
        siteName: form.siteName,
        contractType: form.contractType as ContractType,
        contractAmount: isUkeoi ? form.contractAmount ?? 0 : undefined,
        siteAddress: form.siteAddress,
        startDate: form.startDate,
        endDate: form.endDate
      };

      const updatedProject = await updateProject(editingProject.id, updateData);
      setProjects((prev) => 
        prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
      );
      
      // Reset form and editing state
      setEditingProject(null);
      setForm({
        title: "",
        customerName: "",
        siteName: "",
        contractType: "請負",
        contractAmount: null,
        siteAddress: "",
        startDate: "",
        endDate: ""
      });
    } catch (error) {
      console.error("Failed to update project:", error);
      setErrors({ 
        submit: "案件の更新に失敗しました。もう一度お試しください。" 
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (projectId: string) => {
    setDeletingProjectId(projectId);
  };

  const handleDeleteConfirm = async () => {
    if (!deletingProjectId) return;

    setIsDeleting(true);
    try {
      await deleteProject(deletingProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProjectId));
      setDeletingProjectId(null);
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("案件の削除に失敗しました。もう一度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingProject(null);
    setForm({
      title: "",
      customerName: "",
      siteName: "",
      contractType: "請負",
      contractAmount: null,
      siteAddress: "",
      startDate: "",
      endDate: ""
    });
    setErrors({});
  };

  return (
    <AuthGuard requireAdmin={true}>
      <div className="h-screen flex flex-col">
        <header className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-lg font-semibold">案件立ち上げ</h1>
            <span className="text-xs text-slate-400">
              取引先・現場・契約情報の基本登録
            </span>
          </div>
          <div className="flex items-center gap-2 text-[11px]">
            {profile && (
              <>
                <span className="px-2 py-0.5 rounded-full border border-slate-600 text-slate-200">
                  {profile.email}
                </span>
                <button
                  onClick={signOut}
                  className="px-2 py-0.5 rounded-full border border-slate-600 text-slate-200 hover:bg-slate-800 text-[10px]"
                >
                  ログアウト
                </button>
              </>
            )}
          </div>
        </header>
      <div className="flex-1 overflow-hidden grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] gap-4 p-4">
        <Card title={editingProject ? "案件編集" : "新規案件登録"}>
          <form className="space-y-4 text-sm" onSubmit={editingProject ? handleUpdate : handleSubmit}>
            <div>
              <label className="block mb-1">取引先会社名</label>
              <input
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                value={form.customerName}
                onChange={(e) => handleChange("customerName", e.target.value)}
              />
              {errors.customerName && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.customerName}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1">現場名</label>
              <input
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                value={form.siteName}
                onChange={(e) => handleChange("siteName", e.target.value)}
              />
              {errors.siteName && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.siteName}
                </p>
              )}
            </div>
            <div>
              <label className="block mb-1">契約形態</label>
              <select
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                value={form.contractType}
                onChange={(e) =>
                  handleChange("contractType", e.target.value as ContractType)
                }
              >
                <option value="請負">請負</option>
                <option value="常用">常用</option>
                <option value="追加工事">追加工事</option>
              </select>
            </div>
            {isUkeoi && (
              <div>
                <label className="block mb-1">請負金額（管理者のみ表示想定）</label>
                <input
                  type="number"
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                  value={form.contractAmount ?? ""}
                  onChange={(e) =>
                    handleChange(
                      "contractAmount",
                      e.target.value ? Number(e.target.value) : null
                    )
                  }
                />
                {errors.contractAmount && (
                  <p className="mt-1 text-xs text-red-400">
                    {errors.contractAmount}
                  </p>
                )}
              </div>
            )}
            <div>
              <label className="block mb-1">現場住所</label>
              <input
                className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                value={form.siteAddress}
                onChange={(e) => handleChange("siteAddress", e.target.value)}
              />
              {errors.siteAddress && (
                <p className="mt-1 text-xs text-red-400">
                  {errors.siteAddress}
                </p>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block mb-1">工期開始日</label>
                <input
                  type="date"
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                  value={form.startDate}
                  onChange={(e) => handleChange("startDate", e.target.value)}
                />
              </div>
              <div>
                <label className="block mb-1">工期終了日</label>
                <input
                  type="date"
                  className="w-full rounded-md bg-slate-900 border border-slate-700 px-3 py-2"
                  value={form.endDate}
                  onChange={(e) => handleChange("endDate", e.target.value)}
                />
              </div>
            </div>
            {errors.submit && (
              <p className="text-xs text-red-400">{errors.submit}</p>
            )}
            <div className="pt-2 flex gap-2">
              {editingProject && (
                <button
                  type="button"
                  onClick={handleCancelEdit}
                  disabled={isSubmitting}
                  className="inline-flex items-center px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-white text-sm font-medium hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
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
                  ? (editingProject ? "更新中..." : "登録中...") 
                  : (editingProject ? "更新" : "登録")
                }
              </button>
            </div>
          </form>
        </Card>
        <Card title="案件一覧">
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
              <p className="text-slate-500 text-xs">読み込み中...</p>
            ) : (
              <>
                {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
              >
                <div className="flex items-center justify-between">
                  <div className="font-semibold">{p.siteName}</div>
                  <div className="flex items-center gap-2">
                    <div className="text-[10px] text-slate-400">
                      {p.startDate} ~ {p.endDate}
                    </div>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(p)}
                        className="px-2 py-1 text-[10px] rounded border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300"
                        title="編集"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(p.id)}
                        className="px-2 py-1 text-[10px] rounded border border-red-600 bg-slate-800 hover:bg-red-900/20 text-red-400"
                        title="削除"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-[11px] text-slate-300">
                    {p.customerName}
                  </span>
                  <span className="text-[11px] inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800">
                    {p.contractType}
                  </span>
                  {p.contractAmount && (
                    <span className="text-[11px] text-slate-400">
                      ¥{p.contractAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-slate-400 truncate">
                  {p.siteAddress}
                </div>
              </div>
            ))}
                {projects.length === 0 && (
                  <p className="text-slate-500 text-xs">
                    まだ案件が登録されていません。
                  </p>
                )}
              </>
            )}
          </div>
        </Card>
      </div>

      {/* Delete Confirmation Modal */}
      {deletingProjectId && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[400px] rounded-xl bg-slate-900 border border-slate-700 shadow-lg p-4">
            <div className="mb-4">
              <h3 className="text-sm font-semibold mb-2">案件の削除</h3>
              <p className="text-xs text-slate-400">
                この案件を削除してもよろしいですか？この操作は取り消せません。
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeletingProjectId(null)}
                disabled={isDeleting}
                className="px-4 py-2 rounded-md border border-slate-600 text-xs hover:bg-slate-800 disabled:opacity-50 disabled:cursor-not-allowed"
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


