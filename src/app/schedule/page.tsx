"use client";

import { useMemo, useState, useEffect } from "react";
import { addDays, format } from "date-fns";
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
import { getWorkLines, getAssignments, createAssignments, deleteAssignments, getMembers } from "@/lib/supabase/schedule";
import { getProjects } from "@/lib/supabase/projects";
import type { Project } from "@/domain/projects/types";

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

// mockLinesは削除し、データベースから取得する

const DAYS_VISIBLE_IN_VIEWPORT = 7; // 画面に表示する日数
const ROWS_VISIBLE_IN_VIEWPORT = 4; // 1画面に表示する作業班の行数
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

export default function SchedulePage() {
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
  const [selectionHolidayWeekdays, setSelectionHolidayWeekdays] = useState<
    number[]
  >([]);
  const [dayStatuses, setDayStatuses] = useState<DaySiteStatus[]>([]);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [modalWorkLineId, setModalWorkLineId] = useState<string>("");
  const [modalRangeStart, setModalRangeStart] = useState<string>("");
  const [modalRangeEnd, setModalRangeEnd] = useState<string>("");
  const [modalMemberIds, setModalMemberIds] = useState<string[]>([]);
  const [modalHolidayWeekdays, setModalHolidayWeekdays] = useState<number[]>([]);
  const [workLines, setWorkLines] = useState<WorkLine[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [members, setMembers] = useState<Member[]>([]);
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const { isAdmin, signOut, profile } = useAuth();

  // Load work lines, projects, and members from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true);
        const [lines, projs, membersData] = await Promise.all([
          getWorkLines(),
          getProjects(),
          getMembers()
        ]);
        setWorkLines(lines);
        setProjects(projs);
        setMembers(membersData);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("データの読み込みに失敗しました。");
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
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

  // 表示するワークグループをフィルタリング
  const displayedLines = useMemo(() => {
    if (!filteredWorkLineId) return workLines;
    return workLines.filter((line) => line.id === filteredWorkLineId);
  }, [filteredWorkLineId, workLines]);

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


  // 常に7日分（1週間）を表示
  const days = useMemo(() => {
    return Array.from({ length: DAYS_VISIBLE_IN_VIEWPORT }, (_, i) => {
      const d = addDays(currentWeekStart, i);
      return {
        date: d,
        iso: d.toISOString().slice(0, 10)
      };
    });
  }, [currentWeekStart]);

  const isCellLocked = (workLineId: string, iso: string) =>
    dayStatuses.some(
      (s) => s.workLineId === workLineId && s.date === iso && s.isLocked
    );

  const toggleLock = (workLineId: string, iso: string) => {
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

  const openSelection = (workLineId: string, iso: string) => {
    if (isCellLocked(workLineId, iso)) return;
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    setSelection({ workLineId, date: iso });
    const current = assignments.filter(
      (a) => a.workLineId === workLineId && a.date === iso && !a.isHoliday
    );
    setSelectedMemberIds(current.map((c) => c.memberId));
    // Reset selection holiday weekdays when opening modal
    setSelectionHolidayWeekdays([]);
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
      setSelection(null);
    } catch (error: any) {
      console.error("Failed to save assignments:", error);
      const errorMessage = error?.message || error?.details || "メンバーの割り当ての保存に失敗しました。";
      toast.error(`エラー: ${errorMessage}`);
    }
  };

  const handleBulkAssign = async (
    workLineId?: string,
    startDate?: string,
    endDate?: string,
    memberIds?: string[],
    holidayWeekdaysParam?: number[]
  ) => {
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    const finalWorkLineId = workLineId ?? selectedWorkLineId;
    const finalStartDate = startDate ?? modalRangeStart;
    const finalEndDate = endDate ?? modalRangeEnd;
    const finalMemberIds = memberIds ?? selectedMemberIds;
    const finalHolidayWeekdays = holidayWeekdaysParam ?? holidayWeekdays;

    if (
      !finalStartDate ||
      !finalEndDate ||
      finalMemberIds.length === 0 ||
      !finalWorkLineId
    )
      return;
    
    // Validate member IDs exist in database
    const invalidMemberIds = finalMemberIds.filter(
      (memberId) => !members.some((m) => m.id === memberId)
    );
    if (invalidMemberIds.length > 0) {
      toast.error(`無効なメンバーIDが含まれています: ${invalidMemberIds.join(', ')}`);
      return;
    }
    
    try {
      // Delete existing assignments for the date range
      const start = new Date(finalStartDate);
      const end = new Date(finalEndDate);
      const days = [];
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        days.push(format(d, "yyyy-MM-dd"));
      }
      
      // Delete assignments for each day in the range
      for (const day of days) {
        await deleteAssignments(finalWorkLineId, day);
      }
      
      // Create new assignments
      const assignmentsToCreate = createAssignmentsForRange({
        workLineId: finalWorkLineId,
        memberIds: finalMemberIds,
        startDate: finalStartDate,
        endDate: finalEndDate,
        holidayWeekdays: finalHolidayWeekdays
      });
      
      const created = await createAssignments(assignmentsToCreate);
      
      // Update local state
      setAssignments((prev) => {
        const keys = new Set(created.map((c) => `${c.workLineId}-${c.date}`));
        const filtered = prev.filter(
          (a) => !keys.has(`${a.workLineId}-${a.date}`)
        );
        return [...filtered, ...created];
      });
      
      toast.success("期間のメンバー割り当てを保存しました。");
    } catch (error: any) {
      console.error("Failed to save bulk assignments:", error);
      const errorMessage = error?.message || error?.details || "期間のメンバー割り当ての保存に失敗しました。";
      toast.error(`エラー: ${errorMessage}`);
    }
  };

  const openBulkAssignModal = () => {
    setShowBulkAssignModal(true);
    // モーダルを開くときに現在の値を初期値として設定
    setModalWorkLineId(selectedWorkLineId);
    // カードで選択した開始日・終了日があればそれを使用、なければ現在表示している週の開始日と終了日を初期値として設定
    const weekStart = rangeStartDate || format(currentWeekStart, "yyyy-MM-dd");
    const weekEnd = rangeEndDate || format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
    setModalRangeStart(weekStart);
    setModalRangeEnd(weekEnd);
    setModalMemberIds([...selectedMemberIds]);
    setModalHolidayWeekdays([...holidayWeekdays]);
  };

  const closeBulkAssignModal = () => {
    setShowBulkAssignModal(false);
  };

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
        (sum, line) => sum + getCellAssignments(line.id, d.iso).length,
        0
      );
      return { iso: d.iso, count: total };
    });
  }, [days, displayedLines, assignments]);

  return (
    <AuthGuard>
    <div className="h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-theme-border flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-semibold text-theme-text">工程・人員配置</h1>
          <span className="text-xs text-theme-text-muted">
            工程 × 日付 × 人員を一画面で直感的に操作
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full border border-theme-border text-theme-text">
            ロール:{" "}
            <span className="font-semibold">
              {isAdmin ? "管理者（編集可）" : "閲覧者（閲覧のみ）"}
            </span>
          </span>
        </div>
      </header>
      <div className="flex-1 overflow-hidden grid grid-rows-[auto_minmax(0,1fr)] gap-2 p-3">
        {/* ビューア用のフィルタリングカード */}
        {!isAdmin && (
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
                  {workLines.map((line) => (
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
        {/* 管理者用の期間まとめて配置カード */}
        {isAdmin && (
        <Card title="期間まとめて配置 / 休み設定" className="text-xs">
          <div className="flex flex-wrap items-end gap-4">
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
                <option value="">すべて表示</option>
                {workLines.map((line) => (
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
            <div>
              <label className="block mb-1">対象メンバー（複数選択）</label>
              <div className="flex flex-wrap gap-1">
                {members.map((m) => (
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
              <label className="block mb-1">確定休日（曜日）</label>
              <div className="flex gap-1">
                {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                  <button
                    key={label}
                    type="button"
                    onClick={() => toggleHolidayWeekday(i)}
                    className={`w-7 h-7 rounded-full text-[11px] border ${
                      holidayWeekdays.includes(i)
                        ? "bg-theme-card text-theme-text border-theme-border"
                        : "bg-theme-bg-input text-theme-text border-theme-border"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
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
        )}
        <Card title="工程表" className="text-xs overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
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
                  {format(days[0].date, "yyyy年MM月dd日", { locale: ja })} 〜 {format(days[days.length - 1].date, "yyyy年MM月dd日", { locale: ja })}
                </>
              )}
            </span>
          </div>
          <div 
            className="overflow-y-auto overflow-x-auto"
            style={{ 
              width: '100%',
              height: SCHEDULE_SCROLL_HEIGHT_PX,
              scrollbarWidth: 'thin',
              scrollbarColor: '#475569 #1e293b'
            }}
          >
            <table className="border-collapse text-[11px] w-full" style={{ tableLayout: 'fixed', minHeight: '280px' }} cellPadding="0" cellSpacing="0">
              <colgroup>
                <col style={{ width: '128px' }} />
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
                ) : displayedLines.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center py-4 text-theme-text-muted">
                      作業グループが登録されていません。案件登録ページで作業グループを設定してください。
                    </td>
                  </tr>
                ) : (
                  displayedLines.map((line) => {
                  const isSelected = filteredWorkLineId === line.id;
                  return (
                    <tr key={line.id} className={isSelected ? "bg-theme-bg-elevated/30" : ""} style={{ height: '110px', lineHeight: '110px' }}>
                      <td className={`sticky left-0 z-10 border-t border-r border-theme-border px-2 py-2 text-left align-top overflow-hidden ${
                        isSelected ? "bg-theme-bg-elevated/50" : "bg-theme-bg-input/60"
                      }`} style={{ height: '110px', maxHeight: '110px', verticalAlign: 'top', padding: '8px', lineHeight: 'normal' }}>
                        <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="inline-block w-1.5 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: line.color }}
                        />
                          <span className={`text-xs truncate text-theme-text ${isSelected ? "font-semibold" : ""}`}>
                            {line.name}
                          </span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const iso = d.iso;
                      const cellAssignments = getCellAssignments(line.id, iso);
                      const locked = isCellLocked(line.id, iso);
                      const project = getProjectForWorkLine(line.id, iso);
                      // 案件とメンバーが割り当てられているかチェック
                      const hasProjectAndMembers = project !== null && cellAssignments.length > 0;
                      return (
                        <td
                          key={iso}
                          className={`border-t border-l border-theme-border align-top overflow-hidden transition-all duration-300 ease-in-out ${
                            slideDirection === 'left' 
                              ? 'translate-x-[-100%] opacity-0' 
                              : slideDirection === 'right' 
                              ? 'translate-x-[100%] opacity-0' 
                              : 'translate-x-0 opacity-100'
                          }`}
                          style={{ maxWidth: 0, height: '110px', maxHeight: '110px', verticalAlign: 'top', padding: 0, lineHeight: 'normal' }}
                        >
                          <div className="w-full h-full px-1.5 py-1.5 flex flex-col gap-1 overflow-hidden" style={{ height: '110px', maxHeight: '110px', minHeight: '110px', boxSizing: 'border-box', overflow: 'hidden' }}>
                            {/* 案件名表示 */}
                            {project ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProject(project);
                                    setShowProjectModal(true);
                                  }}
                                  className="text-[11px] text-accent font-semibold truncate bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded px-2 py-0.5 text-left w-full transition-colors flex-shrink-0"
                                  title={`${project.siteName} - クリックで詳細を表示`}
                                  style={{ height: '24px', minHeight: '24px', maxHeight: '24px' }}
                                >
                                  📋 {project.siteName}
                                </button>
                              ) : null}
                          <button
                            type="button"
                              onClick={() => {
                                if (locked) return;
                                openSelection(line.id, iso);
                              }}
                              disabled={locked}
                              className={`w-full px-1.5 py-0.5 text-left rounded min-w-0 overflow-hidden ${
                                locked
                                  ? "bg-theme-bg-input/40 text-theme-text-muted cursor-not-allowed"
                                  : "hover:bg-theme-bg-elevated/60"
                              }`}
                              style={{ height: '40px', minHeight: '40px', maxHeight: '40px', flexShrink: 0, overflow: 'hidden' }}
                          >
                              <div className="flex gap-1 min-w-0 items-center overflow-hidden" style={{ height: '100%', overflow: 'hidden' }}>
                                {(() => {
                                  // 列の幅に応じて表示できる人数を計算（各バッジは約28px、gapは4px）
                                  // 保守的に5人まで表示し、残りを数字で表示
                                  const maxVisible = 5;
                                  const visibleAssignments = cellAssignments.slice(0, maxVisible);
                                  const remainingCount = cellAssignments.length - maxVisible;
                                  
                                  return (
                                    <>
                                      {visibleAssignments.map((a) => {
                                const member =
                                          members.find(
                                          (m) => m.id === a.memberId
                                          ) ?? members[0];
                                return (
                                  <span
                                    key={a.id}
                                            title={member.name}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-theme-border bg-theme-bg-input text-theme-text text-[10px] flex-shrink-0"
                                  >
                                            {getMemberShortName(member.name)}
                                  </span>
                                );
                              })}
                                      {remainingCount > 0 && (
                                        <span 
                                          className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full border border-theme-border bg-theme-bg-elevated text-[10px] text-theme-text-muted-strong flex-shrink-0"
                                          title={`他${remainingCount}名`}
                                        >
                                          +{remainingCount}
                                </span>
                              )}
                                    </>
                                  );
                                })()}
                            </div>
                          </button>
                          
                            <div className="flex items-center justify-end text-[9px] text-theme-text-muted min-w-0 flex-shrink-0" style={{ height: '24px', minHeight: '24px', maxHeight: '24px', flexShrink: 0, marginTop: 'auto' }}>
                              {isAdmin && hasProjectAndMembers && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLock(line.id, iso);
                                  }}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all hover:scale-110 flex-shrink-0 ${
                                    locked
                                      ? "bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30"
                                      : "bg-theme-bg-elevated/60 text-theme-text-muted border border-theme-border hover:bg-theme-bg-elevated-hover hover:text-theme-text"
                                  }`}
                                  title={locked ? "ロック解除" : "この日を確定"}
                                  style={{ flexShrink: 0 }}
                                >
                                  {locked ? "🔒" : "🔓"}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                  })
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

      {/* 案件詳細モーダル */}
      {showProjectModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowProjectModal(false)}>
          <div className="w-[500px] rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg p-6 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-theme-text">案件詳細</h3>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="text-theme-text-muted hover:text-theme-text text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
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
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">現場住所</label>
                <div className="text-sm">{selectedProject.siteAddress}</div>
              </div>
              <div>
                <label className="text-xs text-theme-text-muted block mb-1">工期</label>
                <div className="text-sm">
                  {format(new Date(selectedProject.startDate), "yyyy年MM月dd日", { locale: ja })} 〜 {format(new Date(selectedProject.endDate), "yyyy年MM月dd日", { locale: ja })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 rounded-md bg-theme-bg-elevated border border-theme-border text-xs hover:bg-theme-bg-elevated-hover"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {selection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[420px] rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg p-4 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">人員選択</div>
                <div className="text-[11px] text-theme-text-muted mt-0.5">
                  {selection.date} /{" "}
                  {workLines.find((l) => l.id === selection.workLineId)?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="text-theme-text-muted hover:text-theme-text text-sm"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] text-theme-text-muted-strong">
                  登録済みメンバー（複数選択可）
                </div>
                <div className="flex flex-wrap gap-1">
                  {members.map((m) => (
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
                <div className="flex gap-1">
                  {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleSelectionHolidayWeekday(i)}
                      className={`w-7 h-7 rounded-full text-[11px] border ${
                        selectionHolidayWeekdays.includes(i)
                          ? "bg-theme-card text-theme-text border-theme-border"
                          : "bg-theme-bg-input text-theme-text border-theme-border"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setSelection(null)}
                  className="px-3 py-1 rounded-md border border-theme-border text-[11px]"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  onClick={applySelection}
                  className="px-3 py-1 rounded-md bg-accent text-[11px] font-medium"
                >
                  確定
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showBulkAssignModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[500px] rounded-xl bg-theme-bg-input border border-theme-border text-theme-text shadow-lg p-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
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
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">作業班</label>
                <select
                  className="w-full rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-3 py-2 text-[11px]"
                  value={modalWorkLineId}
                  onChange={(e) => setModalWorkLineId(e.target.value)}
                >
                  <option value="">選択してください</option>
                  {workLines.map((line) => (
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
                    className="flex-1 rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-3 py-2"
                    value={modalRangeStart}
                    onChange={(e) => setModalRangeStart(e.target.value)}
                  />
                  <span className="text-theme-text-muted">〜</span>
                  <input
                    type="date"
                    className="flex-1 rounded-md bg-theme-bg-elevated border border-theme-border text-theme-text px-3 py-2"
                    value={modalRangeEnd}
                    onChange={(e) => setModalRangeEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">対象メンバー（複数選択可）</label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-theme-bg-elevated/50 rounded-md">
                  {members.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModalMember(m.id)}
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
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-theme-text-muted-strong">確定休日（曜日）</label>
                <div className="flex gap-1">
                  {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleModalHolidayWeekday(i)}
                      className={`w-8 h-8 rounded-full text-[11px] border ${
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
              <div className="flex justify-end gap-2 pt-2 border-t border-theme-border">
                <button
                  type="button"
                  onClick={closeBulkAssignModal}
                  className="px-4 py-2 rounded-md border border-theme-border text-theme-text text-[11px] hover:bg-theme-bg-elevated"
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
                  className="px-4 py-2 rounded-md bg-accent text-[11px] font-medium hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed"
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


