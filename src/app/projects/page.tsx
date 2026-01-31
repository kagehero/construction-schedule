"use client";

import { useState, useEffect } from "react";
import { z } from "zod";
import type { ContractType, Project } from "@/domain/projects/types";
import { Card } from "@/components/ui/card";
import { getProjects, createProject } from "@/lib/supabase/projects";

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

  // Load projects from database on mount
  useEffect(() => {
    loadProjects();
  }, []);

  const loadProjects = async () => {
    try {
      setIsLoading(true);
      const data = await getProjects();
      setProjects(data);
    } catch (error) {
      console.error("Failed to load projects:", error);
      // Show error message to user if needed
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

  return (
    <div className="h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-semibold">案件立ち上げ</h1>
          <span className="text-xs text-slate-400">
            取引先・現場・契約情報の基本登録
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-hidden grid grid-cols-[minmax(0,1.2fr)_minmax(0,1.8fr)] gap-4 p-4">
        <Card title="新規案件登録">
          <form className="space-y-4 text-sm" onSubmit={handleSubmit}>
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
            <div className="pt-2">
              <button
                type="submit"
                disabled={isSubmitting}
                className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-white text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isSubmitting ? "登録中..." : "登録"}
              </button>
            </div>
          </form>
        </Card>
        <Card title="案件一覧">
          <div className="space-y-2 text-xs max-h-[calc(100vh-140px)] overflow-auto pr-1">
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
                  <div className="text-[10px] text-slate-400">
                    {p.startDate} ~ {p.endDate}
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-[11px] text-slate-300">
                    {p.customerName}
                  </span>
                  <span className="text-[11px] inline-flex items-center px-1.5 py-0.5 rounded bg-slate-800">
                    {p.contractType}
                  </span>
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
    </div>
  );
}


