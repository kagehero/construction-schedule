"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { addDays, format, eachDayOfInterval, parseISO } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import type {
  Assignment,
  WorkLine,
  Member,
  DaySiteStatus
} from "@/domain/schedule/types";
import { createAssignmentsForRange } from "@/domain/schedule/service";

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

const mockLines: WorkLine[] = [
  { id: "l1", projectId: "p1", name: "堀川班", color: "#3b82f6" },
  { id: "l2", projectId: "p1", name: "辻班", color: "#f97316" },
  { id: "l3", projectId: "p1", name: "橋本班", color: "#22c55e" },
  { id: "l4", projectId: "p1", name: "小原班", color: "#eab308" }
];

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
  const [rangeStart, setRangeStart] = useState<string>("");
  const [rangeEnd, setRangeEnd] = useState<string>("");
  const [selectedWorkLineId, setSelectedWorkLineId] = useState<string>("");
  const [filteredWorkLineId, setFilteredWorkLineId] = useState<string>(""); // テーブル表示用のフィルター
  const [holidayWeekdays, setHolidayWeekdays] = useState<number[]>([]);
  const [selectionHolidayWeekdays, setSelectionHolidayWeekdays] = useState<
    number[]
  >([]);
  const [dayStatuses, setDayStatuses] = useState<DaySiteStatus[]>([]);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState<number>(0);
  const [showBulkAssignModal, setShowBulkAssignModal] = useState(false);
  const [modalWorkLineId, setModalWorkLineId] = useState<string>("");
  const [modalRangeStart, setModalRangeStart] = useState<string>("");
  const [modalRangeEnd, setModalRangeEnd] = useState<string>("");
  const [modalMemberIds, setModalMemberIds] = useState<string[]>([]);
  const [modalHolidayWeekdays, setModalHolidayWeekdays] = useState<number[]>([]);

  const isAdmin = CURRENT_USER_ROLE === "admin";

  // 表示するワークグループをフィルタリング
  const displayedLines = useMemo(() => {
    if (!filteredWorkLineId) return mockLines;
    return mockLines.filter((line) => line.id === filteredWorkLineId);
  }, [filteredWorkLineId]);

  const scrollToNextWeek = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = containerWidth > 0 ? (containerWidth - 128) / 7 * 7 : 0;
      scrollContainerRef.current.scrollBy({ left: scrollAmount, behavior: 'smooth' });
    }
  };

  const scrollToPrevWeek = () => {
    if (scrollContainerRef.current) {
      const scrollAmount = containerWidth > 0 ? (containerWidth - 128) / 7 * 7 : 0;
      scrollContainerRef.current.scrollBy({ left: -scrollAmount, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    const updateWidth = () => {
      if (scrollContainerRef.current?.parentElement) {
        const parentElement = scrollContainerRef.current.parentElement;
        const parentWidth = parentElement.clientWidth;
        // Account for padding (p-4 = 1rem = 16px on each side)
        const availableWidth = parentWidth - 32;
        setContainerWidth(availableWidth > 0 ? availableWidth : parentWidth);
      }
    };

    // Use a small delay to ensure DOM is ready
    const timer = setTimeout(updateWidth, 100);
    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => {
      clearTimeout(timer);
      window.removeEventListener('resize', updateWidth);
    };
  }, []);

  // 開始日と終了日が設定されている場合はその期間全体、そうでない場合は7日分を表示
  const days = useMemo(() => {
    if (rangeStart && rangeEnd) {
      try {
        const start = parseISO(rangeStart);
        const end = parseISO(rangeEnd);
        const dayArray = eachDayOfInterval({ start, end });
        return dayArray.map((d) => ({
          date: d,
          iso: d.toISOString().slice(0, 10)
        }));
      } catch {
        // 日付が無効な場合はフォールバック
        return Array.from({ length: DAYS_VISIBLE_IN_VIEWPORT }, (_, i) => {
          const d = addDays(baseDate, i);
          return {
            date: d,
            iso: d.toISOString().slice(0, 10)
          };
        });
      }
    }
    // 期間が設定されていない場合は7日分を表示
    return Array.from({ length: DAYS_VISIBLE_IN_VIEWPORT }, (_, i) => {
      const d = addDays(baseDate, i);
      return {
        date: d,
        iso: d.toISOString().slice(0, 10)
      };
    });
  }, [baseDate, rangeStart, rangeEnd]);

  const isCellLocked = (workLineId: string, iso: string) =>
    dayStatuses.some(
      (s) => s.workLineId === workLineId && s.date === iso && s.isLocked
    );

  const toggleLock = (workLineId: string, iso: string) => {
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
    if (!isAdmin || isCellLocked(workLineId, iso)) return;
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
    if (!isAdmin) return;
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
    if (!isAdmin) return;
    const finalWorkLineId = workLineId ?? selectedWorkLineId;
    const finalStartDate = startDate ?? rangeStart;
    const finalEndDate = endDate ?? rangeEnd;
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
    setModalRangeStart(rangeStart);
    setModalRangeEnd(rangeEnd);
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
                {mockLines.map((line) => (
                  <option key={line.id} value={line.id}>
                    {line.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <div>
                <label className="block mb-1">開始日</label>
                <input
                  type="date"
                  className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1"
                  value={rangeStart}
                  onChange={(e) => setRangeStart(e.target.value)}
                />
              </div>
              <span className="mt-6">〜</span>
              <div>
                <label className="block mb-1">終了日</label>
                <input
                  type="date"
                  className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1"
                  value={rangeEnd}
                  onChange={(e) => setRangeEnd(e.target.value)}
                />
              </div>
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
        <Card title="工程表" className="text-xs overflow-hidden">
          <div className="flex items-center gap-2 mb-2">
            <button
              type="button"
              onClick={scrollToPrevWeek}
              disabled={days.length <= 7}
              className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              ← 前の週
            </button>
            <button
              type="button"
              onClick={scrollToNextWeek}
              disabled={days.length <= 7}
              className="px-3 py-1 rounded-md bg-slate-800 border border-slate-700 text-xs hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              次の週 →
            </button>
            <span className="text-xs text-slate-400 ml-auto">
              {days.length > 7 ? `${days.length}日間（横スクロールで全期間を表示）` : `${days.length}日間`}
            </span>
          </div>
          <div 
            ref={scrollContainerRef}
            className="overflow-x-auto overflow-y-auto h-[calc(100vh-250px)]"
            style={{ 
              width: '100%',
              scrollbarWidth: 'thin',
              scrollbarColor: '#475569 #1e293b'
            }}
          >
            <table className="border-collapse text-[11px] table-fixed" style={{ 
              width: days.length > 0 && containerWidth > 0
                ? `${128 + ((containerWidth - 128) / 7 * days.length)}px` 
                : '100%',
              minWidth: containerWidth > 0 ? `${128 + ((containerWidth - 128) / 7 * 7)}px` : '100%'
            }}>
              <colgroup>
                <col style={{ width: '128px' }} />
                {days.map((_, index) => {
                  const columnWidth = containerWidth > 0 
                    ? `${(containerWidth - 128) / 7}px` 
                    : 'calc((100% - 128px) / 7)';
                  return (
                    <col key={`col-${index}`} style={{ width: columnWidth }} />
                  );
                })}
              </colgroup>
              <thead>
                <tr className="sticky top-0 bg-slate-900 z-10">
                  <th className="sticky left-0 z-20 border-b border-r border-slate-700 px-2 py-1 text-left bg-slate-900">
                    班
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.iso}
                      className="border-b border-l border-slate-700 px-1 py-1 text-center overflow-hidden"
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
                {displayedLines.map((line) => {
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
                          className="border-t border-l border-slate-800 align-top overflow-hidden"
                          style={{ maxWidth: 0 }}
                        >
                          <div className="w-full h-16 px-1.5 py-1 flex flex-col gap-1 overflow-hidden">
                            <div className="flex items-center justify-between text-[9px] text-slate-500 min-w-0">
                              {locked && (
                                <span className="inline-flex items-center gap-0.5 flex-shrink-0">
                                  <span>🔒</span>
                                  <span>確定</span>
                                </span>
                              )}
                              {isAdmin && (
                                <button
                                  type="button"
                                  onClick={() => toggleLock(line.id, iso)}
                                  className="ml-auto px-1 py-0.5 rounded border border-slate-600 hover:bg-slate-800 text-[9px] flex-shrink-0 whitespace-nowrap"
                                >
                                  {locked ? "ロック解除" : "この日を確定"}
                                </button>
                              )}
                            </div>
                            <button
                              type="button"
                              onClick={() => openSelection(line.id, iso)}
                              disabled={!isAdmin || locked}
                              className={`w-full flex-1 px-1.5 py-1 text-left rounded min-w-0 overflow-hidden ${
                                !isAdmin || locked
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
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {selection && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="w-[420px] rounded-xl bg-slate-900 border border-slate-700 shadow-lg p-4 text-xs">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-semibold">人員選択</div>
                <div className="text-[11px] text-slate-400 mt-0.5">
                  {selection.date} /{" "}
                  {mockLines.find((l) => l.id === selection.workLineId)?.name}
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
                  {mockLines.map((line) => (
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
  );
}


