"use client";

import { useMemo, useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { addDays, format, parseISO, eachDayOfInterval, getDay, startOfMonth, endOfMonth, startOfWeek, endOfWeek } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import type {
  Assignment,
  WorkLine,
  Member,
  DaySiteStatus
} from "@/domain/schedule/types";
import { createAssignmentsForRange } from "@/domain/schedule/service";
import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import toast from "react-hot-toast";
import { getWorkLines, createWorkLine, deleteWorkLine, getAssignments, createAssignments, deleteAssignments, getMembers } from "@/lib/supabase/schedule";
import { getProjects, updateProject } from "@/lib/supabase/projects";
import { getWorkGroups } from "@/lib/supabase/workGroups";
import { getProjectDefaultMemberIds } from "@/lib/supabase/projectDefaultMembers";
import { getProjectPhasesMap, getPhaseStatusForDate, setProjectPhases } from "@/lib/supabase/projectPhases";
import { getCustomerMembersByCustomerIds } from "@/lib/supabase/customerMembers";
import type { Project } from "@/domain/projects/types";
import type { CustomerMember } from "@/lib/supabase/customerMembers";
import type { WorkGroup } from "@/lib/supabase/workGroups";

// カレンダー上の丸アイコン用の省略名を生成
const getMemberShortName = (name: string): string => {
  // 「林工業(大橋)」のように括弧がある場合は括弧内の先頭1〜2文字を優先
  const parenStart = name.indexOf("（") !== -1 ? name.indexOf("（") : name.indexOf("(");
  const parenEnd = name.indexOf("）") !== -1 ? name.indexOf("）") : name.indexOf(")");

  if (parenStart >= 0 && parenEnd > parenStart) {
    const inner = name.slice(parenStart + 1, parenEnd).trim();
    if (inner.length >= 2) return inner.slice(0, 2);
    if (inner.length === 1) return inner;
  }

  // それ以外は先頭2文字を返す
  return name.slice(0, 2);
};

/** 丸の下に表示する名前（約4文字） */
const getMemberNameLabel = (name: string, maxLen: number = 4): string => {
  if (!name) return "";
  const trimmed = name.trim();
  return trimmed.length <= maxLen ? trimmed : trimmed.slice(0, maxLen);
};

/** メンバーIDから一貫した色を取得（色分け表示用） */
const MEMBER_COLORS = [
  "#3b82f6", "#f97316", "#22c55e", "#eab308", "#a855f7",
  "#ef4444", "#06b6d4", "#ec4899", "#84cc16", "#6366f1",
  "#14b8a6", "#f43f5e", "#8b5cf6", "#0ea5e9", "#22d3ee"
];

function getMemberColor(memberId: string, members: Member[]): string {
  const idx = members.findIndex((m) => m.id === memberId);
  const member = idx >= 0 ? members[idx] : undefined;
  if (member?.color) return member.color;
  if (idx >= 0) return MEMBER_COLORS[idx % MEMBER_COLORS.length];
  return MEMBER_COLORS[0];
}

/** 工程ステータス（組立・解体など）の色分け */
const PHASE_STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  組立: { bg: "bg-blue-500/20", border: "border-blue-500/60", text: "text-blue-200" },
  解体: { bg: "bg-red-500/20", border: "border-red-500/60", text: "text-red-200" },
  商用: { bg: "bg-amber-500/20", border: "border-amber-500/60", text: "text-amber-200" },
  準備中: { bg: "bg-amber-500/20", border: "border-amber-500/60", text: "text-amber-200" },
  搬入: { bg: "bg-orange-500/20", border: "border-orange-500/60", text: "text-orange-200" },
  養生: { bg: "bg-lime-500/20", border: "border-lime-500/60", text: "text-lime-200" },
  その他: { bg: "bg-slate-500/20", border: "border-slate-500/60", text: "text-slate-300" },
};

/** 工程が割り当てられていない日付のスタイル（案件期間内だが工程未設定の日） */
const UNASSIGNED_DAY_STYLE = { bg: "bg-theme-bg-elevated", border: "border-dashed border-theme-border", text: "text-theme-text-muted" };

/** モーダル用：工程オプション・日付マップ変換（新規案件登録と同様のカレンダー編集用） */
const MOVE_MODAL_PHASE_OPTIONS = ["組立", "解体", "準備中", "搬入", "養生", "その他"] as const;
const MOVE_MODAL_PHASE_COLORS: Record<string, string> = {
  "組立": "#22c55e", "解体": "#ef4444", "準備中": "#3b82f6", "搬入": "#f97316", "養生": "#eab308", "その他": "#a855f7"
};
const MOVE_MODAL_CUSTOM_PHASE_COLORS = ["#ec4899", "#8b5cf6", "#06b6d4", "#14b8a6", "#84cc16", "#f59e0b"];
function moveModalGetPhaseColor(phaseName: string): string {
  if (MOVE_MODAL_PHASE_COLORS[phaseName]) return MOVE_MODAL_PHASE_COLORS[phaseName];
  let hash = 0;
  for (let i = 0; i < phaseName.length; i++) hash = ((hash << 5) - hash + phaseName.charCodeAt(i)) & 0x7fffffff;
  return MOVE_MODAL_CUSTOM_PHASE_COLORS[hash % MOVE_MODAL_CUSTOM_PHASE_COLORS.length];
}
type PhaseRange = { startDate: string; endDate: string; siteStatus: string };
function phasesToDateMap(phases: PhaseRange[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const p of phases) {
    const start = parseISO(p.startDate);
    const end = parseISO(p.endDate);
    const days = eachDayOfInterval({ start, end });
    for (const d of days) map[format(d, "yyyy-MM-dd")] = p.siteStatus;
  }
  return map;
}
function dateMapToPhases(dateToPhase: Record<string, string>): PhaseRange[] {
  const byPhase = new Map<string, string[]>();
  for (const [date, status] of Object.entries(dateToPhase)) {
    if (!status) continue;
    if (!byPhase.has(status)) byPhase.set(status, []);
    byPhase.get(status)!.push(date);
  }
  const result: PhaseRange[] = [];
  for (const [siteStatus, dates] of byPhase.entries()) {
    const sorted = [...dates].sort();
    let i = 0;
    while (i < sorted.length) {
      const startDate = sorted[i];
      let endDate = startDate;
      while (i + 1 < sorted.length && format(addDays(parseISO(sorted[i]), 1), "yyyy-MM-dd") === sorted[i + 1]) {
        i++;
        endDate = sorted[i];
      }
      result.push({ startDate, endDate, siteStatus });
      i++;
    }
  }
  result.sort((a, b) => a.startDate.localeCompare(b.startDate));
  return result;
}

function getPhaseStatusStyle(status: string) {
  return PHASE_STATUS_COLORS[status] ?? PHASE_STATUS_COLORS["その他"];
}

// 作業班名の省略表示用（スマートフォン向け）
const getWorkLineShortName = (name: string): string => {
  if (!name) return "";
  // 「土木第1班」→「土木第」「電気A」→「電気A」など、先頭2文字を使用
  return name.slice(0, 2);
};

const MOBILE_BREAKPOINT = 768;
const WORK_LINE_ORDER_KEY = "schedule-work-line-order";

function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const update = () => {
      // 768px 以下をスマートフォンレイアウトとして扱う
      setIsMobile(window.innerWidth <= MOBILE_BREAKPOINT);
    };

    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, []);

  return isMobile;
}

// mockLinesは削除し、データベースから取得する

const DAYS_VISIBLE_IN_VIEWPORT = 7; // 画面に表示する日数（通常）
const ROWS_VISIBLE_IN_VIEWPORT = 4; // 1画面に表示する作業班の行数（通常）
const ROW_HEIGHT_PX = 110; // 1行の高さ（px）
const TABLE_HEADER_HEIGHT_PX = 48;
const TABLE_FOOTER_HEIGHT_PX = 44;
/** 工程表スクロール領域の高さ（ヘッダー + 4行 + フッター） */
const SCHEDULE_SCROLL_HEIGHT_PX =
  TABLE_HEADER_HEIGHT_PX + ROWS_VISIBLE_IN_VIEWPORT * ROW_HEIGHT_PX + TABLE_FOOTER_HEIGHT_PX;

// 仮のユーザー権限（本番ではログイン情報から取得する想定）
const CURRENT_USER_ROLE: "admin" | "viewer" = "admin";

interface SelectionState {
  workLineId: string;
  date: string;
}

