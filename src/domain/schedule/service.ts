import { addDays, eachDayOfInterval } from "date-fns";
import { Assignment } from "./types";

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
    start: new Date(startDate),
    end: new Date(endDate)
  });

  const result: Assignment[] = [];

  for (const day of days) {
    const weekday = day.getDay();
    const iso = day.toISOString().slice(0, 10);

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


