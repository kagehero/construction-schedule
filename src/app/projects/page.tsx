"use client";

import { useState, useEffect } from "react";
import { format } from "date-fns";
import { z } from "zod";
import type { ContractType, Project } from "@/domain/projects/types";
import { Card } from "@/components/ui/card";
import { getProjects, createProject, updateProject, deleteProject } from "@/lib/supabase/projects";
import { getWorkLines, createWorkLine, updateWorkLine, deleteWorkLine } from "@/lib/supabase/schedule";
import { getWorkGroups, createWorkGroup, updateWorkGroup, deleteWorkGroup } from "@/lib/supabase/workGroups";
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from "@/lib/supabase/customers";
import { getCustomerMembers, createCustomerMember, updateCustomerMember, deleteCustomerMember } from "@/lib/supabase/customerMembers";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import toast from "react-hot-toast";
import type { WorkLine } from "@/domain/schedule/types";
import type { Customer } from "@/lib/supabase/customers";
import type { WorkGroup } from "@/lib/supabase/workGroups";

type TabId = "projects" | "work_lines" | "customers";

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
  endDate: z.string().min(1, "終了日は必須です"),
  memo: z.string().max(1000, "メモは1000文字以内で入力してください").optional(),
  siteStatus: z.string().max(50, "現場ステータスは50文字以内で入力してください").optional()
});

type FormState = z.infer<typeof projectSchema>;

const WORK_GROUP_DEFAULT_COLORS = ["#3b82f6", "#f97316", "#22c55e", "#eab308", "#a855f7", "#ef4444", "#06b6d4"];

/** 工期（開始日・終了日）からステータスを判定 */
function getProjectStatus(project: Project): "未施工" | "施工中" | "完工" {
  const today = format(new Date(), "yyyy-MM-dd");
  if (today < project.startDate) return "未施工";
  if (today > project.endDate) return "完工";
  return "施工中";
}

