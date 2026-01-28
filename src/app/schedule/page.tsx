"use client";

import { useMemo, useState } from "react";
import { addDays, format } from "date-fns";
import { ja } from "date-fns/locale";
import { Card } from "@/components/ui/card";
import type { Assignment, WorkLine, Member } from "@/domain/schedule/types";
import { createAssignmentsForRange } from "@/domain/schedule/service";

const mockMembers: Member[] = [
  { id: "m1", name: "堀" },
  { id: "m2", name: "トン" },
  { id: "m3", name: "墨" },
  { id: "m4", name: "ドック" },
  { id: "m5", name: "アイン" },
  { id: "m6", name: "中山" }
];

const mockLines: WorkLine[] = [
  { id: "l1", projectId: "p1", name: "堀川班", color: "#3b82f6" },
  { id: "l2", projectId: "p1", name: "辻班", color: "#f97316" },
  { id: "l3", projectId: "p1", name: "橋本班", color: "#22c55e" },
  { id: "l4", projectId: "p1", name: "小原班", color: "#eab308" }
];

const DAYS_VISIBLE = 14;

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
  const [holidayWeekdays, setHolidayWeekdays] = useState<number[]>([]);
  const [selectionHolidayWeekdays, setSelectionHolidayWeekdays] = useState<number[]>([]);

  const days = useMemo(
    () =>
      Array.from({ length: DAYS_VISIBLE }, (_, i) => {
        const d = addDays(baseDate, i);
        return {
          date: d,
          iso: d.toISOString().slice(0, 10)
        };
      }),
    [baseDate]
  );

  const openSelection = (workLineId: string, iso: string) => {
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

  const handleBulkAssign = () => {
    if (!rangeStart || !rangeEnd || selectedMemberIds.length === 0 || !selectedWorkLineId) return;
    const created = createAssignmentsForRange({
      workLineId: selectedWorkLineId,
      memberIds: selectedMemberIds,
      startDate: rangeStart,
      endDate: rangeEnd,
      holidayWeekdays
    });
    setAssignments((prev) => {
      const keys = new Set(created.map((c) => `${c.workLineId}-${c.date}`));
      const filtered = prev.filter(
        (a) => !keys.has(`${a.workLineId}-${a.date}`)
      );
      return [...filtered, ...created];
    });
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
      </header>
      <div className="flex-1 overflow-hidden grid grid-rows-[auto_minmax(0,1fr)] gap-2 p-3">
        <Card title="期間まとめて配置 / 休み設定" className="text-xs">
          <div className="flex flex-wrap items-end gap-4">
            <div>
              <label className="block mb-1">作業班</label>
              <select
                className="rounded-md bg-slate-900 border border-slate-700 px-2 py-1 text-[11px]"
                value={selectedWorkLineId}
                onChange={(e) => setSelectedWorkLineId(e.target.value)}
              >
                <option value="">選択してください</option>
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
                onClick={handleBulkAssign}
                className="inline-flex items-center px-4 py-1.5 rounded-md bg-accent text-xs font-medium hover:brightness-110"
              >
                期間まとめて配置
              </button>
            </div>
          </div>
        </Card>
        <Card title="工程表" className="text-xs overflow-hidden">
          <div className="overflow-auto h-[calc(100vh-210px)]">
            <table className="min-w-full border-collapse text-[11px]">
              <thead>
                <tr className="sticky top-0 bg-slate-900 z-10">
                  <th className="w-32 border-b border-slate-700 px-2 py-1 text-left">
                    班
                  </th>
                  {days.map((d) => (
                    <th
                      key={d.iso}
                      className="min-w-[90px] border-b border-l border-slate-700 px-1 py-1 text-center"
                    >
                      <div>{format(d.date, "MM/dd", { locale: ja })}</div>
                      <div className="text-[10px] text-slate-400">
                        {format(d.date, "E", { locale: ja })}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {mockLines.map((line) => (
                  <tr key={line.id}>
                    <td className="border-t border-slate-700 bg-slate-900/60 px-2 py-2 text-left align-top">
                      <div className="flex items-center gap-2">
                        <span
                          className="inline-block w-1.5 h-8 rounded-full"
                          style={{ backgroundColor: line.color }}
                        />
                        <span className="text-xs">{line.name}</span>
                      </div>
                    </td>
                    {days.map((d) => {
                      const iso = d.iso;
                      const cellAssignments = getCellAssignments(line.id, iso);
                      return (
                        <td
                          key={iso}
                          className="border-t border-l border-slate-800 align-top"
                        >
                          <button
                            type="button"
                            onClick={() => openSelection(line.id, iso)}
                            className="w-full h-16 px-1.5 py-1 text-left hover:bg-slate-800/60"
                          >
                            <div className="flex flex-wrap gap-1">
                              {cellAssignments.slice(0, 10).map((a) => {
                                const member =
                                  mockMembers.find((m) => m.id === a.memberId) ??
                                  mockMembers[0];
                                return (
                                  <span
                                    key={a.id}
                                    className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-slate-600 bg-slate-900 text-[10px]"
                                  >
                                    {member.name}
                                  </span>
                                );
                              })}
                              {cellAssignments.length > 10 && (
                                <span className="text-[10px] text-slate-400">
                                  +{cellAssignments.length - 10}
                                </span>
                              )}
                            </div>
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
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
    </div>
  );
}


