import { eachDayOfInterval, format } from "date-fns";
import { Assignment } from "./types";

/** "yyyy-MM-dd" をローカル時刻の日付としてパース（タイムゾーンずれ防止） */
function parseLocalDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d);
}

interface BulkAssignParams {
  workLineId: string;
  memberIds: string[];
  startDate: string;
  endDate: string;
  holidayWeekdays?: number[]; // 0=Sunday ... 6=Saturday
}

export function createAssignmentsForRange(
  params: BulkAssignParams
): Assignment[] {
  const { workLineId, memberIds, startDate, endDate, holidayWeekdays = [] } =
    params;

  const days = eachDayOfInterval({
    start: parseLocalDate(startDate),
    end: parseLocalDate(endDate)
  });

  const result: Assignment[] = [];

  for (const day of days) {
    const weekday = day.getDay();
    const iso = format(day, "yyyy-MM-dd");

    const isHoliday = holidayWeekdays.includes(weekday);

    for (const memberId of memberIds) {
      result.push({
        id: `${workLineId}_${memberId}_${iso}`,
        workLineId,
        date: iso,
        memberId,
        isHoliday,
        isConfirmed: false
      });
    }
  }

  return result;
}