export default function ProjectsPage() {
  const [activeTab, setActiveTab] = useState<TabId>("projects");
  const [projects, setProjects] = useState<Project[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [form, setForm] = useState<FormState>({
    title: "",
    customerName: "",
    siteName: "",
    contractType: "請負",
    contractAmount: null,
    siteAddress: "",
    startDate: "",
    endDate: "",
    memo: "",
    siteStatus: "組立"
  });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProject, setEditingProject] = useState<Project | null>(null);
  const [deletingProjectId, setDeletingProjectId] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedWorkGroupIds, setSelectedWorkGroupIds] = useState<string[]>([]);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>("");
  const [showNewProjectForm, setShowNewProjectForm] = useState(false);
  const [formModalClosing, setFormModalClosing] = useState(false);
  const [formModalAnimatingIn, setFormModalAnimatingIn] = useState(false);
  const [deleteModalClosing, setDeleteModalClosing] = useState(false);
  const [deleteModalAnimatingIn, setDeleteModalAnimatingIn] = useState(false);
  // 作業班管理（work_groups マスター）
  const [workGroups, setWorkGroupsState] = useState<WorkGroup[]>([]);
  const [editingWorkGroup, setEditingWorkGroup] = useState<WorkGroup | null>(null);
  const [newWorkGroupName, setNewWorkGroupName] = useState("");
  const [newWorkGroupColor, setNewWorkGroupColor] = useState(WORK_GROUP_DEFAULT_COLORS[0]);
  const [showWorkGroupModal, setShowWorkGroupModal] = useState(false);
  const [workGroupModalClosing, setWorkGroupModalClosing] = useState(false);
  const [workGroupModalAnimatingIn, setWorkGroupModalAnimatingIn] = useState(false);
  const [deletingWorkGroupId, setDeletingWorkGroupId] = useState<string | null>(null);
  const [workGroupDeleteModalClosing, setWorkGroupDeleteModalClosing] = useState(false);
  const [workGroupDeleteAnimatingIn, setWorkGroupDeleteAnimatingIn] = useState(false);
  const [isWorkGroupSubmitting, setIsWorkGroupSubmitting] = useState(false);
  const [isWorkGroupDeleting, setIsWorkGroupDeleting] = useState(false);
  const [workGroupsLoading, setWorkGroupsLoading] = useState(false);
  // 取引先会社
  const [editingCustomer, setEditingCustomer] = useState<Customer | null>(null);
  const [newCustomerName, setNewCustomerName] = useState("");
  const [newCustomerAddress, setNewCustomerAddress] = useState("");
  const [newCustomerPhone, setNewCustomerPhone] = useState("");
  const [newCustomerContactPerson, setNewCustomerContactPerson] = useState("");
  const [customerMemberRows, setCustomerMemberRows] = useState<{ id?: string; name: string; color: string }[]>([]);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  const [customerModalClosing, setCustomerModalClosing] = useState(false);
  const [customerModalAnimatingIn, setCustomerModalAnimatingIn] = useState(false);
  const [deletingCustomerId, setDeletingCustomerId] = useState<string | null>(null);
  const [customerDeleteModalClosing, setCustomerDeleteModalClosing] = useState(false);
  const [customerDeleteAnimatingIn, setCustomerDeleteAnimatingIn] = useState(false);
  const [isCustomerSubmitting, setIsCustomerSubmitting] = useState(false);
  const [isCustomerDeleting, setIsCustomerDeleting] = useState(false);
  const [customersLoading, setCustomersLoading] = useState(false);
  const { isAdmin, signOut, profile } = useAuth();
  const [copySourceProjectId, setCopySourceProjectId] = useState<string>("");
  const [projectHolidayWeekdays, setProjectHolidayWeekdays] = useState<number[]>([]);

  const showForm = showNewProjectForm || !!editingProject;

  // モーダル表示時: マウント後に開くアニメーション開始
  useEffect(() => {
    if (!showForm || formModalClosing) return;
    setFormModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setFormModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showForm, formModalClosing]);

  // モーダル閉じる: アニメーション後に状態クリア
  useEffect(() => {
    if (!formModalClosing) return;
    const t = setTimeout(() => {
      setEditingProject(null);
      setShowNewProjectForm(false);
      setFormModalClosing(false);
      setFormModalAnimatingIn(false);
      setForm({
        title: "",
        customerName: "",
        siteName: "",
        contractType: "請負",
        contractAmount: null,
        siteAddress: "",
        startDate: "",
        endDate: "",
        memo: "",
        siteStatus: "組立"
      });
      setSelectedWorkGroupIds([]);
      setSelectedCustomerId("");
      setProjectHolidayWeekdays([]);
      setErrors({});
    }, 220);
    return () => clearTimeout(t);
  }, [formModalClosing]);

  // 削除確認モーダル: 開くアニメーション
  useEffect(() => {
    if (!deletingProjectId || deleteModalClosing) return;
    setDeleteModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setDeleteModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [deletingProjectId, deleteModalClosing]);

  // 削除確認モーダル: 閉じるアニメーション後にクリア
  useEffect(() => {
    if (!deleteModalClosing) return;
    const t = setTimeout(() => {
      setDeletingProjectId(null);
      setDeleteModalClosing(false);
      setDeleteModalAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [deleteModalClosing]);

  // Load projects and customers on mount
  useEffect(() => {
    loadProjects();
    loadCustomers();
    loadWorkGroups();
  }, []);

  const loadCustomers = async () => {
    try {
      setCustomersLoading(true);
      const data = await getCustomers();
      setCustomers(data);
    } catch (error) {
      console.error("Failed to load customers:", error);
    } finally {
      setCustomersLoading(false);
    }
  };

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

  const loadWorkGroups = async () => {
    try {
      setWorkGroupsLoading(true);
      const data = await getWorkGroups();
      setWorkGroupsState(data);
    } catch (error) {
      console.error("Failed to load work groups:", error);
      setWorkGroupsState([]);
    } finally {
      setWorkGroupsLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === "work_lines") loadWorkGroups();
  }, [activeTab]);

  const openNewWorkGroupModal = () => {
    setEditingWorkGroup(null);
    setNewWorkGroupName("");
    setNewWorkGroupColor(WORK_GROUP_DEFAULT_COLORS[0]);
    setShowWorkGroupModal(true);
    setWorkGroupModalClosing(false);
  };

  const openEditWorkGroupModal = (wg: WorkGroup) => {
    setEditingWorkGroup(wg);
    setNewWorkGroupName(wg.name);
    setNewWorkGroupColor(wg.color ?? WORK_GROUP_DEFAULT_COLORS[0]);
    setShowWorkGroupModal(true);
    setWorkGroupModalClosing(false);
  };

  const closeWorkGroupModal = () => setWorkGroupModalClosing(true);

  const handleWorkGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newWorkGroupName.trim();
    if (!name) {
      toast.error("作業班名を入力してください。");
      return;
    }
    // 同名の作業班が既に存在しないかチェック（編集時は自分自身を除外）
    const duplicate = workGroups.some(
      (wg) =>
        wg.name.trim() === name &&
        (!editingWorkGroup || wg.id !== editingWorkGroup.id)
    );
    if (duplicate) {
      toast.error("同じ作業班名が既に登録されています。別の名前を入力してください。");
      return;
    }
    setIsWorkGroupSubmitting(true);
    try {
      if (editingWorkGroup) {
        await updateWorkGroup(editingWorkGroup.id, { name, color: newWorkGroupColor });
        toast.success("作業班を更新しました。");
      } else {
        await createWorkGroup({ name, color: newWorkGroupColor });
        toast.success("作業班を登録しました。");
      }
      loadWorkGroups();
      setWorkGroupModalClosing(true);
    } catch (error) {
      console.error("Failed to save work group:", error);
      toast.error("保存に失敗しました。");
    } finally {
      setIsWorkGroupSubmitting(false);
    }
  };

  const handleWorkGroupDeleteClick = (id: string) => {
    setDeletingWorkGroupId(id);
    setWorkGroupDeleteModalClosing(false);
  };

  const handleWorkGroupDeleteConfirm = async () => {
    if (!deletingWorkGroupId) return;
    setIsWorkGroupDeleting(true);
    try {
      // 対象の作業班を取得（同名の work_line を削除するために利用）
      const targetWorkGroup = workGroups.find((wg) => wg.id === deletingWorkGroupId);

      // まず作業班マスターを削除
      await deleteWorkGroup(deletingWorkGroupId);

      // 続いて、この作業班名を持つ作業班行（work_lines）を工程表から削除
      if (targetWorkGroup) {
        try {
          const lines = await getWorkLines();
          const relatedLines = lines.filter((wl) => wl.name === targetWorkGroup.name);
          for (const wl of relatedLines) {
            try {
              await deleteWorkLine(wl.id);
            } catch (err) {
              console.error(`Failed to delete work line "${wl.name}" (${wl.id}):`, err);
              toast.error(`工程表の作業班「${wl.name}」の削除に失敗しました。`);
            }
          }
        } catch (err) {
          console.error("Failed to load work lines for delete:", err);
          toast.error("工程表の作業班削除のための読み込みに失敗しました。");
        }
      }

      loadWorkGroups();
      setWorkGroupDeleteModalClosing(true);
    } catch (error) {
      console.error("Failed to delete work group:", error);
      toast.error("削除に失敗しました。");
    } finally {
      setIsWorkGroupDeleting(false);
    }
  };

  const openNewCustomerModal = () => {
    setEditingCustomer(null);
    setNewCustomerName("");
    setNewCustomerAddress("");
    setNewCustomerPhone("");
    setNewCustomerContactPerson("");
    setCustomerMemberRows([]);
    setShowCustomerModal(true);
    setCustomerModalClosing(false);
  };

  const openEditCustomerModal = async (c: Customer) => {
    setEditingCustomer(c);
    setNewCustomerName(c.name);
    setNewCustomerAddress(c.address ?? "");
    setNewCustomerPhone(c.phone ?? "");
    setNewCustomerContactPerson(c.contactPerson ?? "");
    setShowCustomerModal(true);
    setCustomerModalClosing(false);
    try {
      const members = await getCustomerMembers(c.id);
      setCustomerMemberRows(
        members.map((m, i) => ({
          id: m.id,
          name: m.name,
          color: m.color ?? WORK_GROUP_DEFAULT_COLORS[i % WORK_GROUP_DEFAULT_COLORS.length]
        }))
      );
    } catch (error) {
      console.error("Failed to load customer members:", error);
      setCustomerMemberRows([]);
    }
  };

  const closeCustomerModal = () => setCustomerModalClosing(true);

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newCustomerName.trim();
    if (!name) {
      toast.error("取引先会社名を入力してください。");
      return;
    }
    setIsCustomerSubmitting(true);
    try {
      const input = {
        name,
        address: newCustomerAddress.trim() || undefined,
        phone: newCustomerPhone.trim() || undefined,
        contactPerson: newCustomerContactPerson.trim() || undefined,
      };
      let customerId: string;
      if (editingCustomer) {
        await updateCustomer(editingCustomer.id, input);
        customerId = editingCustomer.id;
        const existingIds = new Set(customerMemberRows.filter((r) => r.id).map((r) => r.id!));
        const currentMembers = await getCustomerMembers(customerId);
        for (const m of currentMembers) {
          if (!existingIds.has(m.id)) await deleteCustomerMember(m.id);
        }
        for (const row of customerMemberRows) {
          const n = row.name.trim();
          if (!n) continue;
          const color = row.color || WORK_GROUP_DEFAULT_COLORS[0];
          if (row.id) {
            await updateCustomerMember(row.id, n, color);
          } else {
            await createCustomerMember(customerId, n, color);
          }
        }
        toast.success("取引先会社を更新しました。");
      } else {
        const created = await createCustomer(input);
        customerId = created.id;
        for (const row of customerMemberRows) {
          const n = row.name.trim();
          if (n) await createCustomerMember(customerId, n, row.color || WORK_GROUP_DEFAULT_COLORS[0]);
        }
        toast.success("取引先会社を登録しました。");
      }
      loadCustomers();
      setCustomerModalClosing(true);
    } catch (error) {
      console.error("Failed to save customer:", error);
      toast.error("保存に失敗しました。");
    } finally {
      setIsCustomerSubmitting(false);
    }
  };

  const addCustomerMemberRow = () => {
    setCustomerMemberRows((prev) => [
      ...prev,
      { name: "", color: WORK_GROUP_DEFAULT_COLORS[prev.length % WORK_GROUP_DEFAULT_COLORS.length] }
    ]);
  };

  const removeCustomerMemberRow = (index: number) => {
    setCustomerMemberRows((prev) => prev.filter((_, i) => i !== index));
  };

  const updateCustomerMemberRowName = (index: number, value: string) => {
    setCustomerMemberRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], name: value };
      return next;
    });
  };

  const updateCustomerMemberRowColor = (index: number, color: string) => {
    setCustomerMemberRows((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], color };
      return next;
    });
  };

  const handleCustomerDeleteClick = (id: string) => {
    setDeletingCustomerId(id);
    setCustomerDeleteModalClosing(false);
  };

  const handleCustomerDeleteConfirm = async () => {
    if (!deletingCustomerId) return;
    setIsCustomerDeleting(true);
    try {
      await deleteCustomer(deletingCustomerId);
      loadCustomers();
      setCustomerDeleteModalClosing(true);
    } catch (error) {
      console.error("Failed to delete customer:", error);
      toast.error("削除に失敗しました。");
    } finally {
      setIsCustomerDeleting(false);
    }
  };

  useEffect(() => {
    if (!showWorkGroupModal || workGroupModalClosing) return;
    setWorkGroupModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWorkGroupModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showWorkGroupModal, workGroupModalClosing]);

  useEffect(() => {
    if (!workGroupModalClosing) return;
    const t = setTimeout(() => {
      setShowWorkGroupModal(false);
      setEditingWorkGroup(null);
      setWorkGroupModalClosing(false);
      setWorkGroupModalAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [workGroupModalClosing]);

  useEffect(() => {
    if (!deletingWorkGroupId || workGroupDeleteModalClosing) return;
    setWorkGroupDeleteAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setWorkGroupDeleteAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [deletingWorkGroupId, workGroupDeleteModalClosing]);

  useEffect(() => {
    if (!workGroupDeleteModalClosing) return;
    const t = setTimeout(() => {
      setDeletingWorkGroupId(null);
      setWorkGroupDeleteModalClosing(false);
      setWorkGroupDeleteAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [workGroupDeleteModalClosing]);

  useEffect(() => {
    if (!showCustomerModal || customerModalClosing) return;
    setCustomerModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCustomerModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showCustomerModal, customerModalClosing]);

  useEffect(() => {
    if (!customerModalClosing) return;
    const t = setTimeout(() => {
      setShowCustomerModal(false);
      setEditingCustomer(null);
      setNewCustomerName("");
      setNewCustomerAddress("");
      setNewCustomerPhone("");
      setNewCustomerContactPerson("");
      setCustomerMemberRows([]);
      setCustomerModalClosing(false);
      setCustomerModalAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [customerModalClosing]);

  useEffect(() => {
    if (!deletingCustomerId || customerDeleteModalClosing) return;
    setCustomerDeleteAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setCustomerDeleteAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [deletingCustomerId, customerDeleteModalClosing]);

  useEffect(() => {
    if (!customerDeleteModalClosing) return;
    const t = setTimeout(() => {
      setDeletingCustomerId(null);
      setCustomerDeleteModalClosing(false);
      setCustomerDeleteAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [customerDeleteModalClosing]);

  const isUkeoi = form.contractType === "請負";

  const customerOptions = (() => {
    const names = new Set(customers.map((c) => c.name));
    const list = [...customers];
    if (editingProject && form.customerName && !names.has(form.customerName)) {
      list.push({ id: "__current__", name: form.customerName });
    }
    return list;
  })();

  const selectedCustomerIdForSave = selectedCustomerId && selectedCustomerId !== "__current__" ? selectedCustomerId : undefined;

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
        customerId: selectedCustomerIdForSave,
        customerName: form.customerName,
        siteName: form.siteName,
        contractType: form.contractType as ContractType,
        contractAmount: isUkeoi ? form.contractAmount ?? 0 : undefined,
        memo: form.memo?.trim() || undefined,
        siteStatus: form.siteStatus as Project["siteStatus"] ?? "組立",
        defaultHolidayWeekdays: projectHolidayWeekdays.length ? projectHolidayWeekdays : undefined,
        siteAddress: form.siteAddress,
        startDate: form.startDate,
        endDate: form.endDate
      };

      const createdProject = await createProject(newProject);

      const selectedGroups = workGroups.filter((wg) => selectedWorkGroupIds.includes(wg.id));
      for (const wg of selectedGroups) {
        try {
          await createWorkLine({
            projectId: createdProject.id,
            name: wg.name,
            color: wg.color || WORK_GROUP_DEFAULT_COLORS[0]
          });
        } catch (error) {
          console.error(`Failed to create work line "${wg.name}":`, error);
          toast.error(`作業班「${wg.name}」の紐づけに失敗しました。`);
        }
      }

      setProjects((prev) => [createdProject, ...prev]);
      toast.success("案件が登録されました。");
      setFormModalClosing(true);
    } catch (error) {
      console.error("Failed to create project:", error);
      setErrors({ 
        submit: "案件の登録に失敗しました。もう一度お試しください。" 
      });
      toast.error("案件の登録に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = async (project: Project) => {
    setEditingProject(project);
    setSelectedCustomerId(project.customerId ?? "");
    await loadWorkGroups();
    setForm({
      title: project.title || "",
      customerName: project.customerName,
      siteName: project.siteName,
      contractType: project.contractType,
      contractAmount: project.contractAmount ?? null,
      siteAddress: project.siteAddress,
      startDate: project.startDate,
      endDate: project.endDate,
      memo: project.memo ?? "",
      siteStatus: project.siteStatus ?? "組立"
    });
    setProjectHolidayWeekdays(project.defaultHolidayWeekdays ?? []);

    try {
      const [lines, wgs] = await Promise.all([getWorkLines(project.id), getWorkGroups()]);
      const wgNames = new Map(wgs.map((wg) => [wg.name, wg.id]));
      const ids = lines.map((wl) => wgNames.get(wl.name)).filter((id): id is string => !!id);
      setSelectedWorkGroupIds([...new Set(ids)]);
    } catch (error) {
      console.error("Failed to load work lines:", error);
      setSelectedWorkGroupIds([]);
    }

    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const handleCopyFromProject = async (projectId: string) => {
    if (!projectId) return;
    const src = projects.find((p) => p.id === projectId);
    if (!src) return;

    // フォーム項目をコピー
    setForm((prev) => ({
      ...prev,
      customerName: src.customerName,
      siteName: src.siteName,
      contractType: src.contractType,
      contractAmount: src.contractAmount ?? null,
      siteAddress: src.siteAddress,
      memo: src.memo ?? "",
      siteStatus: src.siteStatus ?? prev.siteStatus
    }));

    // 取引先IDを可能であれば紐づけ
    const customerMatch = customers.find((c) => c.name === src.customerName);
    setSelectedCustomerId(customerMatch?.id ?? "");

    // 作業班の選択状態をコピー（元案件の work_lines 名から work_groups を引く）
    try {
      const [lines, wgs] = await Promise.all([getWorkLines(src.id), getWorkGroups()]);
      const wgNames = new Map(wgs.map((wg) => [wg.name, wg.id]));
      const ids = lines
        .map((wl) => wgNames.get(wl.name))
        .filter((id): id is string => !!id);
      setSelectedWorkGroupIds([...new Set(ids)]);
    } catch (error) {
      console.error("Failed to copy work groups from project:", error);
      // 失敗してもフォーム自体は使えるようにしておく
    }
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
        customerId: selectedCustomerIdForSave,
        customerName: form.customerName,
        siteName: form.siteName,
        contractType: form.contractType as ContractType,
        contractAmount: isUkeoi ? form.contractAmount ?? 0 : undefined,
        memo: form.memo?.trim() || undefined,
        siteStatus: form.siteStatus as Project["siteStatus"] ?? "組立",
        defaultHolidayWeekdays: projectHolidayWeekdays.length ? projectHolidayWeekdays : undefined,
        siteAddress: form.siteAddress,
        startDate: form.startDate,
        endDate: form.endDate
      };

      const updatedProject = await updateProject(editingProject.id, updateData);
      const currentWorkLines = await getWorkLines(updatedProject.id);
      const wantedNames = new Set(
        workGroups.filter((wg) => selectedWorkGroupIds.includes(wg.id)).map((wg) => wg.name)
      );
      const currentByProjectName = new Map(
        currentWorkLines.map((wl) => [wl.name, wl])
      );

      for (const wg of workGroups) {
        if (!selectedWorkGroupIds.includes(wg.id)) continue;
        const existing = currentByProjectName.get(wg.name);
        if (!existing) {
          try {
            await createWorkLine({
              projectId: updatedProject.id,
              name: wg.name,
              color: wg.color || WORK_GROUP_DEFAULT_COLORS[0]
            });
          } catch (error) {
            console.error(`Failed to create work line "${wg.name}":`, error);
            toast.error(`作業班「${wg.name}」の紐づけに失敗しました。`);
          }
        }
      }
      for (const wl of currentWorkLines) {
        if (!wantedNames.has(wl.name)) {
          try {
            await deleteWorkLine(wl.id);
          } catch (error) {
            console.error(`Failed to delete work line "${wl.name}":`, error);
            toast.error(`作業班「${wl.name}」の削除に失敗しました。`);
          }
        }
      }
      
      setProjects((prev) =>
        prev.map((p) => (p.id === updatedProject.id ? updatedProject : p))
      );
      toast.success("案件が更新されました。");
      setFormModalClosing(true);
    } catch (error) {
      console.error("Failed to update project:", error);
      setErrors({ 
        submit: "案件の更新に失敗しました。もう一度お試しください。" 
      });
      toast.error("案件の更新に失敗しました。");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClick = (projectId: string) => {
    setDeletingProjectId(projectId);
    setDeleteModalClosing(false);
  };

  const closeDeleteModal = () => setDeleteModalClosing(true);

  const handleDeleteConfirm = async () => {
    if (!deletingProjectId) return;

    setIsDeleting(true);
    try {
      await deleteProject(deletingProjectId);
      setProjects((prev) => prev.filter((p) => p.id !== deletingProjectId));
      setDeleteModalClosing(true);
    } catch (error) {
      console.error("Failed to delete project:", error);
      alert("案件の削除に失敗しました。もう一度お試しください。");
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancelEdit = () => {
    setFormModalClosing(true);
  };

  const openNewProjectForm = () => {
    setEditingProject(null);
    setSelectedCustomerId("");
    setShowNewProjectForm(true);
    loadWorkGroups();
    setForm({
      title: "",
      customerName: "",
      siteName: "",
      contractType: "請負",
      contractAmount: null,
      siteAddress: "",
      startDate: "",
      endDate: "",
      memo: "",
      siteStatus: "組立"
    });
    setSelectedWorkGroupIds([]);
    setErrors({});
    setProjectHolidayWeekdays([]);
  };

  const toggleWorkGroupSelection = (id: string) => {
    setSelectedWorkGroupIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const tabs: { id: TabId; label: string }[] = [
    { id: "projects", label: "案件管理" },
    { id: "work_lines", label: "作業班管理" },
    { id: "customers", label: "取引先会社" }
  ];

  return (
    <AuthGuard requireAdmin={true}>
    <div className="h-screen flex flex-col">
      <header className="px-4 md:px-6 py-3 border-b border-theme-border">
        <div className="flex items-center justify-between mb-2">
          <h1 className="text-lg font-semibold text-theme-text">案件管理</h1>
          {activeTab === "projects" && (
            <button
              type="button"
              onClick={openNewProjectForm}
              className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110"
            >
              新案件登録
            </button>
          )}
          {activeTab === "work_lines" && (
            <button
              type="button"
              onClick={openNewWorkGroupModal}
              className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110"
            >
              作業班追加
            </button>
          )}
          {activeTab === "customers" && (
            <button
              type="button"
              onClick={openNewCustomerModal}
              className="inline-flex items-center px-4 py-2 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110"
            >
              取引先追加
            </button>
          )}
        </div>
        <div className="flex gap-1 rounded-lg bg-theme-bg-elevated p-1">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 px-3 py-2 text-xs font-medium rounded-md transition-colors ${
                activeTab === tab.id
                  ? "bg-theme-bg-input text-theme-text shadow-sm"
                  : "text-theme-text-muted hover:text-theme-text"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </header>
      <div className="flex-1 overflow-auto p-3 md:p-4">
        {activeTab === "projects" && (
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
              <p className="text-theme-text-muted text-xs">読み込み中...</p>
            ) : (
              <>
            {projects.map((p) => (
              <div
                key={p.id}
                className="rounded-lg border border-theme-border bg-theme-bg-elevated text-theme-text px-3 py-2"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="font-semibold min-w-0">{p.siteName}</div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                  <span
                    className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                      getProjectStatus(p) === "未施工"
                        ? "bg-sky-500/20 text-sky-400 border border-sky-500/40"
                        : getProjectStatus(p) === "施工中"
                          ? "bg-amber-500/20 text-amber-400 border border-amber-500/40"
                          : "bg-emerald-500/20 text-emerald-400 border border-emerald-500/40"
                    }`}
                    title={`工期: ${p.startDate} ～ ${p.endDate}`}
                  >
                    {getProjectStatus(p)}
                  </span>
                  <span className="text-[10px] text-theme-text-muted whitespace-nowrap">
                    {p.startDate}～{p.endDate}
                  </span>
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => handleEdit(p)}
                        className="px-2 py-1 text-[10px] rounded border border-theme-border bg-theme-bg-elevated hover:bg-theme-bg-elevated-hover text-theme-text-muted-strong"
                        title="編集"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteClick(p.id)}
                        className="px-2 py-1 text-[10px] rounded border border-red-600 bg-theme-bg-elevated hover:bg-red-900/20 text-red-400"
                        title="削除"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                </div>
                <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-[11px] text-theme-text-muted-strong">
                    {p.customerName}
                  </span>
                  <span className="text-[11px] inline-flex items-center px-1.5 py-0.5 rounded bg-theme-bg-elevated">
                    {p.contractType}
                  </span>
                  {p.contractAmount && (
                    <span className="text-[11px] text-theme-text-muted">
                      ¥{p.contractAmount.toLocaleString()}
                    </span>
                  )}
                </div>
                <div className="mt-1 text-[11px] text-theme-text-muted truncate">
                  {p.siteAddress}
                </div>
              </div>
            ))}
            {projects.length === 0 && (
              <p className="text-theme-text-muted text-xs">
                まだ案件が登録されていません。
              </p>
                )}
              </>
            )}
          </div>
        </Card>
        )}

        {activeTab === "work_lines" && (
          <Card title="作業班マスター">
            <div className="space-y-2 text-xs max-h-[calc(100vh-180px)] overflow-auto pr-1">
              {workGroupsLoading ? (
                <p className="text-theme-text-muted text-xs">読み込み中...</p>
              ) : workGroups.length === 0 ? (
                <p className="text-theme-text-muted text-xs">
                  まだ作業班が登録されていません。「作業班追加」から追加してください。案件登録時にプルダウンで選択できます。
                </p>
              ) : (
                workGroups.map((wg) => (
                  <div
                    key={wg.id}
                    className="rounded-lg border border-theme-border bg-theme-bg-input text-theme-text px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1 flex items-center gap-2">
                      <span
                        className="w-4 h-4 rounded-full border border-theme-border shrink-0"
                        style={{ backgroundColor: wg.color ?? "#6b7280" }}
                        title="班の色"
                      />
                      <span className="font-semibold truncate">{wg.name}</span>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditWorkGroupModal(wg)}
                        className="px-2 py-1 text-[10px] rounded border border-theme-border bg-theme-bg-elevated hover:bg-theme-bg-elevated-hover text-theme-text-muted-strong"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleWorkGroupDeleteClick(wg.id)}
                        className="px-2 py-1 text-[10px] rounded border border-red-600 bg-theme-bg-elevated hover:bg-red-900/20 text-red-400"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}

        {activeTab === "customers" && (
          <Card title="取引先会社一覧">
            <div className="space-y-2 text-xs max-h-[calc(100vh-180px)] overflow-auto pr-1">
              {customersLoading ? (
                <p className="text-theme-text-muted text-xs">読み込み中...</p>
              ) : customers.length === 0 ? (
                <p className="text-theme-text-muted text-xs">
                  まだ取引先会社が登録されていません。「取引先追加」から追加してください。
                </p>
              ) : (
                customers.map((c) => (
                  <div
                    key={c.id}
                    className="rounded-lg border border-theme-border bg-theme-bg-input text-theme-text px-3 py-2 flex items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{c.name}</div>
                      {(c.address || c.phone || c.contactPerson) && (
                        <div className="text-[11px] text-theme-text-muted mt-0.5 truncate">
                          {[c.contactPerson, c.phone, c.address].filter(Boolean).join("　・　")}
                        </div>
                      )}
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditCustomerModal(c)}
                        className="px-2 py-1 text-[10px] rounded border border-theme-border bg-theme-bg-elevated hover:bg-theme-bg-elevated-hover text-theme-text-muted-strong"
                      >
                        編集
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCustomerDeleteClick(c.id)}
                        className="px-2 py-1 text-[10px] rounded border border-red-600 bg-theme-bg-elevated hover:bg-red-900/20 text-red-400"
                      >
                        削除
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        )}
      </div>

      {/* 新規登録・編集モーダル（スマホ対応・開閉アニメーション） */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              formModalClosing || !formModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={handleCancelEdit}
          />
          <div
            className={`relative w-full max-w-lg max-h-[100dvh] md:max-h-[90vh] flex flex-col bg-theme-card border border-theme-border rounded-none md:rounded-xl shadow-xl text-theme-text transition-all duration-200 ease-out ${
              formModalClosing || !formModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-theme-border">
              <h2 className="text-base font-semibold">
                {editingProject ? "案件編集" : "新規案件登録"}
              </h2>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated hover:text-theme-text"
                aria-label="閉じる"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-4">
              <form className="space-y-4 text-sm" onSubmit={editingProject ? handleUpdate : handleSubmit}>
                {!editingProject && projects.length > 0 && (
                  <div>
                    <label className="block mb-1">過去案件からコピー（任意）</label>
                    <select
                      className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                      value={copySourceProjectId}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCopySourceProjectId(value);
                        if (value) {
                          handleCopyFromProject(value);
                        }
                      }}
                    >
                      <option value="">選択してください</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.siteName}（{p.customerName}）
                        </option>
                      ))}
                    </select>
                    <p className="mt-1 text-[11px] text-theme-text-muted">
                      以前の工事や同じ現場の案件を選ぶと、取引先・住所・作業班などをコピーして新規案件を作成できます。
                    </p>
                  </div>
                )}
                <div>
                  <label className="block mb-1">取引先会社名（ビジネスパートナー）</label>
                  <input
                    list="project-customer-list"
                    className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                    value={form.customerName}
                    onChange={(e) => {
                      const value = e.target.value;
                      handleChange("customerName", value);
                      const match = customers.find((c) => c.name === value.trim());
                      setSelectedCustomerId(match ? match.id : "");
                    }}
                    placeholder="取引先名を入力 / 選択"
                  />
                  <datalist id="project-customer-list">
                    {customers.map((c) => (
                      <option key={c.id} value={c.name} />
                    ))}
                  </datalist>
                  {errors.customerName && (
                    <p className="mt-1 text-xs text-red-400">{errors.customerName}</p>
                  )}
                  {customers.length === 0 && !editingProject && (
                    <p className="mt-1 text-[11px] text-theme-text-muted">
                      「取引先会社」タブでマスターを追加してください。
                    </p>
                  )}
                </div>
                <div>
                  <label className="block mb-1">現場名</label>
                  <input
                    className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                    value={form.siteName}
                    onChange={(e) => handleChange("siteName", e.target.value)}
                  />
                  {errors.siteName && (
                    <p className="mt-1 text-xs text-red-400">{errors.siteName}</p>
                  )}
                </div>
                <div>
                  <label className="block mb-1">契約形態</label>
                  <select
                    className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                    value={form.contractType}
                    onChange={(e) => handleChange("contractType", e.target.value as ContractType)}
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
                      className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                      value={form.contractAmount ?? ""}
                      onChange={(e) =>
                        handleChange("contractAmount", e.target.value ? Number(e.target.value) : null)
                      }
                    />
                    {errors.contractAmount && (
                      <p className="mt-1 text-xs text-red-400">{errors.contractAmount}</p>
                    )}
                  </div>
                )}
                <div>
                  <label className="block mb-1">現場住所</label>
                  <input
                    className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                    value={form.siteAddress}
                    onChange={(e) => handleChange("siteAddress", e.target.value)}
                  />
                  {errors.siteAddress && (
                    <p className="mt-1 text-xs text-red-400">{errors.siteAddress}</p>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block mb-1">工期開始日</label>
                    <input
                      type="date"
                      className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                      value={form.startDate}
                      onChange={(e) => handleChange("startDate", e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="block mb-1">工期終了日</label>
                    <input
                      type="date"
                      className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                      value={form.endDate}
                      onChange={(e) => handleChange("endDate", e.target.value)}
                    />
                  </div>
                </div>
                <div>
                  <label className="block mb-1">現場ステータス</label>
                  <input
                    list="project-site-status-list"
                    className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                    value={form.siteStatus ?? ""}
                    onChange={(e) => handleChange("siteStatus", e.target.value)}
                    placeholder="例: 組立 / 解体 / 準備中 など自由入力"
                  />
                  <datalist id="project-site-status-list">
                    <option value="組立" />
                    <option value="解体" />
                    <option value="準備中" />
                  </datalist>
                </div>
                <div>
                  <label className="block mb-1">この案件の標準 週休日（曜日）</label>
                  <p className="text-[11px] text-theme-text-muted mb-1">
                    ここで選んだ曜日は、この案件の期間まとめて配置での「休日」の初期値として使われます。
                  </p>
                  <div className="flex gap-1">
                    {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                      <button
                        key={label}
                        type="button"
                        onClick={() =>
                          setProjectHolidayWeekdays((prev) =>
                            prev.includes(i) ? prev.filter((d) => d !== i) : [...prev, i]
                          )
                        }
                        className={`w-8 h-8 rounded-full text-[11px] font-medium border transition-colors ${
                          projectHolidayWeekdays.includes(i)
                            ? "bg-accent border-accent text-white"
                            : "bg-theme-bg-input text-theme-text border-theme-border hover:bg-theme-bg-elevated"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block mb-1">メモ</label>
                  <textarea
                    className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2 min-h-[80px]"
                    value={form.memo ?? ""}
                    onChange={(e) => handleChange("memo", e.target.value)}
                    placeholder="現場の注意事項や共有したい情報を自由に記入できます（任意）"
                  />
                </div>
                <div>
                  <label className="block mb-1">作業班</label>
                  <p className="text-[11px] text-theme-text-muted mb-2">
                    「作業班管理」タブで登録した班から選択します。複数選択できます。
                  </p>
                  <div className="space-y-2 max-h-40 overflow-y-auto rounded-md border border-theme-border bg-theme-bg-input p-2">
                    {workGroups.length === 0 ? (
                      <p className="text-xs text-theme-text-muted">
                        「作業班管理」タブで班を追加してください。
                      </p>
                    ) : (
                      workGroups.map((wg) => (
                        <label
                          key={wg.id}
                          className="flex items-center gap-2 cursor-pointer hover:bg-theme-bg-elevated rounded px-2 py-1.5"
                        >
                          <input
                            type="checkbox"
                            checked={selectedWorkGroupIds.includes(wg.id)}
                            onChange={() => toggleWorkGroupSelection(wg.id)}
                            className="rounded border-theme-border"
                          />
                          <span
                            className="w-3 h-3 rounded-full shrink-0"
                            style={{ backgroundColor: wg.color ?? "#6b7280" }}
                          />
                          <span className="text-sm">{wg.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                </div>
                {errors.submit && (
                  <p className="text-xs text-red-400">{errors.submit}</p>
                )}
                <div className="pt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleCancelEdit}
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2.5 rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text text-sm font-medium hover:bg-theme-bg-elevated-hover disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    キャンセル
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    className="inline-flex items-center px-4 py-2.5 rounded-md bg-accent text-theme-text text-sm font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isSubmitting
                      ? (editingProject ? "更新中..." : "登録中...")
                      : (editingProject ? "更新" : "登録")
                    }
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}

      {/* 作業班マスター 登録・編集モーダル */}
      {showWorkGroupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              workGroupModalClosing || !workGroupModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={closeWorkGroupModal}
          />
          <div
            className={`relative w-full max-w-md max-h-[100dvh] md:max-h-[90vh] flex flex-col bg-theme-card border border-theme-border rounded-none md:rounded-xl shadow-xl text-theme-text transition-all duration-200 ease-out ${
              workGroupModalClosing || !workGroupModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-theme-border">
              <h2 className="text-base font-semibold">
                {editingWorkGroup ? "作業班編集" : "作業班追加"}
              </h2>
              <button type="button" onClick={closeWorkGroupModal} className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated" aria-label="閉じる">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={handleWorkGroupSubmit}>
              <div>
                <label className="block mb-1 text-sm">作業班名</label>
                <input
                  className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                  value={newWorkGroupName}
                  onChange={(e) => setNewWorkGroupName(e.target.value)}
                  placeholder="例: A班、電気班"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">班の色（工程表での表示色）</label>
                <input
                  type="color"
                  className="w-10 h-10 rounded border border-theme-border cursor-pointer bg-theme-bg-elevated p-0.5"
                  value={newWorkGroupColor}
                  onChange={(e) => setNewWorkGroupColor(e.target.value)}
                />
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeWorkGroupModal} disabled={isWorkGroupSubmitting} className="px-4 py-2.5 rounded-md border border-theme-border text-theme-text text-sm hover:bg-theme-bg-elevated disabled:opacity-50">
                  キャンセル
                </button>
                <button type="submit" disabled={isWorkGroupSubmitting} className="px-4 py-2.5 rounded-md bg-accent text-theme-text text-sm hover:brightness-110 disabled:opacity-50">
                  {isWorkGroupSubmitting ? "保存中..." : "保存"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 作業班マスター 削除確認モーダル */}
      {deletingWorkGroupId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${workGroupDeleteModalClosing || !workGroupDeleteAnimatingIn ? "opacity-0" : "opacity-100"}`} aria-label="閉じる" onClick={() => setWorkGroupDeleteModalClosing(true)} />
          <div className={`relative max-w-[400px] w-full rounded-xl bg-theme-bg-input border border-theme-border shadow-lg p-4 text-theme-text transition-all duration-200 ease-out ${workGroupDeleteModalClosing || !workGroupDeleteAnimatingIn ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"}`}>
            <h3 className="text-sm font-semibold mb-2">作業班の削除</h3>
            <p className="text-xs text-theme-text-muted mb-4">
              この作業班を削除してもよろしいですか？この班に紐づく工程表上の作業班行（work_lines）や、その行に割り当てられた人員・ロック情報も合わせて削除されます。
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setWorkGroupDeleteModalClosing(true)} disabled={isWorkGroupDeleting} className="px-4 py-2 rounded-md border border-theme-border text-theme-text text-xs hover:bg-theme-bg-elevated disabled:opacity-50">キャンセル</button>
              <button type="button" onClick={handleWorkGroupDeleteConfirm} disabled={isWorkGroupDeleting} className="px-4 py-2 rounded-md bg-red-600 text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isWorkGroupDeleting ? "削除中..." : "削除"}</button>
            </div>
          </div>
        </div>
      )}

      {/* 取引先会社 登録・編集モーダル */}
      {showCustomerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-0 md:p-4">
          <button type="button" className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${customerModalClosing || !customerModalAnimatingIn ? "opacity-0" : "opacity-100"}`} aria-label="閉じる" onClick={closeCustomerModal} />
          <div className={`relative w-full max-w-md max-h-[100dvh] md:max-h-[90vh] flex flex-col bg-theme-card border border-theme-border rounded-none md:rounded-xl shadow-xl text-theme-text transition-all duration-200 ease-out ${customerModalClosing || !customerModalAnimatingIn ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"}`}>
            <div className="flex items-center justify-between shrink-0 px-4 py-3 border-b border-theme-border">
              <h2 className="text-base font-semibold">{editingCustomer ? "取引先編集" : "取引先追加"}</h2>
              <button type="button" onClick={closeCustomerModal} className="p-2 -mr-2 rounded-md text-theme-text-muted hover:bg-theme-bg-elevated" aria-label="閉じる">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
            <form className="p-4 space-y-4" onSubmit={handleCustomerSubmit}>
              <div>
                <label className="block mb-1 text-sm">取引先会社名</label>
                <input
                  className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                  value={newCustomerName}
                  onChange={(e) => setNewCustomerName(e.target.value)}
                  placeholder="会社名を入力"
                  required
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">住所</label>
                <input
                  className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                  value={newCustomerAddress}
                  onChange={(e) => setNewCustomerAddress(e.target.value)}
                  placeholder="住所を入力"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">電話番号</label>
                <input
                  className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                  type="tel"
                  value={newCustomerPhone}
                  onChange={(e) => setNewCustomerPhone(e.target.value)}
                  placeholder="03-1234-5678"
                />
              </div>
              <div>
                <label className="block mb-1 text-sm">担当者</label>
                <input
                  className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-2"
                  value={newCustomerContactPerson}
                  onChange={(e) => setNewCustomerContactPerson(e.target.value)}
                  placeholder="担当者名を入力"
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-sm">取引先メンバー（ビジネスパートナー担当者）</label>
                  <button type="button" onClick={addCustomerMemberRow} className="text-xs px-2 py-1.5 rounded border border-theme-border bg-theme-bg-elevated hover:bg-theme-bg-elevated-hover text-theme-text-muted-strong">
                    + 追加
                  </button>
                </div>
                <p className="text-[11px] text-theme-text-muted mb-2">
                  案件でこの取引先を選択すると、工程表に担当者名が表示されます。
                </p>
                <div className="space-y-2 max-h-32 overflow-y-auto rounded-md border border-theme-border bg-theme-bg-input p-2">
                  {customerMemberRows.map((row, index) => (
                    <div key={row.id ?? `new-${index}`} className="flex gap-2 items-center">
                      <input
                        type="color"
                        className="w-9 h-9 rounded-md border border-theme-border cursor-pointer bg-theme-bg-input p-0.5 flex-shrink-0"
                        value={row.color || WORK_GROUP_DEFAULT_COLORS[0]}
                        onChange={(e) => updateCustomerMemberRowColor(index, e.target.value)}
                        title="表示色"
                      />
                      <input
                        type="text"
                        className="flex-1 min-w-0 rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-3 py-1.5 text-sm"
                        value={row.name}
                        onChange={(e) => updateCustomerMemberRowName(index, e.target.value)}
                        placeholder="担当者名"
                      />
                      <button type="button" onClick={() => removeCustomerMemberRow(index)} className="px-2 py-1.5 text-xs rounded border border-red-600 bg-theme-bg-elevated hover:bg-red-900/20 text-red-400">
                        削除
                      </button>
                    </div>
                  ))}
                  {customerMemberRows.length === 0 && (
                    <p className="text-xs text-theme-text-muted">「+ 追加」で担当者を追加</p>
                  )}
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={closeCustomerModal} disabled={isCustomerSubmitting} className="px-4 py-2.5 rounded-md border border-theme-border text-theme-text text-sm hover:bg-theme-bg-elevated disabled:opacity-50">キャンセル</button>
                <button type="submit" disabled={isCustomerSubmitting} className="px-4 py-2.5 rounded-md bg-accent text-theme-text text-sm hover:brightness-110 disabled:opacity-50">{isCustomerSubmitting ? "保存中..." : "保存"}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 取引先会社 削除確認モーダル */}
      {deletingCustomerId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${customerDeleteModalClosing || !customerDeleteAnimatingIn ? "opacity-0" : "opacity-100"}`} aria-label="閉じる" onClick={() => setCustomerDeleteModalClosing(true)} />
          <div className={`relative max-w-[400px] w-full rounded-xl bg-theme-bg-input border border-theme-border shadow-lg p-4 text-theme-text transition-all duration-200 ease-out ${customerDeleteModalClosing || !customerDeleteAnimatingIn ? "opacity-0 scale-95 translate-y-2" : "opacity-100 scale-100 translate-y-0"}`}>
            <h3 className="text-sm font-semibold mb-2">取引先会社の削除</h3>
            <p className="text-xs text-theme-text-muted mb-4">この取引先を削除してもよろしいですか？案件の取引先名には影響しません。</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setCustomerDeleteModalClosing(true)} disabled={isCustomerDeleting} className="px-4 py-2 rounded-md border border-theme-border text-theme-text text-xs hover:bg-theme-bg-elevated disabled:opacity-50">キャンセル</button>
              <button type="button" onClick={handleCustomerDeleteConfirm} disabled={isCustomerDeleting} className="px-4 py-2 rounded-md bg-red-600 text-xs font-medium hover:bg-red-700 disabled:opacity-50">{isCustomerDeleting ? "削除中..." : "削除"}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal（開閉アニメーション） */}
      {deletingProjectId && (
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
              <h3 className="text-sm font-semibold mb-2 text-theme-text">案件の削除</h3>
              <p className="text-xs text-theme-text-muted">
                この案件を削除してもよろしいですか？この操作は取り消せません。
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


