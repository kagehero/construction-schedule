export interface Member {
  id: string;
  name: string;
}

export interface WorkLine {
  id: string;
  projectId: string;
  name: string;
  color?: string;
}

export interface Assignment {
  id: string;
  workLineId: string;
  date: string; // ISO yyyy-MM-dd
  memberId: string;
  isHoliday: boolean;
  isConfirmed: boolean;
}

export interface DaySiteStatus {
  id: string;
  workLineId: string;
  date: string; // ISO yyyy-MM-dd
  isLocked: boolean;
}