function SchedulePageInner({ embedded }: { embedded: boolean }) {
  const [baseDate] = useState(new Date());
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [selection, setSelection] = useState<SelectionState | null>(null);
  const [selectedMemberIds, setSelectedMemberIds] = useState<string[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    // 現在の日付から、その週の月曜日を取得
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });
  const [selectedWorkLineId, setSelectedWorkLineId] = useState<string>("");
  const [filteredWorkLineId, setFilteredWorkLineId] = useState<string>(""); // テーブル表示用のフィルター
  const [rangeStartDate, setRangeStartDate] = useState<string>(""); // 期間まとめて配置用の開始日
  const [rangeEndDate, setRangeEndDate] = useState<string>(""); // 期間まとめて配置用の終了日
  const [holidayWeekdays, setHolidayWeekdays] = useState<number[]>([]);
  const [selectionHolidayWeekdays, setSelectionHolidayWeekdays] = useState<number[]>([]);
  const [dayStatuses, setDayStatuses] = useState<DaySiteStatus[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [modalWorkLineId, setModalWorkLineId] = useState<string>("");
  const [modalRangeStart, setModalRangeStart] = useState<string>("");
  const [modalRangeEnd, setModalRangeEnd] = useState<string>("");
  const [modalMemberIds, setModalMemberIds] = useState<string[]>([]);
  const [modalHolidayWeekdays, setModalHolidayWeekdays] = useState<number[]>([]);
  const [selectionMemberSearch, setSelectionMemberSearch] = useState("");
  const [bulkMemberSearch, setBulkMemberSearch] = useState("");
  const [workLines, setWorkLines] = useState<WorkLine[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [customerMembers, setCustomerMembers] = useState<CustomerMember[]>([]);
  const [projectPhasesMap, setProjectPhasesMap] = useState<Map<string, { startDate: string; endDate: string; siteStatus: string }[]>>(new Map());
  const [workGroups, setWorkGroups] = useState<WorkGroup[]>([]);
  const [workLineOrder, setWorkLineOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const s = localStorage.getItem(WORK_LINE_ORDER_KEY);
      if (!s) return [];
      const parsed = JSON.parse(s) as unknown;
      return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === "string") : [];
    } catch {
      return [];
    }
  });
  const [draggedWorkLineId, setDraggedWorkLineId] = useState<string | null>(null);
  const [dragOverWorkLineId, setDragOverWorkLineId] = useState<string | null>(null);
  const [dragProject, setDragProject] = useState<{ projectId: string; workLineId: string } | null>(null);
  /** ドロップ後の「班変更／未配置に戻す」＋ 任意で工期・工程変更するモーダル用 */
  const [moveDropPending, setMoveDropPending] = useState<{
    project: Project;
    fromWorkLineId: string;
    toLine: MergedWorkLine | "unassigned";
  } | null>(null);
  const [moveModalForm, setMoveModalForm] = useState<{
    startDate: string;
    endDate: string;
    phases: { startDate: string; endDate: string; siteStatus: string }[];
  } | null>(null);
  /** 以前の作業班での割当（モーダル表示用・取得は useEffect） */
  const [moveModalAssignments, setMoveModalAssignments] = useState<Assignment[]>([]);
  /** 工程と日付をカレンダークリックで編集するための「日付→工程」マップ（新規案件登録と同様） */
  const [moveModalDateToPhase, setMoveModalDateToPhase] = useState<Record<string, string>>({});
  const [moveModalSelectedPhase, setMoveModalSelectedPhase] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const { isAdmin, signOut, profile } = useAuth();
  const isMobile = useIsMobile();
  const [showMemberPickerMobile, setShowMemberPickerMobile] = useState(false);
  const [showModalMemberPickerMobile, setShowModalMemberPickerMobile] = useState(false);
  const [bulkCardExpandedMobile, setBulkCardExpandedMobile] = useState(false);
  const [projectModalClosing, setProjectModalClosing] = useState(false);
  const [projectModalAnimatingIn, setProjectModalAnimatingIn] = useState(false);
  const [selectionModalClosing, setSelectionModalClosing] = useState(false);
  const [selectionModalAnimatingIn, setSelectionModalAnimatingIn] = useState(false);
  const [bulkAssignModalClosing, setBulkAssignModalClosing] = useState(false);
  const [bulkAssignModalAnimatingIn, setBulkAssignModalAnimatingIn] = useState(false);
  const [monthEndVerifyMode, setMonthEndVerifyMode] = useState(false);

  // 案件詳細モーダル: 開閉アニメーション
  useEffect(() => {
    if (!showProjectModal || !selectedProject || projectModalClosing) return;
    setProjectModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setProjectModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showProjectModal, selectedProject, projectModalClosing]);
  useEffect(() => {
    if (!projectModalClosing) return;
    const t = setTimeout(() => {
      setShowProjectModal(false);
      setSelectedProject(null);
      setProjectModalClosing(false);
      setProjectModalAnimatingIn(false);
    }, 220);
    return () => clearTimeout(t);
  }, [projectModalClosing]);

  // 人員選択モーダル: 開閉アニメーション
  useEffect(() => {
    if (!selection || selectionModalClosing) return;
    setSelectionModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setSelectionModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [selection, selectionModalClosing]);
  useEffect(() => {
    if (!selectionModalClosing) return;
    const t = setTimeout(() => {
      setSelection(null);
      setSelectionModalClosing(false);
      setSelectionModalAnimatingIn(false);
      setSelectionMemberSearch("");
    }, 220);
    return () => clearTimeout(t);
  }, [selectionModalClosing]);

  // 期間まとめて配置モーダル: 開閉アニメーション
  useEffect(() => {
    if (!showBulkAssignModal || bulkAssignModalClosing) return;
    setBulkAssignModalAnimatingIn(false);
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => setBulkAssignModalAnimatingIn(true));
    });
    return () => cancelAnimationFrame(id);
  }, [showBulkAssignModal, bulkAssignModalClosing]);
  useEffect(() => {
    if (!bulkAssignModalClosing) return;
    const t = setTimeout(() => {
      setShowBulkAssignModal(false);
      setBulkAssignModalClosing(false);
      setBulkAssignModalAnimatingIn(false);
      setBulkMemberSearch("");
    }, 220);
    return () => clearTimeout(t);
  }, [bulkAssignModalClosing]);

  // Load work lines, projects, members, and customer members (BP) from database
  const loadData = async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    try {
      if (!silent) setIsLoadingData(true);
      const [lines, projs, membersData, wgs] = await Promise.all([
        getWorkLines(),
        getProjects(),
        getMembers(),
        getWorkGroups()
      ]);
      setWorkGroups(wgs);
      // 同一案件・同一作業班名の重複を解消（project_id + name でユニークに）
      const seen = new Set<string>();
      const dedupedLines = lines.filter((line) => {
        const key = `${line.projectId || "__none__"}-${line.name}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      setWorkLines(dedupedLines);
      setProjects(projs);
      setMembers(membersData);
      const customerIds = [...new Set(projs.map((p) => p.customerId).filter((id): id is string => !!id))];
      const bpMembers = customerIds.length > 0 ? await getCustomerMembersByCustomerIds(customerIds) : [];
      setCustomerMembers(bpMembers);
      const phasesMap = await getProjectPhasesMap(projs.map((p) => p.id));
      setProjectPhasesMap(phasesMap);
    } catch (error) {
      console.error("Failed to load data:", error);
      if (!silent) toast.error("データの読み込みに失敗しました。");
    } finally {
      if (!silent) setIsLoadingData(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // 案件管理で休日などを変更した後、タブに戻った際に案件・工程情報を再取得して同期（バックグラウンド更新）
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        loadData({ silent: true });
      }
    };
    const handleFocus = () => loadData({ silent: true });
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleFocus);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  // Load assignments when week changes or on initial load
  useEffect(() => {
    const loadAssignmentsForWeek = async () => {
      try {
        const weekStart = format(currentWeekStart, "yyyy-MM-dd");
        const weekEnd = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
        // Load all assignments and filter for current week
        const allAssignments = await getAssignments();
        const weekAssignments = allAssignments.filter(
          (a) => a.date >= weekStart && a.date <= weekEnd
        );
        // Update assignments state with current week's data
        setAssignments((prev) => {
          // Keep assignments outside current week, replace assignments within current week
          const outsideWeek = prev.filter(
            (a) => a.date < weekStart || a.date > weekEnd
          );
          return [...outsideWeek, ...weekAssignments];
        });
      } catch (error) {
        console.error("Failed to load assignments for week:", error);
        toast.error("割り当てデータの読み込みに失敗しました。");
      }
    };
    if (!isLoadingData && workLines.length > 0) {
      loadAssignmentsForWeek();
    }
  }, [currentWeekStart, isLoadingData, workLines.length]);

  // 班変更モーダル表示時：以前の作業班の割当を取得
  useEffect(() => {
    if (!moveDropPending) {
      setMoveModalAssignments([]);
      return;
    }
    let cancelled = false;
    getAssignments(moveDropPending.fromWorkLineId)
      .then((list) => {
        if (!cancelled) setMoveModalAssignments(list);
      })
      .catch(() => {
        if (!cancelled) setMoveModalAssignments([]);
      });
    return () => { cancelled = true; };
  }, [moveDropPending?.fromWorkLineId ?? null]);

  // 作業班名で統合（同一名は1行に集約）
  interface MergedWorkLine {
    id: string;
    name: string;
    color?: string;
    workLineIds: string[];
  }
  const mergedWorkLinesRaw = useMemo((): MergedWorkLine[] => {
    const byName = new Map<string, { name: string; color?: string; ids: string[] }>();
    for (const wl of workLines) {
      const cur = byName.get(wl.name);
      if (!cur) {
        byName.set(wl.name, { name: wl.name, color: wl.color, ids: [wl.id] });
      } else {
        cur.ids.push(wl.id);
      }
    }
    return Array.from(byName.entries()).map(([name, v]) => ({
      id: name,
      name,
      color: v.color,
      workLineIds: v.ids
    }));
  }, [workLines]);

  const mergedWorkLines = useMemo(() => {
    if (workLineOrder.length === 0) return mergedWorkLinesRaw;
    const orderMap = new Map(workLineOrder.map((id, i) => [id, i]));
    return [...mergedWorkLinesRaw].sort((a, b) => {
      const ia = orderMap.get(a.id) ?? 9999;
      const ib = orderMap.get(b.id) ?? 9999;
      if (ia !== ib) return ia - ib;
      return a.name.localeCompare(b.name);
    });
  }, [mergedWorkLinesRaw, workLineOrder]);

  const moveWorkLineOrder = (draggedId: string, targetId: string) => {
    const currentOrder = mergedWorkLines.map((l) => l.id);
    const dragIdx = currentOrder.indexOf(draggedId);
    const targetIdx = currentOrder.indexOf(targetId);
    if (dragIdx === -1 || targetIdx === -1 || dragIdx === targetIdx) return;
    const next = [...currentOrder];
    next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, draggedId);
    setWorkLineOrder(next);
    try {
      localStorage.setItem(WORK_LINE_ORDER_KEY, JSON.stringify(next));
    } catch {
      // ignore
    }
  };

  // 表示するワークグループをフィルタリング
  const displayedLines = useMemo(() => {
    if (!filteredWorkLineId) return mergedWorkLines;
    return mergedWorkLines.filter((line) => line.id === filteredWorkLineId);
  }, [filteredWorkLineId, mergedWorkLines]);

  // 作業班が未割り当ての案件（未配置欄に表示）
  const unassignedProjects = useMemo(() => {
    const assignedProjectIds = new Set(workLines.map((w) => w.projectId).filter(Boolean));
    return projects.filter((p) => !assignedProjectIds.has(p.id));
  }, [projects, workLines]);

  const assignProjectToWorkGroup = async (projectId: string, wg: WorkGroup) => {
    try {
      await createWorkLine({
        projectId,
        name: wg.name,
        color: wg.color ?? "#6b7280"
      });
      toast.success("班を割り当てました。");
      loadData({ silent: true });
    } catch (err) {
      console.error(err);
      toast.error("班の割り当てに失敗しました。");
    }
  };

  /** 物件を別の班に移動（ドロップ時）：以前のワークグループから削除してから、新しいワークグループに割り当て */
  const moveProjectToLine = async (
    projectId: string,
    fromWorkLineId: string,
    targetLine: MergedWorkLine
  ) => {
    try {
      await deleteWorkLine(fromWorkLineId);
      await createWorkLine({
        projectId,
        name: targetLine.name,
        color: targetLine.color ?? "#6b7280"
      });
      toast.success("班を変更しました。");
      loadData({ silent: true });
    } catch (err) {
      console.error(err);
      toast.error("班の変更に失敗しました。");
    }
  };

  /** 物件を未配置に戻す（ドロップ時） */
  const unassignProjectFromLine = async (workLineId: string) => {
    try {
      await deleteWorkLine(workLineId);
      toast.success("未配置に戻しました。");
      loadData({ silent: true });
    } catch (err) {
      console.error(err);
      toast.error("解除に失敗しました。");
    }
  };

  /** ドロップ確定モーダルで「このまま実行」または 工期・工程変更後に実行 */
  const executeMoveDrop = async (opts?: { updateDates?: boolean; updatePhases?: boolean }) => {
    if (!moveDropPending || !moveModalForm) return;
    const { project, fromWorkLineId, toLine } = moveDropPending;
    try {
      if (opts?.updateDates) {
        await updateProject(project.id, {
          startDate: moveModalForm.startDate,
          endDate: moveModalForm.endDate
        });
      }
      if (opts?.updatePhases) {
        const phasesFromCalendar = dateMapToPhases(moveModalDateToPhase);
        if (phasesFromCalendar.length > 0) {
          await setProjectPhases(project.id, phasesFromCalendar);
        }
      }
      if (toLine === "unassigned") {
        await deleteWorkLine(fromWorkLineId);
        toast.success("未配置に戻しました。");
      } else {
        await deleteWorkLine(fromWorkLineId);
        await createWorkLine({
          projectId: project.id,
          name: toLine.name,
          color: toLine.color ?? "#6b7280"
        });
        toast.success("班を変更しました。");
      }
      setMoveDropPending(null);
      setMoveModalForm(null);
      setMoveModalAssignments([]);
      setMoveModalDateToPhase({});
      setMoveModalSelectedPhase("");
      loadData({ silent: true });
    } catch (err) {
      console.error(err);
      toast.error(opts?.updateDates || opts?.updatePhases ? "保存に失敗しました。" : toLine === "unassigned" ? "解除に失敗しました。" : "班の変更に失敗しました。");
    }
  };

  // 統合行・日付に対する有効な work_line_id（その日の案件に紐づくものを優先）
  const getActiveWorkLineId = (merged: MergedWorkLine, date: string): string => {
    for (const wlId of merged.workLineIds) {
      const wl = workLines.find((w) => w.id === wlId);
      if (!wl?.projectId) continue;
      const project = projects.find((p) => p.id === wl.projectId);
      if (!project) continue;
      if (date >= project.startDate && date <= project.endDate) return wlId;
    }
    return merged.workLineIds[0] ?? "";
  };

  // 統合行・日付に対する案件（1件目のみ・後方互換）
  const getProjectForMergedCell = (merged: MergedWorkLine, date: string): Project | null => {
    const wlId = getActiveWorkLineId(merged, date);
    return getProjectForWorkLine(wlId, date);
  };

  // 統合行・日付に対する全案件（かぶり時は複数。2列表示用）
  const getCellProjectEntries = (merged: MergedWorkLine, date: string): { workLineId: string; project: Project }[] => {
    const entries: { workLineId: string; project: Project }[] = [];
    for (const wlId of merged.workLineIds) {
      const project = getProjectForWorkLine(wlId, date);
      if (project) entries.push({ workLineId: wlId, project });
    }
    return entries;
  };

  // 案件に紐づく取引先（ビジネスパートナー）メンバーを取得
  const getBPMembersForProject = (project: Project | null): CustomerMember[] => {
    if (!project?.customerId) return [];
    return customerMembers.filter((m) => m.customerId === project.customerId);
  };

  // 統合セルの割り当て（複数 work_line を集約）
  const getCellAssignmentsForMerged = (merged: MergedWorkLine, iso: string) =>
    assignments.filter(
      (a) => merged.workLineIds.includes(a.workLineId) && a.date === iso && !a.isHoliday
    );

  // 統合セルのロック状態（いずれかがロックならロック）
  const isCellLockedForMerged = (merged: MergedWorkLine, iso: string) =>
    merged.workLineIds.some((id) => isCellLocked(id, iso));

  // セルの日付に対する工程ステータス（組立・解体など）を取得
  const getPhaseStatusForCell = (workLineId: string, date: string): string | null => {
    const project = getProjectForWorkLine(workLineId, date);
    if (!project) return null;
    const phases = projectPhasesMap.get(project.id);
    if (phases && phases.length > 0) {
      return getPhaseStatusForDate(phases, date);
    }
    return project.siteStatus ?? null;
  };

  // ワークグループに関連する案件を取得する関数
  const getProjectForWorkLine = (workLineId: string, date: string): Project | null => {
    const workLine = workLines.find(wl => wl.id === workLineId);
    if (!workLine || !workLine.projectId) return null;
    
    const project = projects.find(p => p.id === workLine.projectId);
    if (!project) return null;
    
    // 日付が案件の期間内かチェック
    if (date >= project.startDate && date <= project.endDate) {
      return project;
    }
    
    return null;
  };

  const goToNextWeek = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection('left'); // 次の週 = 左にスライドアウト（新しいコンテンツが右から入る）
    
    // アニメーション開始（フェードアウト + スライドアウト）
    setTimeout(() => {
      // データを更新
      setCurrentWeekStart(prev => addDays(prev, 7));
      // アニメーション終了（フェードイン + スライドイン）
      requestAnimationFrame(() => {
        setTimeout(() => {
          setSlideDirection(null);
          setIsAnimating(false);
        }, 10);
      });
    }, 300);
  };

  const goToPrevWeek = () => {
    if (isAnimating) return;
    setIsAnimating(true);
    setSlideDirection('right'); // 前の週 = 右にスライドアウト（新しいコンテンツが左から入る）
    
    // アニメーション開始（フェードアウト + スライドアウト）
    setTimeout(() => {
      // データを更新
      setCurrentWeekStart(prev => addDays(prev, -7));
      // アニメーション終了（フェードイン + スライドイン）
      requestAnimationFrame(() => {
        setTimeout(() => {
          setSlideDirection(null);
          setIsAnimating(false);
        }, 10);
      });
    }, 300);
  };

  const goToToday = () => {
    if (isAnimating) return;
    const today = new Date();
    const dayOfWeek = today.getDay();
    const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    
    // 現在の週と比較して方向を決定
    const currentMonday = new Date(currentWeekStart);
    currentMonday.setHours(0, 0, 0, 0);
    const targetMonday = new Date(monday);
    targetMonday.setHours(0, 0, 0, 0);
    
    if (targetMonday.getTime() === currentMonday.getTime()) {
      // 既に今週を表示している場合はアニメーション不要
      return;
    }
    
    setIsAnimating(true);
    if (targetMonday > currentMonday) {
      setSlideDirection('left');
    } else {
      setSlideDirection('right');
    }
    
    setTimeout(() => {
      setCurrentWeekStart(monday);
      requestAnimationFrame(() => {
        setTimeout(() => {
          setSlideDirection(null);
          setIsAnimating(false);
        }, 10);
      });
    }, 300);
  };


  // 表示する日付の配列
  // - 通常: 7日分（1週間）
  // - embedded（ダッシュボードのモーダル）: 当日のみ
  const days = useMemo(() => {
    if (embedded) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return [
        {
          date: today,
          iso: format(today, "yyyy-MM-dd"),
        },
      ];
    }

    return Array.from({ length: DAYS_VISIBLE_IN_VIEWPORT }, (_, i) => {
      const d = addDays(currentWeekStart, i);
      return {
        date: d,
        iso: format(d, "yyyy-MM-dd"),
      };
    });
  }, [currentWeekStart, embedded]);

  /** 日付が今日より前（過去）なら true（過去日は自動ロック対象） */
  const isPastDate = (iso: string) => iso < format(new Date(), "yyyy-MM-dd");

  /** 月末確認モード時は過去・ロック済みも編集可 */
  const isCellLocked = (workLineId: string, iso: string) => {
    if (monthEndVerifyMode && isAdmin) return false;
    return (
      isPastDate(iso) ||
      dayStatuses.some(
        (s) => s.workLineId === workLineId && s.date === iso && s.isLocked
      )
    );
  };

  const toggleLock = (workLineId: string, iso: string) => {
    if (isPastDate(iso) && !monthEndVerifyMode) return;
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    setDayStatuses((prev) => {
      const exists = prev.find(
        (s) => s.workLineId === workLineId && s.date === iso
      );

      // 既にロックされていれば解除、なければロックを追加
      if (exists?.isLocked) {
        return prev.filter(
          (s) => !(s.workLineId === workLineId && s.date === iso)
        );
      }

      const filtered = prev.filter(
        (s) => !(s.workLineId === workLineId && s.date === iso)
      );

      const newStatus: DaySiteStatus = {
        id: `${workLineId}_${iso}`,
        workLineId,
        date: iso,
        isLocked: true
      };

      return [...filtered, newStatus];
    });
  };

  const openSelection = async (workLineId: string, iso: string) => {
    if (isCellLocked(workLineId, iso)) return;
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    // 案件の標準週休日に該当するセルの場合は、割り当てをブロックして通知
    const project = getProjectForWorkLine(workLineId, iso);
    if (project?.defaultHolidayWeekdays && project.defaultHolidayWeekdays.length > 0) {
      const weekday = new Date(iso).getDay();
      if (project.defaultHolidayWeekdays.includes(weekday)) {
        toast.error('この日はこの案件の週休日として設定されています。休日には人員を配置できません。');
        return;
      }
    }
    setSelectionModalClosing(false);
    setSelection({ workLineId, date: iso });
    const current = assignments.filter(
      (a) => a.workLineId === workLineId && a.date === iso && !a.isHoliday
    );
    if (current.length > 0) {
      setSelectedMemberIds(current.map((c) => c.memberId));
    } else if (project?.id) {
      try {
        const defaultIds = await getProjectDefaultMemberIds(project.id);
        setSelectedMemberIds(defaultIds);
      } catch {
        setSelectedMemberIds([]);
      }
    } else {
      setSelectedMemberIds([]);
    }
    // 対象案件の標準週休日を初期選択として反映
    setSelectionHolidayWeekdays(project?.defaultHolidayWeekdays ?? []);
  };

  const toggleMember = (memberId: string) => {
    setSelectedMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const applySelection = async () => {
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    if (!selection) return;
    const { workLineId, date } = selection;
    const selectedDate = new Date(date);
    const weekday = selectedDate.getDay();
    const isHoliday = selectionHolidayWeekdays.includes(weekday);
    
    // Validate member IDs exist in database
    if (selectedMemberIds.length > 0) {
      const invalidMemberIds = selectedMemberIds.filter(
        (memberId) => !members.some((m) => m.id === memberId)
      );
      if (invalidMemberIds.length > 0) {
        toast.error(`無効なメンバーIDが含まれています: ${invalidMemberIds.join(', ')}`);
        return;
      }
    }
    
    try {
      // Delete existing assignments for this workLineId and date
      await deleteAssignments(workLineId, date);
      
      // Create new assignments
      if (selectedMemberIds.length > 0) {
        const newAssignments: Omit<Assignment, 'id'>[] = selectedMemberIds.map((memberId) => ({
          workLineId,
          date,
          memberId,
          isHoliday,
          isConfirmed: false
        }));
        const created = await createAssignments(newAssignments);
        
        // Update local state
        setAssignments((prev) => {
          const filtered = prev.filter(
            (a) => !(a.workLineId === workLineId && a.date === date)
          );
          return [...filtered, ...created];
        });
      } else {
        // If no members selected, just remove from local state
        setAssignments((prev) => prev.filter(
          (a) => !(a.workLineId === workLineId && a.date === date)
        ));
      }
      
      toast.success("メンバーの割り当てを保存しました。");
      setSelectionModalClosing(true);
    } catch (error: any) {
      console.error("Failed to save assignments:", error);
      const errorMessage = error?.message || error?.details || "メンバーの割り当ての保存に失敗しました。";
      toast.error(`エラー: ${errorMessage}`);
    }
  };

  const handleBulkAssign = async (
    workLineIdOrMergedId?: string,
    startDate?: string,
    endDate?: string,
    memberIds?: string[],
    holidayWeekdaysParam?: number[]
  ) => {
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    const finalId = workLineIdOrMergedId ?? selectedWorkLineId;
    const finalStartDate = startDate ?? modalRangeStart;
    const finalEndDate = endDate ?? modalRangeEnd;
    const finalMemberIds = memberIds ?? selectedMemberIds;
    const finalHolidayWeekdays = holidayWeekdaysParam ?? holidayWeekdays;

    if (
      !finalStartDate ||
      !finalEndDate ||
      finalMemberIds.length === 0 ||
      !finalId
    )
      return;
    
    const invalidMemberIds = finalMemberIds.filter(
      (memberId) => !members.some((m) => m.id === memberId)
    );
    if (invalidMemberIds.length > 0) {
      toast.error(`無効なメンバーIDが含まれています: ${invalidMemberIds.join(', ')}`);
      return;
    }
    
    const merged = mergedWorkLines.find((m) => m.id === finalId);
    
    try {
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      const days: string[] = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(format(d, "yyyy-MM-dd"));
      }
      
      for (const day of days) {
        const idsToDelete = merged ? merged.workLineIds : [finalId];
        for (const wlId of idsToDelete) {
          await deleteAssignments(wlId, day);
        }
      }
      
      const byWorkLine = new Map<string, string[]>();
      for (const day of days) {
        const wlId = merged ? getActiveWorkLineId(merged, day) : finalId;
        const arr = byWorkLine.get(wlId) ?? [];
        arr.push(day);
        byWorkLine.set(wlId, arr);
      }
      
      const allCreated: Assignment[] = [];
      for (const [wlId, wlDays] of byWorkLine) {
        if (wlDays.length === 0) continue;
        const wlStart = wlDays[0]!;
        const wlEnd = wlDays[wlDays.length - 1]!;
        const toCreate = createAssignmentsForRange({
          workLineId: wlId,
          memberIds: finalMemberIds,
          startDate: wlStart,
          endDate: wlEnd,
          holidayWeekdays: finalHolidayWeekdays
        });
        const created = await createAssignments(toCreate);
        allCreated.push(...created);
      }
      
      setAssignments((prev) => {
        const keys = new Set(allCreated.map((c) => `${c.workLineId}-${c.date}`));
        const filtered = prev.filter(
          (a) => !keys.has(`${a.workLineId}-${a.date}`)
        );
        return [...filtered, ...allCreated];
      });
      
      toast.success("期間のメンバー割り当てを保存しました。");
    } catch (error: any) {
      console.error("Failed to save bulk assignments:", error);
      const errorMessage = error?.message || error?.details || "期間のメンバー割り当ての保存に失敗しました。";
      toast.error(`エラー: ${errorMessage}`);
    }
  };

  const openBulkAssignModal = async () => {
    setBulkAssignModalClosing(false);
    setShowBulkAssignModal(true);
    // モーダルを開くときに現在の値を初期値として設定
    setModalWorkLineId(selectedWorkLineId);
    // カードで選択した開始日・終了日があればそれを使用、なければ現在表示している週の開始日と終了日を初期値として設定
    const weekStart = rangeStartDate || format(currentWeekStart, "yyyy-MM-dd");
    const weekEnd = rangeEndDate || format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
    setModalRangeStart(weekStart);
    setModalRangeEnd(weekEnd);
    setModalHolidayWeekdays([...holidayWeekdays]);
    // 選択された作業班の案件の既定メンバーを初期選択として設定
    let initialMemberIds = selectedMemberIds;
    const merged = mergedWorkLines.find((m) => m.id === selectedWorkLineId);
    const wl = merged
      ? workLines.find((l) => merged.workLineIds.includes(l.id))
      : workLines.find((l) => l.id === selectedWorkLineId);
    if (wl?.projectId) {
      try {
        const defaultIds = await getProjectDefaultMemberIds(wl.projectId);
        if (defaultIds.length > 0) {
          initialMemberIds = defaultIds;
        }
      } catch {
        // 既定メンバー取得失敗時は selectedMemberIds のまま
      }
    }
    setModalMemberIds([...initialMemberIds]);
  };

  const closeBulkAssignModal = () => setBulkAssignModalClosing(true);

  const applyBulkAssignFromModal = () => {
    handleBulkAssign(
      modalWorkLineId,
      modalRangeStart,
      modalRangeEnd,
      modalMemberIds,
      modalHolidayWeekdays
    );
    // モーダルで確定した開始日・終了日をカードの状態にも反映
    setRangeStartDate(modalRangeStart);
    setRangeEndDate(modalRangeEnd);
    closeBulkAssignModal();
  };

  const toggleModalMember = (memberId: string) => {
    setModalMemberIds((prev) =>
      prev.includes(memberId)
        ? prev.filter((id) => id !== memberId)
        : [...prev, memberId]
    );
  };

  const toggleModalHolidayWeekday = (dayIndex: number) => {
    setModalHolidayWeekdays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const toggleHolidayWeekday = (dayIndex: number) => {
    setHolidayWeekdays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const toggleSelectionHolidayWeekday = (dayIndex: number) => {
    setSelectionHolidayWeekdays((prev) =>
      prev.includes(dayIndex)
        ? prev.filter((d) => d !== dayIndex)
        : [...prev, dayIndex]
    );
  };

  const getCellAssignments = (workLineId: string, iso: string) =>
    assignments.filter(
      (a) => a.workLineId === workLineId && a.date === iso && !a.isHoliday
    );

  // 日別の稼働数（表示中の作業班のみ・休日除く）
  const dailyWorkload = useMemo(() => {
    return days.map((d) => {
      const total = displayedLines.reduce(
        (sum, line) => sum + getCellAssignmentsForMerged(line, d.iso).length,
        0
      );
      return { iso: d.iso, count: total };
    });
  }, [days, displayedLines, assignments]);

  return (
    <AuthGuard>
    <div className={embedded ? "h-full flex flex-col min-h-0" : "h-screen flex flex-col"}>
      {!embedded && (
        <header className="px-6 py-3 border-b border-theme-border flex items-center justify-between">
          <div className="flex items-baseline gap-4">
            <h1 className="text-lg font-semibold text-theme-text">工程・人員配置</h1>
          </div>
        </header>
      )}
      <div className="flex-1 overflow-auto grid grid-rows-[auto_minmax(0,1fr)] gap-2 p-3">
        {/* ビューア用のフィルタリングカード（埋め込み表示時は非表示） */}
        {!embedded && !isAdmin && (
          <Card title="工程表フィルター" className="text-xs">
            <div className="flex flex-wrap items-end gap-4">
              <div>
                <label className="block mb-1">作業班</label>
                <select
                  className="rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1 text-[11px]"
                  value={filteredWorkLineId}
                  onChange={(e) => {
                    const value = e.target.value;
                    setFilteredWorkLineId(value);
                  }}
                >
                  <option value="">すべて表示</option>
                  {mergedWorkLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1">開始日</label>
                <input
                  type="date"
                  className="rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1 text-[11px]"
                  value={rangeStartDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRangeStartDate(value);
                    // 開始日が選択されたら、その日を含む週の月曜日を計算して工程表を更新
                    if (value) {
                      const selectedDate = new Date(value);
                      const dayOfWeek = selectedDate.getDay();
                      const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
                      const monday = new Date(selectedDate);
                      monday.setDate(diff);
                      monday.setHours(0, 0, 0, 0);
                      setCurrentWeekStart(monday);
                    }
                  }}
                />
              </div>
              <div>
                <label className="block mb-1">終了日</label>
                <input
                  type="date"
                  className="rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1 text-[11px]"
                  value={rangeEndDate}
                  onChange={(e) => {
                    const value = e.target.value;
                    setRangeEndDate(value);
                    // 終了日が選択されたら、その日を含む週の月曜日を計算して工程表を更新
                    if (value) {
                      const selectedDate = new Date(value);
                      const dayOfWeek = selectedDate.getDay();
                      const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
                      const monday = new Date(selectedDate);
                      monday.setDate(diff);
                      monday.setHours(0, 0, 0, 0);
                      setCurrentWeekStart(monday);
                    }
                  }}
                />
              </div>
            </div>
          </Card>
        )}
        {/* 管理者用の期間まとめて配置カード（スマホではクリックで開閉） - 埋め込み表示時は非表示 */}
        {isAdmin && !embedded && (
        isMobile ? (
          <section className="rounded-xl bg-theme-card border border-theme-border text-theme-text shadow-sm text-xs overflow-hidden">
            <button
              type="button"
              onClick={() => setBulkCardExpandedMobile((v) => !v)}
              className="flex items-center justify-between w-full px-4 py-3 text-left border-b border-theme-border hover:bg-theme-bg-elevated/50 transition-colors"
              aria-expanded={bulkCardExpandedMobile}
            >
              <h2 className="text-sm font-semibold text-theme-text">期間まとめて配置 / 休み設定</h2>
              <span
                className={bulkCardExpandedMobile ? "rotate-180" : ""}
                style={{ transition: "transform 0.2s ease" }}
                aria-hidden
              >
                <svg className="w-5 h-5 text-theme-text-muted" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </span>
            </button>
            <div
              className="grid transition-[grid-template-rows] duration-200 ease-out"
              style={{ gridTemplateRows: bulkCardExpandedMobile ? "1fr" : "0fr" }}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="p-4 pt-3 border-t-0 border-theme-border">
                  <div className="flex flex-col gap-3">
                    <div>
                      <label className="block mb-1">作業班</label>
                      <select
                        className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1.5 text-[11px]"
                        value={selectedWorkLineId}
                        onChange={(e) => {
                          const value = e.target.value;
                          setSelectedWorkLineId(value);
                          setFilteredWorkLineId(value);
                        }}
                      >
                        <option value="">選択してください</option>
                        {mergedWorkLines.map((line) => (
                          <option key={line.id} value={line.id}>
                            {line.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block mb-1">開始日</label>
                      <input
                        type="date"
                        className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1.5 text-[11px]"
                        value={rangeStartDate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRangeStartDate(value);
                          if (value) {
                            const selectedDate = new Date(value);
                            const dayOfWeek = selectedDate.getDay();
                            const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                            const monday = new Date(selectedDate);
                            monday.setDate(diff);
                            monday.setHours(0, 0, 0, 0);
                            setCurrentWeekStart(monday);
                          }
                        }}
                      />
                    </div>
                    <div>
                      <label className="block mb-1">終了日</label>
                      <input
                        type="date"
                        className="w-full rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1.5 text-[11px]"
                        value={rangeEndDate}
                        onChange={(e) => {
                          const value = e.target.value;
                          setRangeEndDate(value);
                          if (value) {
                            const selectedDate = new Date(value);
                            const dayOfWeek = selectedDate.getDay();
                            const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
                            const monday = new Date(selectedDate);
                            monday.setDate(diff);
                            monday.setHours(0, 0, 0, 0);
                            setCurrentWeekStart(monday);
                          }
                        }}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={openBulkAssignModal}
                      className="w-full inline-flex items-center justify-center px-4 py-2.5 rounded-md bg-accent text-xs font-medium hover:brightness-110"
                    >
                      期間まとめて配置
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : (
        <Card title="期間まとめて配置 / 休み設定" className="text-xs">
          <div className="flex flex-wrap items-end gap-2">
            <div>
              <label className="block mb-1">作業班</label>
              <select
                className="rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-2 py-1 text-[11px]"
                value={selectedWorkLineId}
                onChange={(e) => {
                  const value = e.target.value;
                  setSelectedWorkLineId(value);
                  setFilteredWorkLineId(value); // テーブル表示も同時に更新
                }}
              >
                <option value="">選択してください</option>
                {mergedWorkLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block mb-1">開始日</label>
              <input
                type="date"
                className="rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-1 py-1 text-[11px]"
                value={rangeStartDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setRangeStartDate(value);
                  // 開始日が選択されたら、その日を含む週の月曜日を計算して工程表を更新
                  if (value) {
                    const selectedDate = new Date(value);
                    const dayOfWeek = selectedDate.getDay();
                    const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
                    const monday = new Date(selectedDate);
                    monday.setDate(diff);
                    monday.setHours(0, 0, 0, 0);
                    setCurrentWeekStart(monday);
                  }
                }}
              />
            </div>
            <div>
              <label className="block mb-1">終了日</label>
              <input
                type="date"
                className="rounded-md bg-theme-bg-input border border-theme-border text-theme-text px-1 py-1 text-[11px]"
                value={rangeEndDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setRangeEndDate(value);
                  // 終了日が選択されたら、その日を含む週の月曜日を計算して工程表を更新
                  if (value) {
                    const selectedDate = new Date(value);
                    const dayOfWeek = selectedDate.getDay();
                    const diff = selectedDate.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1); // 月曜日を週の始まりとする
                    const monday = new Date(selectedDate);
                    monday.setDate(diff);
                    monday.setHours(0, 0, 0, 0);
                    setCurrentWeekStart(monday);
                  }
                }}
              />
            </div>
            <div className="ml-auto pb-1">
              <button
                type="button"
                onClick={openBulkAssignModal}
                className="inline-flex items-center px-4 py-1.5 rounded-md bg-accent text-xs font-medium hover:brightness-110"
              >
                期間まとめて配置
              </button>
            </div>
          </div>
        </Card>
        )
        )}
        <Card title="工程表" className="text-xs overflow-hidden">
          <div className="flex flex-wrap items-center gap-2 mb-2">
            {isAdmin && !embedded && (
              <label className="inline-flex items-center gap-1.5 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={monthEndVerifyMode}
                  onChange={(e) => setMonthEndVerifyMode(e.target.checked)}
                  className="rounded border-theme-border bg-theme-bg-input text-accent focus:ring-accent"
                />
                <span className="text-[11px] text-theme-text-muted">
                  月末確認モード
                </span>
              </label>
            )}
            {!embedded && (
              <>
                <button
                  type="button"
                  onClick={goToPrevWeek}
                  disabled={isAnimating}
                  className="px-3 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-xs hover:bg-theme-bg-elevated-hover disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  ← 前の週
                </button>
                <button
                  type="button"
                  onClick={goToToday}
                  disabled={isAnimating}
                  className="px-3 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-xs hover:bg-theme-bg-elevated-hover disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  今週に戻る
                </button>
                <button
                  type="button"
                  onClick={goToNextWeek}
                  disabled={isAnimating}
                  className="px-3 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-xs hover:bg-theme-bg-elevated-hover disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
                >
                  次の週 →
                </button>
                <span className="text-xs text-theme-text-muted ml-auto">
                  {days.length > 0 && (
                    <>
                      {format(days[0].date, "yyyy年MM月dd日", { locale: ja })} 〜{" "}
                      {format(days[days.length - 1].date, "yyyy年MM月dd日", { locale: ja })}
                    </>
                  )}
                </span>
              </>
            )}
          </div>
          <div 
            className="overflow-y-auto overflow-x-auto"
            style={{ 
              width: '100%',
              height: embedded ? 'calc(100vh - 110px)' : SCHEDULE_SCROLL_HEIGHT_PX
            }}
          >
            <table className="border-collapse text-[11px] w-full" style={{ tableLayout: 'fixed', minHeight: '280px' }} cellPadding="0" cellSpacing="0">
              <colgroup>
                <col style={{ width: isMobile ? '50px' : '100px' }} />
                {days.map((_, index) => (
                  <col key={`col-${index}`} />
                ))}
              </colgroup>
              <thead>
                <tr className="sticky top-0 z-20 bg-theme-bg-input text-theme-text shadow-[0_1px_0_0_var(--color-border)]">
                  <th className="sticky left-0 z-30 border-b border-r border-theme-border px-2 py-1 text-left bg-theme-bg-input text-theme-text">
                    班
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.iso}
                      className={`sticky top-0 z-20 border-b border-l border-theme-border px-1 py-1 text-center overflow-hidden transition-all duration-300 ease-in-out bg-theme-bg-input text-theme-text ${
                        slideDirection === 'left' 
                          ? 'translate-x-[-100%] opacity-0' 
                          : slideDirection === 'right' 
                          ? 'translate-x-[100%] opacity-0' 
                          : 'translate-x-0 opacity-100'
                      }`}
                      style={{ maxWidth: 0 }}
                    >
                      <div className="truncate">{format(d.date, "MM/dd", { locale: ja })}</div>
                      <div className="text-[10px] text-theme-text-muted truncate">
                        {format(d.date, "E", { locale: ja })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingData ? (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center py-4 text-theme-text-muted">
                      データを読み込み中...
                    </td>
                  </tr>
                ) : displayedLines.length === 0 && unassignedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center py-4 text-theme-text-muted">
                      作業グループが登録されていません。案件登録ページで作業グループを設定してください。
                    </td>
                  </tr>
                ) : (
                  <>
                  {unassignedProjects.length > 0 && (
                    <tr className="bg-theme-bg-elevated/50" style={{ minHeight: '110px' }}>
                      <td
                        className="sticky left-0 z-10 border-t border-r border-theme-border px-2 py-2 text-left align-top bg-theme-bg-elevated/60"
                        style={{ minWidth: isMobile ? 50 : 100, minHeight: '110px' }}
                      >
                        <span className="text-[11px] md:text-xs font-medium text-theme-text-muted">未配置</span>
                      </td>
                      {days.map((d) => {
                        const dayProjects = unassignedProjects.filter(
                          (p) => d.iso >= p.startDate && d.iso <= p.endDate
                        );
                        return (
                          <td
                            key={d.iso}
                            className={`border-t border-l border-theme-border align-top overflow-hidden ${dragProject ? "ring-1 ring-accent/50 bg-accent/5" : ""}`}
                            style={{ maxWidth: 0, verticalAlign: 'top', padding: 0 }}
                            onDragOver={(e) => {
                              if (dragProject) {
                                e.preventDefault();
                                e.stopPropagation();
                                e.dataTransfer.dropEffect = "move";
                              }
                            }}
                            onDrop={(e) => {
                              if (!dragProject) return;
                              e.preventDefault();
                              e.stopPropagation();
                              const raw = e.dataTransfer.getData("application/x-schedule-project");
                              setDragProject(null);
                              if (!raw) return;
                              try {
                                const { workLineId } = JSON.parse(raw);
                                const projectId = workLines.find((w) => w.id === workLineId)?.projectId;
                                const project = projectId ? projects.find((p) => p.id === projectId) : undefined;
                                if (project) {
                                  const phases = projectPhasesMap.get(project.id) ?? [];
                                  setMoveDropPending({ project, fromWorkLineId: workLineId, toLine: "unassigned" });
                                  setMoveModalForm({
                                    startDate: project.startDate,
                                    endDate: project.endDate,
                                    phases
                                  });
                                  setMoveModalDateToPhase(phasesToDateMap(phases));
                                  setMoveModalSelectedPhase(phases[0]?.siteStatus ?? "");
                                } else {
                                  unassignProjectFromLine(workLineId);
                                }
                              } catch {
                                // ignore
                              }
                            }}
                          >
                            <div className="w-full h-full px-1.5 py-1.5 flex flex-col gap-1" style={{ minHeight: '110px', boxSizing: 'border-box' }}>
                              {dayProjects.map((project) => (
                                <div key={project.id} className="flex flex-col gap-1 flex-shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedProject(project);
                                      setShowProjectModal(true);
                                      setProjectModalClosing(false);
                                    }}
                                    className="text-[11px] font-semibold truncate rounded px-2 py-0.5 text-left border border-dashed border-theme-border bg-theme-bg-input hover:bg-theme-bg-elevated text-theme-text"
                                  >
                                    📋 {project.siteName}
                                  </button>
                                  {isAdmin && workGroups.length > 0 && (
                                    <select
                                      className="text-[10px] rounded border border-theme-border bg-theme-bg-input text-theme-text px-1.5 py-0.5 w-full"
                                      value=""
                                      onChange={(e) => {
                                        const wgId = e.target.value;
                                        if (!wgId) return;
                                        const wg = workGroups.find((g) => g.id === wgId);
                                        if (wg) assignProjectToWorkGroup(project.id, wg);
                                        e.target.value = "";
                                      }}
                                      onClick={(e) => e.stopPropagation()}
                                    >
                                      <option value="">班を割り当て...</option>
                                      {workGroups.map((wg) => (
                                        <option key={wg.id} value={wg.id}>{wg.name}</option>
                                      ))}
                                    </select>
                                  )}
                                </div>
                              ))}
                            </div>
                          </td>
                        );
                      })}
                    </tr>
                  )}
                  {displayedLines.map((line) => {
                  const isSelected = filteredWorkLineId === line.id;
                  const isDragging = draggedWorkLineId === line.id;
                  const isDragOver = dragOverWorkLineId === line.id;
                  return (
                    <tr
                      key={line.id}
                      draggable
                      onDragStart={(e) => {
                        setDraggedWorkLineId(line.id);
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", line.id);
                        e.dataTransfer.setDragImage(e.currentTarget, 0, 0);
                      }}
                      onDragOver={(e) => {
                        e.preventDefault();
                        e.dataTransfer.dropEffect = "move";
                        if (draggedWorkLineId && draggedWorkLineId !== line.id) setDragOverWorkLineId(line.id);
                      }}
                      onDragLeave={() => setDragOverWorkLineId(null)}
                      onDrop={(e) => {
                        e.preventDefault();
                        setDragOverWorkLineId(null);
                        const id = e.dataTransfer.getData("text/plain");
                        if (id && id !== line.id) moveWorkLineOrder(id, line.id);
                      }}
                      onDragEnd={() => {
                        setDraggedWorkLineId(null);
                        setDragOverWorkLineId(null);
                      }}
                      className={`${isSelected ? "bg-theme-bg-elevated/30" : ""} ${isDragging ? "opacity-50" : ""} ${isDragOver ? "ring-2 ring-inset ring-accent" : ""}`}
                      style={{ minHeight: '110px' }}
                    >
                      <td
                        className={`sticky left-0 z-10 border-t border-r border-theme-border px-2 py-2 text-left align-top overflow-hidden cursor-grab active:cursor-grabbing ${
                          isSelected ? "bg-theme-bg-elevated/50" : "bg-theme-bg-input/60"
                        }`}
                        style={{
                          verticalAlign: "top",
                          padding: "8px",
                          lineHeight: "normal",
                          minWidth: isMobile ? "50px" : "100px",
                          minHeight: "110px",
                        }}
                        title={`${line.name}（ドラッグで並び替え）`}
                      >
                        <div className="flex flex-col md:flex-row md:items-center items-start gap-1.5 min-w-0">
                          <span
                            className="inline-block w-2 h-6 md:h-8 rounded-full flex-shrink-0"
                            style={{ backgroundColor: line.color ?? "#6b7280" }}
                          />
                          <span
                            className={`text-[11px] md:text-xs truncate text-theme-text ${
                              isSelected ? "font-semibold" : ""
                            }`}
                          >
                            {isMobile ? getWorkLineShortName(line.name) : line.name}
                          </span>
                          <span className="ml-0.5 text-theme-text-muted shrink-0" aria-hidden>⋮⋮</span>
                        </div>
                      </td>
                    {days.map((d) => {
                      const iso = d.iso;
                      const cellEntries = getCellProjectEntries(line, iso);
                      const slots = cellEntries.length > 0 ? cellEntries : [{ workLineId: line.workLineIds[0] ?? "", project: null as Project | null }];
                      const twoCols = cellEntries.length > 1;
                      return (
                        <td
                          key={iso}
                          className={`border-t border-l border-theme-border align-top overflow-hidden transition-all duration-300 ease-in-out ${
                            slideDirection === 'left' 
                              ? 'translate-x-[-100%] opacity-0' 
                              : slideDirection === 'right' 
                              ? 'translate-x-[100%] opacity-0' 
                              : 'translate-x-0 opacity-100'
                          } ${dragProject ? "ring-1 ring-accent/50 bg-accent/5" : ""}`}
                          style={{ maxWidth: 0, verticalAlign: 'top', padding: 0, lineHeight: 'normal' }}
                          onDragOver={(e) => {
                            if (dragProject) {
                              e.preventDefault();
                              e.stopPropagation();
                              e.dataTransfer.dropEffect = "move";
                            }
                          }}
                          onDrop={(e) => {
                            if (!dragProject) return;
                            e.preventDefault();
                            e.stopPropagation();
                            const raw = e.dataTransfer.getData("application/x-schedule-project");
                            setDragProject(null);
                            if (!raw) return;
                            try {
                              const { projectId, workLineId } = JSON.parse(raw);
                              if (line.workLineIds.includes(workLineId)) return;
                              const project = projects.find((p) => p.id === projectId);
                              if (project) {
                                const phases = projectPhasesMap.get(project.id) ?? [];
                                setMoveDropPending({ project, fromWorkLineId: workLineId, toLine: line });
                                setMoveModalForm({
                                  startDate: project.startDate,
                                  endDate: project.endDate,
                                  phases
                                });
                                setMoveModalDateToPhase(phasesToDateMap(phases));
                                setMoveModalSelectedPhase(phases[0]?.siteStatus ?? "");
                              } else {
                                moveProjectToLine(projectId, workLineId, line);
                              }
                            } catch {
                              // ignore
                            }
                          }}
                        >
                          <div className={`w-full h-full px-1.5 py-1.5 ${twoCols ? "grid grid-cols-2 gap-1" : "flex flex-col gap-1"}`} style={{ minHeight: '110px', boxSizing: 'border-box' }}>
                            {slots.map(({ workLineId: wlId, project }) => {
                              const entryLocked = isCellLocked(wlId, iso);
                              const entryAssignments = assignments.filter((a) => a.workLineId === wlId && a.date === iso && !a.isHoliday);
                              const weekday = new Date(iso).getDay();
                              const isWeeklyHoliday = project?.defaultHolidayWeekdays?.includes(weekday) ?? false;
                              const phaseStatus = getPhaseStatusForCell(wlId, iso);
                              const projectPhases = project ? projectPhasesMap.get(project.id) : undefined;
                              const hasPhasesButUnassigned = !!project && (projectPhases?.length ?? 0) > 0 && !phaseStatus;
                              const hasProjectAndMembers = project !== null && entryAssignments.length > 0;
                              return (
                                <div key={wlId} className="flex flex-col gap-1 min-w-0">
                                  {project ? (
                                    <>
                                      <div className="flex items-center gap-1 flex-shrink-0">
                                        <button
                                          type="button"
                                          draggable
                                          onDragStart={(e) => {
                                            e.stopPropagation();
                                            setDragProject({ projectId: project.id, workLineId: wlId });
                                            e.dataTransfer.effectAllowed = "move";
                                            e.dataTransfer.setData("application/x-schedule-project", JSON.stringify({ projectId: project.id, workLineId: wlId }));
                                          }}
                                          onDragEnd={() => setDragProject(null)}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setProjectModalClosing(false);
                                            setSelectedProject(project);
                                            setShowProjectModal(true);
                                          }}
                                          className={`text-[11px] font-semibold truncate rounded px-2 py-0.5 text-left flex-1 min-w-0 transition-colors hover:opacity-90 border cursor-grab active:cursor-grabbing ${
                                            phaseStatus
                                              ? `${getPhaseStatusStyle(phaseStatus).bg} ${getPhaseStatusStyle(phaseStatus).border} ${getPhaseStatusStyle(phaseStatus).text}`
                                              : hasPhasesButUnassigned
                                              ? `${UNASSIGNED_DAY_STYLE.bg} ${UNASSIGNED_DAY_STYLE.border} ${UNASSIGNED_DAY_STYLE.text}`
                                              : "bg-accent/10 hover:bg-accent/20 border-accent/30 text-accent"
                                          }`}
                                          title={`${project.siteName}${phaseStatus ? ` - ${phaseStatus}` : hasPhasesButUnassigned ? " - 工程未割り当て" : ""} - クリックで詳細／ドラッグで班を変更`}
                                          style={{ height: '24px', minHeight: '24px', maxHeight: '24px' }}
                                        >
                                          📋 {project.siteName}
                                        </button>
                                      </div>
                                      {getBPMembersForProject(project).length > 0 ? (
                                        <div className="flex flex-wrap gap-1 min-w-0 items-center flex-shrink-0">
                                          {getBPMembersForProject(project).map((m) => (
                                            <span key={m.id} title={m.name} className="inline-flex flex-col items-center gap-0.5 flex-shrink-0 min-w-0">
                                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-theme-text text-[10px] flex-shrink-0" style={{ borderColor: m.color || MEMBER_COLORS[0], backgroundColor: `${m.color || MEMBER_COLORS[0]}20` }}>
                                                {getMemberShortName(m.name)}
                                              </span>
                                              <span className="text-[9px] text-theme-text-muted truncate max-w-[4.5em] leading-tight" style={{ maxWidth: "4.5em" }}>{getMemberNameLabel(m.name, 4)}</span>
                                            </span>
                                          ))}
                                        </div>
                                      ) : null}
                                    </>
                                  ) : null}
                                  <button
                                    type="button"
                                    onClick={() => { if (!entryLocked) openSelection(wlId, iso); }}
                                    disabled={entryLocked}
                                    className={`w-full min-h-[36px] px-1.5 py-0.5 rounded min-w-0 overflow-hidden flex flex-col ${entryLocked ? "bg-theme-bg-input/40 text-theme-text-muted cursor-not-allowed" : "hover:bg-theme-bg-elevated/60"}`}
                                    style={{ flexShrink: 0 }}
                                  >
                                    <div className="flex flex-wrap gap-1 min-w-0 items-center justify-center content-center flex-1">
                                      {isWeeklyHoliday ? (
                                        <div className="inline-flex items-center gap-1 px-2 py-1 rounded-full border border-rose-500/60 bg-rose-500/15 text-[11px] font-medium text-rose-200" title="この案件では週休日として設定されています">
                                          <span className="inline-flex items-center justify-center w-4 h-4 rounded-full bg-rose-500/80 text-[10px] font-bold text-white">休</span>
                                          <span>休日</span>
                                        </div>
                                      ) : (
                                        entryAssignments.map((a) => {
                                          const member = members.find((m) => m.id === a.memberId) ?? members[0];
                                          const memberColor = getMemberColor(a.memberId, members);
                                          return (
                                            <span key={a.id} title={member.name} className="inline-flex flex-col items-center justify-center gap-0.5 flex-shrink-0 min-w-0 text-center">
                                              <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border-2 text-theme-text text-[10px] flex-shrink-0" style={{ borderColor: memberColor, backgroundColor: `${memberColor}20` }}>
                                                {getMemberShortName(member.name)}
                                              </span>
                                              <span className="text-[9px] text-theme-text-muted truncate max-w-[4.5em] leading-tight" style={{ maxWidth: "4.5em" }}>{getMemberNameLabel(member.name, 4)}</span>
                                            </span>
                                          );
                                        })
                                      )}
                                    </div>
                                  </button>
                                  <div className="flex items-center justify-end text-[9px] text-theme-text-muted min-w-0 flex-shrink-0" style={{ height: '24px', minHeight: '24px', maxHeight: '24px' }}>
                                    {isAdmin && hasProjectAndMembers && (
                                      <button
                                        type="button"
                                        onClick={(e) => { e.stopPropagation(); if (!isPastDate(iso)) toggleLock(wlId, iso); }}
                                        disabled={isPastDate(iso) && !monthEndVerifyMode}
                                        className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all flex-shrink-0 ${
                                          isPastDate(iso) && !monthEndVerifyMode ? "bg-theme-bg-elevated/60 text-theme-text-muted border border-theme-border cursor-default"
                                          : entryLocked ? "bg-accent/20 text-accent border border-accent/50 hover:scale-110 hover:bg-accent/30"
                                          : "bg-theme-bg-elevated/60 text-theme-text-muted border border-theme-border hover:scale-110 hover:bg-theme-bg-elevated-hover hover:text-theme-text"
                                        }`}
                                        title={isPastDate(iso) && !monthEndVerifyMode ? "過去のため編集不可" : entryLocked ? "ロック解除" : "この日を確定"}
                                        style={{ flexShrink: 0 }}
                                      >
                                        {entryLocked ? "🔒" : "🔓"}
                                      </button>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                  })}
                  </>
                )}
              </tbody>
              <tfoot>
                <tr className="sticky bottom-0 z-20 bg-theme-schedule-footer border-t-2 border-theme-border text-theme-text shadow-[0_-1px_0_0_var(--color-border)]">
                  <td className="sticky left-0 z-30 border-r border-theme-border px-2 py-2 text-left text-[11px] font-semibold bg-theme-schedule-footer text-theme-text">
                    1日の稼働数
                  </td>
                  {dailyWorkload.map(({ iso, count }) => (
                    <td
                      key={iso}
                      className="sticky bottom-0 z-20 border-l border-theme-border px-1 py-2 text-center text-[11px] font-semibold bg-theme-schedule-footer text-theme-text"
                    >
                      {count > 0 ? (
                        <span className="text-accent">{count}人</span>
                      ) : (
                        <span className="text-theme-text-muted">0人</span>
                      )}
                    </td>
                  ))}
                </tr>
              </tfoot>
            </table>
          </div>
        </Card>
      </div>

      {/* 案件詳細モーダル（開閉アニメーション） */}
      {showProjectModal && selectedProject && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              projectModalClosing || !projectModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={() => setProjectModalClosing(true)}
          />
          <div
            className={`relative w-full max-w-[500px] rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg p-4 text-sm transition-all duration-200 ease-out ${
              projectModalClosing || !projectModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-base font-semibold text-theme-text">案件詳細</h3>
              <button
                type="button"
                onClick={() => setProjectModalClosing(true)}
                className="text-theme-text-muted hover:text-theme-text text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-2.5">
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">現場名</label>
                <div className="text-sm font-semibold text-accent">{selectedProject.siteName}</div>
              </div>
              {selectedProject.title && selectedProject.title !== selectedProject.siteName && (
                <div>
                  <label className="text-xs text-theme-text-muted block mb-1">タイトル</label>
                  <div className="text-sm">{selectedProject.title}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">取引先会社名</label>
                <div className="text-sm">{selectedProject.customerName}</div>
              </div>
              {getBPMembersForProject(selectedProject).length > 0 && (
                <div>
                  <label className="text-xs text-theme-text-muted block mb-1">取引先メンバー（ビジネスパートナー）</label>
                  <div className="text-sm">{getBPMembersForProject(selectedProject).map((m) => m.name).join(", ")}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">契約形態</label>
                <div className="text-sm">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-theme-bg-elevated">
                    {selectedProject.contractType}
                  </span>
                </div>
              </div>
              {selectedProject.contractAmount && (
                <div>
                  <label className="text-xs text-theme-text-muted block mb-1">請負金額</label>
                  <div className="text-sm">¥{selectedProject.contractAmount.toLocaleString()}</div>
                </div>
              )}
              {(() => {
                const phases = projectPhasesMap.get(selectedProject.id);
                if (phases && phases.length > 0) {
                  return (
                    <div>
                      <label className="text-xs text-theme-text-muted block mb-1">工程（組立・解体など）</label>
                      <div className="text-sm space-y-1">
                        {phases.map((p, i) => {
                          const style = getPhaseStatusStyle(p.siteStatus);
                          return (
                            <div key={i}>
                              {format(new Date(p.startDate), "M/d", { locale: ja })}
                              {p.startDate !== p.endDate && ` 〜 ${format(new Date(p.endDate), "M/d", { locale: ja })}`}
                              {" "}
                              <span className={`inline-flex px-2 py-0.5 rounded border ${style.bg} ${style.border} ${style.text}`}>{p.siteStatus}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                }
                if (selectedProject.siteStatus) {
                  return (
                    <div>
                      <label className="text-xs text-theme-text-muted block mb-1">現場ステータス</label>
                      <div className="text-sm">{selectedProject.siteStatus}</div>
                    </div>
                  );
                }
                return null;
              })()}
              {selectedProject.defaultHolidayWeekdays && selectedProject.defaultHolidayWeekdays.length > 0 && (
                <div>
                  <label className="text-xs text-theme-text-muted block mb-1">標準 週休日</label>
                  <div className="text-sm">
                    {selectedProject.defaultHolidayWeekdays
                      .map((d) => ["日", "月", "火", "水", "木", "金", "土"][d] ?? "")
                      .filter((v) => v !== "")
                      .join("・")}
                  </div>
                </div>
              )}
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">現場住所</label>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm flex-1 min-w-0">{selectedProject.siteAddress}</span>
                  {selectedProject.siteAddress?.trim() && (
                    <a
                      href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(selectedProject.siteAddress.trim())}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 shrink-0 px-2 py-1 rounded-md bg-accent/15 border border-accent/40 text-accent text-[11px] font-medium hover:bg-accent/25"
                    >
                      <span aria-hidden>🗺</span>
                      地図で開く
                    </a>
                  )}
                </div>
              </div>
              {selectedProject.memo && (
                <div>
                  <label className="text-xs text-theme-text-muted block mb-1">メモ</label>
                  <div className="text-sm whitespace-pre-wrap break-words">{selectedProject.memo}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">工期</label>
                <div className="text-sm">
                  {format(new Date(selectedProject.startDate), "yyyy年MM月dd日", { locale: ja })} 〜 {format(new Date(selectedProject.endDate), "yyyy年MM月dd日", { locale: ja })}
                </div>
              </div>
            </div>
            <div className="mt-3 flex justify-end">
              <button
                type="button"
                onClick={() => setProjectModalClosing(true)}
                className="px-2.5 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-[11px] hover:bg-theme-bg-elevated-hover"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ドロップ時：班変更／未配置に戻す ＋ 任意で工期・工程変更 */}
      {moveDropPending && moveModalForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-black/50"
            aria-label="閉じる"
            onClick={() => {
              setMoveDropPending(null);
              setMoveModalForm(null);
              setMoveModalAssignments([]);
              setMoveModalDateToPhase({});
              setMoveModalSelectedPhase("");
            }}
          />
          <div className="relative w-full max-w-lg max-h-[90vh] flex flex-col rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg overflow-hidden">
            <div className="shrink-0 p-3 border-b border-theme-border">
              <h3 className="text-sm font-semibold mb-0.5">
                {moveDropPending.toLine === "unassigned" ? "未配置に戻す" : "班を変更"}
              </h3>
              <p className="text-theme-text-muted text-[11px] mb-2">
                【{moveDropPending.project.siteName}】を{" "}
                {moveDropPending.toLine === "unassigned" ? "未配置" : moveDropPending.toLine.name} に
                {moveDropPending.toLine === "unassigned" ? "戻します。" : "移動します。"}
              </p>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => executeMoveDrop()}
                  className="px-2 py-1 rounded-md bg-accent text-accent-foreground text-[11px] hover:opacity-90"
                >
                  このまま実行
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMoveDropPending(null);
                    setMoveModalForm(null);
                    setMoveModalAssignments([]);
                    setMoveModalDateToPhase({});
                    setMoveModalSelectedPhase("");
                  }}
                  className="px-2 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-[11px] hover:bg-theme-bg-elevated-hover"
                >
                  キャンセル
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-3">
              {/* 以前の作業班での割当を表示 */}
              <div>
                <div className="text-[11px] font-medium text-theme-text-muted mb-1.5">以前の作業班での割当</div>
                <div className="rounded border border-theme-border bg-theme-bg-input p-2 max-h-32 overflow-y-auto text-[11px] text-theme-text">
                  {moveModalAssignments.length === 0 ? (
                    <p className="text-theme-text-muted">割当なし、または読み込み中...</p>
                  ) : (
                    (() => {
                      const start = moveDropPending.project.startDate;
                      const end = moveDropPending.project.endDate;
                      const byDate = new Map<string, Assignment[]>();
                      for (const a of moveModalAssignments) {
                        if (a.date < start || a.date > end || a.isHoliday) continue;
                        const list = byDate.get(a.date) ?? [];
                        list.push(a);
                        byDate.set(a.date, list);
                      }
                      const dates = Array.from(byDate.keys()).sort();
                      if (dates.length === 0) return <p className="text-theme-text-muted">工期内の割当はありません</p>;
                      return (
                        <ul className="space-y-1">
                          {dates.map((date) => {
                            const list = byDate.get(date) ?? [];
                            const names = list.map((a) => members.find((m) => m.id === a.memberId)?.name ?? a.memberId).filter(Boolean);
                            return (
                              <li key={date} className="flex gap-2">
                                <span className="text-theme-text-muted shrink-0">{date}</span>
                                <span>{names.join("、") || "—"}</span>
                              </li>
                            );
                          })}
                        </ul>
                      );
                    })()
                  )}
                </div>
              </div>

              {/* 工期を変更して実行 */}
              <div>
                <div className="text-[11px] font-medium text-theme-text-muted mb-1">工期を変更して実行</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <input
                    type="date"
                    value={moveModalForm.startDate}
                    onChange={(e) => setMoveModalForm((f) => (f ? { ...f, startDate: e.target.value } : f))}
                    className="rounded border border-theme-border bg-theme-bg-input text-theme-text px-2 py-1 text-xs"
                  />
                  <span className="text-theme-text-muted">〜</span>
                  <input
                    type="date"
                    value={moveModalForm.endDate}
                    onChange={(e) => setMoveModalForm((f) => (f ? { ...f, endDate: e.target.value } : f))}
                    className="rounded border border-theme-border bg-theme-bg-input text-theme-text px-2 py-1 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => executeMoveDrop({ updateDates: true })}
                    className="px-2 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-[11px] hover:bg-theme-bg-elevated-hover"
                  >
                    変更して実行
                  </button>
                </div>
              </div>

              {/* 工程と日付をカレンダーで編集（新規案件登録と同様にクリックで割り当て） */}
              <div>
                <div className="text-[11px] font-medium text-theme-text-muted mb-1">工程と日付を編集</div>
                <p className="text-[11px] text-theme-text-muted mb-2">
                  工程を選び、カレンダーの日付をクリックして割り当てます。同じ日を再度クリックで解除。
                </p>
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <label className="text-[11px] text-theme-text-muted shrink-0">選択中の工程:</label>
                  <input
                    list="move-modal-phase-datalist"
                    type="text"
                    value={moveModalSelectedPhase}
                    onChange={(e) => setMoveModalSelectedPhase(e.target.value)}
                    placeholder="例: 組立"
                    className="rounded border border-theme-border bg-theme-bg-input text-theme-text placeholder:text-theme-text-muted px-2 py-1 text-xs min-w-[100px]"
                    style={{ borderColor: moveModalGetPhaseColor(moveModalSelectedPhase) }}
                  />
                  <datalist id="move-modal-phase-datalist">
                    {MOVE_MODAL_PHASE_OPTIONS.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </div>
                <div className="rounded border border-theme-border bg-theme-bg-input p-2 max-h-[280px] overflow-y-auto">
                  {(() => {
                    const today = new Date();
                    const currentYear = today.getFullYear();
                    const currentMonth = today.getMonth();
                    const months: Date[] = [];
                    for (let m = currentMonth; m <= 11; m++) months.push(new Date(currentYear, m, 1));
                    const toggleDatePhase = (dateStr: string) => {
                      setMoveModalDateToPhase((prev) => {
                        const current = prev[dateStr];
                        if (current === moveModalSelectedPhase) {
                          const next = { ...prev };
                          delete next[dateStr];
                          return next;
                        }
                        return { ...prev, [dateStr]: moveModalSelectedPhase };
                      });
                    };
                    return (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        {months.map((monthFirst) => {
                          const monthKey = format(monthFirst, "yyyy-MM");
                          const monthStart = startOfWeek(startOfMonth(monthFirst), { weekStartsOn: 0 });
                          const monthEnd = endOfWeek(endOfMonth(monthFirst), { weekStartsOn: 0 });
                          const days = eachDayOfInterval({ start: monthStart, end: monthEnd });
                          const pad = getDay(monthFirst);
                          return (
                            <div key={monthKey} className="border border-theme-border rounded p-2 bg-theme-bg-elevated/50">
                              <div className="text-[11px] font-semibold text-center mb-1.5">{format(monthFirst, "yyyy年 M月", { locale: ja })}</div>
                              <div className="grid grid-cols-7 gap-0.5 text-center">
                                {["日", "月", "火", "水", "木", "金", "土"].map((w, idx) => (
                                  <div key={w} className={`text-[9px] font-medium ${idx === 0 ? "text-red-400" : idx === 6 ? "text-blue-400" : "text-theme-text-muted"}`}>{w}</div>
                                ))}
                                {Array.from({ length: pad }, (_, i) => <div key={`pad-${i}`} />)}
                                {days.slice(pad).map((d) => {
                                  const dateStr = format(d, "yyyy-MM-dd");
                                  const phase = moveModalDateToPhase[dateStr];
                                  const color = phase ? moveModalGetPhaseColor(phase) : undefined;
                                  const isCurrentMonth = format(d, "yyyy-MM") === monthKey;
                                  return (
                                    <button
                                      key={dateStr}
                                      type="button"
                                      onClick={() => isCurrentMonth && toggleDatePhase(dateStr)}
                                      disabled={!isCurrentMonth}
                                      className={`rounded-full aspect-square flex items-center justify-center text-[10px] font-medium min-w-[22px] min-h-[22px] ${!isCurrentMonth ? "opacity-30 cursor-not-allowed" : ""}`}
                                      style={{
                                        backgroundColor: color ?? "transparent",
                                        borderColor: color ?? "var(--color-border)",
                                        borderWidth: color ? 2 : 1,
                                        color: color ? "#fff" : "var(--theme-text-muted)"
                                      }}
                                      title={phase ? `${dateStr} ${phase}` : dateStr}
                                    >
                                      {format(d, "d")}
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>
                <button
                  type="button"
                  onClick={() => executeMoveDrop({ updatePhases: true })}
                  className="mt-1.5 px-2 py-1 rounded-md bg-theme-bg-elevated border border-theme-border text-[11px] hover:bg-theme-bg-elevated-hover"
                >
                  工程を変更して実行
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selection && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              selectionModalClosing || !selectionModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={() => setSelectionModalClosing(true)}
          />
          <div
            className={`relative w-full max-w-[420px] min-h-[260px] rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg p-3 text-xs transition-all duration-200 ease-out ${
              selectionModalClosing || !selectionModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <div>
                <div className="text-sm font-semibold">人員選択</div>
                <div className="text-[11px] text-theme-text-muted mt-0.5">
                  {selection.date}（{["日", "月", "火", "水", "木", "金", "土"][new Date(selection.date).getDay()]}） /{" "}
                  {workLines.find((l) => l.id === selection.workLineId)?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectionModalClosing(true)}
                className="text-theme-text-muted hover:text-theme-text text-sm"
              >
                ×
              </button>
            </div>
            {(() => {
              const proj = getProjectForWorkLine(selection.workLineId, selection.date);
              const holidayWeekdays = proj?.defaultHolidayWeekdays ?? [];
              return holidayWeekdays.length > 0 ? (
                <div className="mb-2 px-2 py-1.5 rounded-md bg-theme-bg-elevated border border-theme-border">
                  <div className="text-[11px] text-theme-text-muted-strong mb-0.5">この案件の標準週休日</div>
                  <div className="text-[11px] text-theme-text">
                    {holidayWeekdays
                      .map((d) => ["日", "月", "火", "水", "木", "金", "土"][d] ?? "")
                      .filter((v) => v !== "")
                      .join("・")}
                    曜日
                  </div>
                </div>
              ) : null;
            })()}
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] text-theme-text-muted-strong">
                  登録済みメンバー（複数選択可）
                </div>
                {members.length > 5 && (
                  <input
                    type="search"
                    placeholder="メンバー名で検索..."
                    value={selectionMemberSearch}
                    onChange={(e) => setSelectionMemberSearch(e.target.value)}
                    className="w-full rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-2 py-1.5 text-[11px] mb-1.5 placeholder:text-theme-text-muted"
                    aria-label="メンバーを検索"
                  />
                )}
                <div className="flex flex-wrap gap-1">
                  {(selectionMemberSearch.trim()
                    ? members.filter((m) =>
                        m.name.toLowerCase().includes(selectionMemberSearch.trim().toLowerCase())
                      )
                    : members
                  ).map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        selectedMemberIds.includes(m.id)
                          ? "bg-accent border-accent text-white"
                          : "bg-theme-bg-input border-theme-border text-theme-text"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-theme-text-muted-strong">
                  確定休日（曜日）
                </div>
                <p className="text-[10px] text-theme-text-muted mb-1.5">
                  選択した曜日は休日として登録されます
                </p>
                <div className="flex gap-1">
                  {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleSelectionHolidayWeekday(i)}
                      className={`w-7 h-7 rounded-full text-[10px] font-medium border transition-colors ${
                        selectionHolidayWeekdays.includes(i)
                          ? "bg-accent border-accent text-white"
                          : "bg-theme-bg-input text-theme-text border-theme-border hover:bg-theme-bg-elevated"
                      }`}
                      title={selectionHolidayWeekdays.includes(i) ? `${label}曜日を休日に設定（クリックで解除）` : `${label}曜日を休日に設定`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className="mt-1.5 min-h-[1.25rem] text-[10px]">
                  {selectionHolidayWeekdays.length > 0 ? (
                    <span className="text-accent">
                      選択中: {selectionHolidayWeekdays.map((i) => ["日", "月", "火", "水", "木", "金", "土"][i]).join(", ")}
                    </span>
                  ) : (
                    <span className="invisible" aria-hidden>選択中: —</span>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-1.5">
                <button
                  type="button"
                  onClick={() => setSelectionModalClosing(true)}
                  className="px-2 py-1 rounded-md border border-theme-border text-[11px]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={applySelection}
                  className="px-2 py-1 rounded-md bg-accent text-[11px] font-medium"
                >
                  確定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {!embedded && showBulkAssignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button
            type="button"
            className={`absolute inset-0 bg-black/50 transition-opacity duration-200 ${
              bulkAssignModalClosing || !bulkAssignModalAnimatingIn ? "opacity-0" : "opacity-100"
            }`}
            aria-label="閉じる"
            onClick={closeBulkAssignModal}
          />
          <div
            className={`relative w-full max-w-[500px] max-h-[90vh] overflow-y-auto rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg p-3 text-xs transition-all duration-200 ease-out ${
              bulkAssignModalClosing || !bulkAssignModalAnimatingIn
                ? "opacity-0 scale-95 translate-y-2"
                : "opacity-100 scale-100 translate-y-0"
            }`}
          >
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">期間まとめて配置</div>
                <div className="text-[11px] text-theme-text-muted mt-0.5">
                  作業班、期間、メンバー、休日を選択して一括で配置
                </div>
              </div>
              <button
                type="button"
                onClick={closeBulkAssignModal}
                className="text-theme-text-muted hover:text-theme-text text-sm"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">作業班</label>
                <select
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-1 py-1 text-[11px]"
                  value={modalWorkLineId}
                  onChange={async (e) => {
                    const value = e.target.value;
                    setModalWorkLineId(value);
                    const merged = mergedWorkLines.find((m) => m.id === value);
                    const wl = merged
                      ? workLines.find((l) => merged.workLineIds.includes(l.id))
                      : workLines.find((line) => line.id === value);
                    if (wl) {
                      const proj = projects.find((p) => p.id === wl.projectId);
                      if (proj) {
                        if (proj.defaultHolidayWeekdays && proj.defaultHolidayWeekdays.length > 0) {
                          setModalHolidayWeekdays(proj.defaultHolidayWeekdays);
                        }
                        try {
                          const defaultIds = await getProjectDefaultMemberIds(proj.id);
                          if (defaultIds.length > 0) {
                            setModalMemberIds(defaultIds);
                          }
                        } catch {
                          // 既定メンバー取得失敗時はそのまま
                        }
                      }
                    }
                  }}
                >
                  <option value="">選択してください</option>
                  {mergedWorkLines.map((line) => (
                    <option key={line.id} value={line.id}>
                      {line.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">期間</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="flex-1 rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-2 py-1 text-[11px]"
                    value={modalRangeStart}
                    onChange={(e) => setModalRangeStart(e.target.value)}
                  />
                  <span className="text-theme-text-muted">〜</span>
                  <input
                    type="date"
                    className="flex-1 rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-2 py-1 text-[11px]"
                    value={modalRangeEnd}
                    onChange={(e) => setModalRangeEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">対象メンバー（複数選択可）</label>
                {members.length > 5 && (
                  <input
                    type="search"
                    placeholder="メンバー名で検索..."
                    value={bulkMemberSearch}
                    onChange={(e) => setBulkMemberSearch(e.target.value)}
                    className="w-full rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-2 py-1.5 text-[11px] mb-1.5 placeholder:text-theme-text-muted"
                    aria-label="メンバーを検索"
                  />
                )}
                {isMobile ? (
                  <>
                    {/* サマリー表示（2〜3名 + 残りは +数字） */}
                    <div className="flex flex-wrap items-center gap-1 mb-1">
                      {(() => {
                        const selected = members.filter((m) =>
                          modalMemberIds.includes(m.id)
                        );
                        const MAX_SUMMARY = 3;
                        const summary = selected.slice(0, MAX_SUMMARY);
                        const remaining = selected.length - summary.length;

                        return (
                          <>
                            {summary.map((m) => (
                              <button
                                key={m.id}
                                type="button"
                                onClick={() => toggleModalMember(m.id)}
                                title={m.name}
                                className="px-2 py-1 rounded-full border border-theme-border bg-theme-bg-input text-theme-text text-[11px]"
                              >
                                {getMemberShortName(m.name)}
                              </button>
                            ))}
                            {remaining > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowModalMemberPickerMobile((prev) => !prev)
                                }
                                className="px-2 py-1 rounded-full border border-theme-border bg-theme-bg-elevated text-theme-text text-[11px]"
                                title="他のメンバーを表示"
                              >
                                +{remaining}
                              </button>
                            )}
                            {selected.length === 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowModalMemberPickerMobile((prev) => !prev)
                                }
                                className="px-2 py-1 rounded-full border border-theme-border bg-theme-bg-elevated text-theme-text text-[11px]"
                              >
                                メンバーを選択
                              </button>
                            )}
                          </>
                        );
                      })()}
                    </div>
                    {/* 折りたたみ可能な全メンバー一覧 */}
                    {showModalMemberPickerMobile && (
                      <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-theme-bg-elevated/50 rounded-md">
                        {(bulkMemberSearch.trim()
                          ? members.filter((m) =>
                              m.name.toLowerCase().includes(bulkMemberSearch.trim().toLowerCase())
                            )
                          : members
                        ).map((m) => (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => toggleModalMember(m.id)}
                            title={m.name}
                            className={`px-2 py-1 rounded-full border text-[11px] ${
                              modalMemberIds.includes(m.id)
                                ? "bg-accent border-accent text-white"
                                : "bg-theme-bg-input border-theme-border text-theme-text"
                            }`}
                          >
                            {getMemberShortName(m.name)}
                          </button>
                        ))}
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-theme-bg-elevated/50 rounded-md">
                    {(bulkMemberSearch.trim()
                      ? members.filter((m) =>
                          m.name.toLowerCase().includes(bulkMemberSearch.trim().toLowerCase())
                        )
                      : members
                    ).map((m) => (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => toggleModalMember(m.id)}
                        title={m.name}
                        className={`px-2 py-1 rounded-full border text-[11px] ${
                          modalMemberIds.includes(m.id)
                            ? "bg-accent border-accent text-white"
                            : "bg-theme-bg-input border-theme-border text-theme-text"
                        }`}
                      >
                        {m.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">確定休日（曜日）</label>
                <div className="flex gap-1">
                  {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleModalHolidayWeekday(i)}
                      className={`w-7 h-7 rounded-full text-[10px] border ${
                        modalHolidayWeekdays.includes(i)
                          ? "bg-theme-card text-theme-text border-theme-border"
                          : "bg-theme-bg-input text-theme-text border-theme-border"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-1.5 pt-1.5 border-t border-theme-border">
                <button
                  type="button"
                  onClick={closeBulkAssignModal}
                  className="px-2.5 py-1 rounded-md border border-theme-border text-theme-text text-[11px] hover:bg-theme-bg-elevated"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={applyBulkAssignFromModal}
                  disabled={
                    !modalWorkLineId ||
                    !modalRangeStart ||
                    !modalRangeEnd ||
                    modalMemberIds.length === 0
                  }
                  className="px-2.5 py-1 rounded-md bg-accent text-[11px] font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  確定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
    </AuthGuard>
  );
}

export default function SchedulePage() {
  const pathname = usePathname();
  const embedded = pathname === "/dashboard";
  return <SchedulePageInner embedded={embedded} />;
}
