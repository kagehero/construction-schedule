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
import { getWorkLines } from "@/lib/supabase/schedule";
import { getProjects } from "@/lib/supabase/projects";
import type { Project } from "@/domain/projects/types";

const mockMembers: Member[] = [
  { id: "m1", name: "寺道雅気" },
  { id: "m2", name: "寺道隆浩" },
  { id: "m3", name: "大和優士" },
  { id: "m4", name: "岡崎永遠" },
  { id: "m5", name: "黒澤健二" },
  { id: "m6", name: "安田零唯" },
  { id: "m7", name: "林工業(大橋)" },
  { id: "m8", name: "林工業(中嶋)" },
  { id: "m9", name: "フジシン(立松)" },
  { id: "m10", name: "YNP(土屋)" },
  { id: "m11", name: "YNP(大野)" },
  { id: "m12", name: "YNP(長谷部)" },
  { id: "m13", name: "藤工業(田中)" }
];

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
  const [isLoadingData, setIsLoadingData] = useState(true);
  const [slideDirection, setSlideDirection] = useState<'left' | 'right' | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showProjectModal, setShowProjectModal] = useState(false);

  const { isAdmin, signOut, profile } = useAuth();

  // Load work lines and projects from database
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoadingData(true);
        const [lines, projs] = await Promise.all([
          getWorkLines(),
          getProjects()
        ]);
        setWorkLines(lines);
        setProjects(projs);
      } catch (error) {
        console.error("Failed to load data:", error);
        toast.error("データの読み込みに失敗しました。");
      } finally {
        setIsLoadingData(false);
      }
    };
    loadData();
  }, []);

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

  const applySelection = () => {
    if (!isAdmin) {
      toast.error('この操作は管理者のみ実行できます。閲覧者権限では編集操作はできません。');
      return;
    }
    if (!selection) return;
    const { workLineId, date } = selection;
    const selectedDate = new Date(date);
    const weekday = selectedDate.getDay();
    const isHoliday = selectionHolidayWeekdays.includes(weekday);
    
    setAssignments((prev) => {
      const filtered = prev.filter(
        (a) => !(a.workLineId === workLineId && a.date === date)
      );
      const added: Assignment[] = selectedMemberIds.map((memberId) => ({
        id: `${workLineId}_${memberId}_${date}`,
        workLineId,
        date,
        memberId,
        isHoliday,
        isConfirmed: false
      }));
      return [...filtered, ...added];
    });
    setSelection(null);
  };

  const handleBulkAssign = (
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
    const created = createAssignmentsForRange({
      workLineId: finalWorkLineId,
      memberIds: finalMemberIds,
      startDate: finalStartDate,
      endDate: finalEndDate,
      holidayWeekdays: finalHolidayWeekdays
    });
    setAssignments((prev) => {
      const keys = new Set(created.map((c) => `${c.workLineId}-${c.date}`));
      const filtered = prev.filter(
        (a) => !keys.has(`${a.workLineId}-${a.date}`)
      );
      return [...filtered, ...created];
    });
  };

  const openBulkAssignModal = () => {
    setShowBulkAssignModal(true);
    // モーダルを開くときに現在の値を初期値として設定
    setModalWorkLineId(selectedWorkLineId);
    // 現在表示している週の開始日と終了日を初期値として設定
    const weekStart = format(currentWeekStart, "yyyy-MM-dd");
    const weekEnd = format(addDays(currentWeekStart, 6), "yyyy-MM-dd");
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

  return (
    <AuthGuard>
    <div className="h-screen flex flex-col">
      <header className="px-6 py-3 border-b border-slate-800 flex items-center justify-between">
        <div className="flex items-baseline gap-4">
          <h1 className="text-lg font-semibold">工程・人員配置</h1>
          <span className="text-xs text-slate-400">
            工程 × 日付 × 人員を一画面で直感的に操作
          </span>
        </div>
        <div className="flex items-center gap-2 text-[11px]">
          <span className="px-2 py-0.5 rounded-full border border-slate-600 text-slate-200">
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
                  className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px]"
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
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px]"
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
              <label className="block mb-1">対象メンバー（複数選択）</label>
              <div className="flex flex-wrap gap-1">
                {mockMembers.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleMember(m.id)}
                    className={`px-2 py-1 rounded-full border text-[11px] ${
                      selectedMemberIds.includes(m.id)
                        ? "bg-accent border-accent text-white"
                        : "bg-slate-900 border-slate-700 text-slate-200"
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
                        ? "bg-slate-100 text-slate-900 border-slate-100"
                        : "bg-slate-900 text-slate-100 border-slate-700"
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
              className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              ← 前の週
            </button>
            <button
              type="button"
              onClick={goToToday}
              disabled={isAnimating}
              className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              今週に戻る
            </button>
            <button
              type="button"
              onClick={goToNextWeek}
              disabled={isAnimating}
              className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity"
            >
              次の週 →
            </button>
            <span className="text-xs text-slate-400 ml-auto">
              {days.length > 0 && (
                <>
                  {format(days[0].date, "yyyy年MM月dd日", { locale: ja })} 〜 {format(days[days.length - 1].date, "yyyy年MM月dd日", { locale: ja })}
                </>
              )}
            </span>
          </div>
          <div 
            className="overflow-y-auto h-[calc(100vh-250px)]"
            style={{ 
              width: '100%',
              scrollbarWidth: 'thin',
              scrollbarColor: '#475569 #1e293b'
            }}
          >
            <table className="border-collapse text-[11px] w-full" style={{ minHeight: '280px' }}>
              <colgroup>
                <col style={{ width: '128px' }} />
                {days.map((_, index) => (
                  <col key={`col-${index}`} />
                ))}
              </colgroup>
              <thead>
                <tr className="sticky top-0 bg-slate-900 z-10">
                  <th className="sticky left-0 z-20 border-b border-r border-slate-700 px-2 py-1 text-left bg-slate-900">
                    班
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.iso}
                      className={`border-b border-l border-slate-700 px-1 py-1 text-center overflow-hidden transition-all duration-300 ease-in-out ${
                        slideDirection === 'left' 
                          ? 'translate-x-[-100%] opacity-0' 
                          : slideDirection === 'right' 
                          ? 'translate-x-[100%] opacity-0' 
                          : 'translate-x-0 opacity-100'
                      }`}
                      style={{ maxWidth: 0 }}
                    >
                      <div className="truncate">{format(d.date, "MM/dd", { locale: ja })}</div>
                      <div className="text-[10px] text-slate-400 truncate">
                        {format(d.date, "E", { locale: ja })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoadingData ? (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center py-4 text-slate-400">
                      データを読み込み中...
                    </td>
                  </tr>
                ) : displayedLines.length === 0 ? (
                  <tr>
                    <td colSpan={days.length + 1} className="text-center py-4 text-slate-400">
                      作業グループが登録されていません。案件登録ページで作業グループを設定してください。
                    </td>
                  </tr>
                ) : (
                  displayedLines.map((line) => {
                  const isSelected = filteredWorkLineId === line.id;
                  return (
                    <tr key={line.id} className={isSelected ? "bg-slate-800/30" : ""}>
                      <td className={`sticky left-0 z-10 border-t border-r border-slate-700 px-2 py-2 text-left align-top overflow-hidden ${
                        isSelected ? "bg-slate-800/50" : "bg-slate-900/60"
                      }`}>
                        <div className="flex items-center gap-2 min-w-0">
                        <span
                            className="inline-block w-1.5 h-8 rounded-full flex-shrink-0"
                          style={{ backgroundColor: line.color }}
                        />
                          <span className={`text-xs truncate ${isSelected ? "font-semibold" : ""}`}>
                            {line.name}
                          </span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const iso = d.iso;
                      const cellAssignments = getCellAssignments(line.id, iso);
                      const locked = isCellLocked(line.id, iso);
                      return (
                        <td
                          key={iso}
                          className={`border-t border-l border-slate-800 align-top overflow-hidden transition-all duration-300 ease-in-out ${
                            slideDirection === 'left' 
                              ? 'translate-x-[-100%] opacity-0' 
                              : slideDirection === 'right' 
                              ? 'translate-x-[100%] opacity-0' 
                              : 'translate-x-0 opacity-100'
                          }`}
                          style={{ maxWidth: 0 }}
                        >
                          <div className="w-full min-h-[100px] px-1.5 py-1.5 flex flex-col gap-1.5 overflow-hidden">
                            {/* 案件名表示 */}
                            {(() => {
                              const project = getProjectForWorkLine(line.id, iso);
                              return project ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedProject(project);
                                    setShowProjectModal(true);
                                  }}
                                  className="text-[11px] text-accent font-semibold truncate bg-accent/10 hover:bg-accent/20 border border-accent/30 rounded px-2 py-1 text-left w-full transition-colors flex-shrink-0"
                                  title={`${project.siteName} - クリックで詳細を表示`}
                                >
                                  📋 {project.siteName}
                                </button>
                              ) : null;
                            })()}
                          <button
                            type="button"
                              onClick={() => {
                                if (locked) return;
                                openSelection(line.id, iso);
                              }}
                              disabled={locked}
                              className={`w-full flex-1 px-1.5 py-1 text-left rounded min-w-0 overflow-hidden min-h-[40px] ${
                                locked
                                  ? "bg-slate-900/40 text-slate-500 cursor-not-allowed"
                                  : "hover:bg-slate-800/60"
                              }`}
                          >
                              <div className="flex flex-wrap gap-1 min-w-0 items-center">
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
                                          mockMembers.find(
                                            (m) => m.id === a.memberId
                                          ) ?? mockMembers[0];
                                return (
                                  <span
                                    key={a.id}
                                            title={member.name}
                                            className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-600 bg-slate-900 text-[10px] flex-shrink-0"
                                  >
                                            {getMemberShortName(member.name)}
                                  </span>
                                );
                              })}
                                      {remainingCount > 0 && (
                                        <span 
                                          className="inline-flex items-center justify-center min-w-[24px] h-6 px-1.5 rounded-full border border-slate-600 bg-slate-800 text-[10px] text-slate-300 flex-shrink-0"
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
                          
                            <div className="flex items-center justify-end text-[9px] text-slate-500 min-w-0 flex-shrink-0">
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleLock(line.id, iso);
                                  }}
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-xs transition-all hover:scale-110 flex-shrink-0 ${
                                    locked
                                      ? "bg-accent/20 text-accent border border-accent/50 hover:bg-accent/30"
                                      : "bg-slate-800/60 text-slate-400 border border-slate-600 hover:bg-slate-700 hover:text-slate-200"
                                  }`}
                                  title={locked ? "ロック解除" : "この日を確定"}
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
            </table>
          </div>
        </Card>
      </div>

      {/* 案件詳細モーダル */}
      {showProjectModal && selectedProject && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setShowProjectModal(false)}>
          <div className="w-[500px] rounded-xl bg-slate-900 border border-slate-700 shadow-lg p-6 text-sm" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">案件詳細</h3>
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="text-slate-400 hover:text-slate-100 text-xl"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">現場名</label>
                <div className="text-sm font-semibold text-accent">{selectedProject.siteName}</div>
              </div>
              {selectedProject.title && selectedProject.title !== selectedProject.siteName && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">タイトル</label>
                  <div className="text-sm">{selectedProject.title}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 block mb-1">取引先会社名</label>
                <div className="text-sm">{selectedProject.customerName}</div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">契約形態</label>
                <div className="text-sm">
                  <span className="inline-flex items-center px-2 py-0.5 rounded bg-slate-800">
                    {selectedProject.contractType}
                  </span>
                </div>
              </div>
              {selectedProject.contractAmount && (
                <div>
                  <label className="text-xs text-slate-400 block mb-1">請負金額</label>
                  <div className="text-sm">¥{selectedProject.contractAmount.toLocaleString()}</div>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 block mb-1">現場住所</label>
                <div className="text-sm">{selectedProject.siteAddress}</div>
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">工期</label>
                <div className="text-sm">
                  {format(new Date(selectedProject.startDate), "yyyy年MM月dd日", { locale: ja })} 〜 {format(new Date(selectedProject.endDate), "yyyy年MM月dd日", { locale: ja })}
                </div>
              </div>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => setShowProjectModal(false)}
                className="px-4 py-2 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700"
              >
                閉じる
              </button>
            </div>
          </div>
        </div>
      )}

      {selection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[420px] rounded-xl bg-slate-900 border border-slate-700 shadow-lg p-4 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">人員選択</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {selection.date} /{" "}
                  {workLines.find((l) => l.id === selection.workLineId)?.name}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelection(null)}
                className="text-slate-400 hover:text-slate-100 text-sm"
              >
                ×
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <div className="mb-1 text-[11px] text-slate-300">
                  登録済みメンバー（複数選択可）
                </div>
                <div className="flex flex-wrap gap-1">
                  {mockMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleMember(m.id)}
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        selectedMemberIds.includes(m.id)
                          ? "bg-accent border-accent text-white"
                          : "bg-slate-900 border-slate-700 text-slate-200"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="mb-1 text-[11px] text-slate-300">
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
                          ? "bg-slate-100 text-slate-900 border-slate-100"
                          : "bg-slate-900 text-slate-100 border-slate-700"
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
                  className="px-3 py-1 rounded-md border border-slate-600 text-[11px]"
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
          <div className="w-[500px] rounded-xl bg-slate-900 border border-slate-700 shadow-lg p-4 text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <div className="text-sm font-semibold">期間まとめて配置</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  作業班、期間、メンバー、休日を選択して一括で配置
                </div>
              </div>
              <button
                type="button"
                onClick={closeBulkAssignModal}
                className="text-slate-400 hover:text-slate-100 text-sm"
              >
                ×
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block mb-1 text-[11px] text-slate-300">作業班</label>
                <select
                  className="w-full rounded-md bg-slate-800 border border-slate-700 px-3 py-2 text-[11px]"
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
                <label className="block mb-1 text-[11px] text-slate-300">期間</label>
                <div className="flex items-center gap-2">
                  <input
                    type="date"
                    className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2"
                    value={modalRangeStart}
                    onChange={(e) => setModalRangeStart(e.target.value)}
                  />
                  <span className="text-slate-400">〜</span>
                  <input
                    type="date"
                    className="flex-1 rounded-md bg-slate-800 border border-slate-700 px-3 py-2"
                    value={modalRangeEnd}
                    onChange={(e) => setModalRangeEnd(e.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-slate-300">対象メンバー（複数選択可）</label>
                <div className="flex flex-wrap gap-1 max-h-32 overflow-y-auto p-2 bg-slate-800/50 rounded-md">
                  {mockMembers.map((m) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => toggleModalMember(m.id)}
                      className={`px-2 py-1 rounded-full border text-[11px] ${
                        modalMemberIds.includes(m.id)
                          ? "bg-accent border-accent text-white"
                          : "bg-slate-900 border-slate-700 text-slate-200"
                      }`}
                    >
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block mb-1 text-[11px] text-slate-300">確定休日（曜日）</label>
                <div className="flex gap-1">
                  {["日", "月", "火", "水", "木", "金", "土"].map((label, i) => (
                    <button
                      key={label}
                      type="button"
                      onClick={() => toggleModalHolidayWeekday(i)}
                      className={`w-8 h-8 rounded-full text-[11px] border ${
                        modalHolidayWeekdays.includes(i)
                          ? "bg-slate-100 text-slate-900 border-slate-100"
                          : "bg-slate-900 text-slate-100 border-slate-700"
                      }`}
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-700">
                <button
                  type="button"
                  onClick={closeBulkAssignModal}
                  className="px-4 py-2 rounded-md border border-slate-600 text-[11px] hover:bg-slate-800"
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


