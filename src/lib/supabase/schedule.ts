import { supabase } from './client';
import type { Member, WorkLine, Assignment, DaySiteStatus } from '@/domain/schedule/types';
import type { Database } from './database.types';

type AssignmentRow = Database['public']['Tables']['assignments']['Row'];
type MemberRow = Database['public']['Tables']['members']['Row'];
type WorkLineRow = Database['public']['Tables']['work_lines']['Row'];
type DaySiteStatusRow = Database['public']['Tables']['day_site_status']['Row'];

// Convert database row to domain type
const toMember = (row: MemberRow): Member => ({
  id: row.id,
  name: row.name,
});

const toWorkLine = (row: WorkLineRow): WorkLine => ({
  id: row.id,
  projectId: row.project_id || '',
  name: row.name,
  color: row.color || undefined,
});

const toAssignment = (row: AssignmentRow): Assignment => ({
  id: row.id,
  workLineId: row.work_line_id,
  date: row.date,
  memberId: row.member_id,
  isHoliday: row.is_holiday,
  isConfirmed: row.is_confirmed,
});

const toDaySiteStatus = (row: DaySiteStatusRow): DaySiteStatus => ({
  id: row.id,
  workLineId: row.work_line_id,
  date: row.date,
  isLocked: row.is_locked,
});

// Members
export async function getMembers(): Promise<Member[]> {
  const { data, error } = await supabase
    .from('members')
    .select('*')
    .order('name');

  if (error) throw error;
  return data.map(toMember);
}

export async function createMember(member: Omit<Member, 'id'>): Promise<Member> {
  const { data, error } = await supabase
    .from('members')
    .insert({ name: member.name })
    .select()
    .single();

  if (error) throw error;
  return toMember(data);
}

export async function updateMember(id: string, member: Partial<Omit<Member, 'id'>>): Promise<Member> {
  const updateData: any = {};
  if (member.name !== undefined) updateData.name = member.name;

  const { data, error } = await supabase
    .from('members')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toMember(data);
}

export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Work Lines
export async function getWorkLines(projectId?: string): Promise<WorkLine[]> {
  let query = supabase.from('work_lines').select('*');

  if (projectId) {
    query = query.eq('project_id', projectId);
  }

  const { data, error } = await query.order('name');

  if (error) throw error;
  return data.map(toWorkLine);
}

export async function createWorkLine(workLine: Omit<WorkLine, 'id'>): Promise<WorkLine> {
  const { data, error } = await supabase
    .from('work_lines')
    .insert({
      project_id: workLine.projectId || null,
      name: workLine.name,
      color: workLine.color || null,
    })
    .select()
    .single();

  if (error) throw error;
  return toWorkLine(data);
}

export async function updateWorkLine(
  id: string,
  data: Partial<Pick<WorkLine, 'name' | 'color'>>
): Promise<WorkLine> {
  const updateData: Record<string, unknown> = {};
  if (data.name !== undefined) updateData.name = data.name;
  if (data.color !== undefined) updateData.color = data.color ?? null;

  const { data: row, error } = await supabase
    .from('work_lines')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toWorkLine(row);
}

export async function deleteWorkLine(id: string): Promise<void> {
  const { error } = await supabase
    .from('work_lines')
    .delete()
    .eq('id', id);

  if (error) throw error;
}

// Assignments
export async function getAssignments(
  workLineId?: string,
  date?: string
): Promise<Assignment[]> {
  let query = supabase.from('assignments').select('*');

  if (workLineId) {
    query = query.eq('work_line_id', workLineId);
  }
  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data.map(toAssignment);
}

export async function createAssignment(assignment: Omit<Assignment, 'id'>): Promise<Assignment> {
  const { data, error } = await supabase
    .from('assignments')
    .insert({
      work_line_id: assignment.workLineId,
      date: assignment.date,
      member_id: assignment.memberId,
      is_holiday: assignment.isHoliday,
      is_confirmed: assignment.isConfirmed,
    })
    .select()
    .single();

  if (error) throw error;
  return toAssignment(data);
}

export async function createAssignments(assignments: Omit<Assignment, 'id'>[]): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from('assignments')
    .insert(
      assignments.map((a) => ({
        work_line_id: a.workLineId,
        date: a.date,
        member_id: a.memberId,
        is_holiday: a.isHoliday,
        is_confirmed: a.isConfirmed,
      }))
    )
    .select();

  if (error) throw error;
  return data.map(toAssignment);
}

export async function deleteAssignments(
  workLineId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from('assignments')
    .delete()
    .eq('work_line_id', workLineId)
    .eq('date', date);

  if (error) throw error;
}

// Day Site Status
export async function getDaySiteStatuses(
  workLineId?: string,
  date?: string
): Promise<DaySiteStatus[]> {
  let query = supabase.from('day_site_status').select('*');

  if (workLineId) {
    query = query.eq('work_line_id', workLineId);
  }
  if (date) {
    query = query.eq('date', date);
  }

  const { data, error } = await query;

  if (error) throw error;
  return data.map(toDaySiteStatus);
}

export async function upsertDaySiteStatus(
  status: Omit<DaySiteStatus, 'id'>
): Promise<DaySiteStatus> {
  const { data, error } = await supabase
    .from('day_site_status')
    .upsert(
      {
        work_line_id: status.workLineId,
        date: status.date,
        is_locked: status.isLocked,
      },
      {
        onConflict: 'work_line_id,date',
      }
    )
    .select()
    .single();

  if (error) throw error;
  return toDaySiteStatus(data);
}

export async function deleteDaySiteStatus(
  workLineId: string,
  date: string
): Promise<void> {
  const { error } = await supabase
    .from('day_site_status')
    .delete()
    .eq('work_line_id', workLineId)
    .eq('date', date);

  if (error) throw error;
}
