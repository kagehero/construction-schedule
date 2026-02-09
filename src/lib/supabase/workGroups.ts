import { supabase } from './client';

export interface WorkGroup {
  id: string;
  name: string;
  color?: string;
}

const toWorkGroup = (row: { id: string; name: string; color?: string | null }): WorkGroup => ({
  id: row.id,
  name: row.name,
  color: row.color ?? undefined,
});

export async function getWorkGroups(): Promise<WorkGroup[]> {
  const { data, error } = await supabase
    .from('work_groups')
    .select('id, name, color')
    .order('name');

  if (error) throw error;
  return (data ?? []).map(toWorkGroup);
}

export async function createWorkGroup(wg: { name: string; color?: string }): Promise<WorkGroup> {
  const { data, error } = await supabase
    .from('work_groups')
    .insert({ name: wg.name, color: wg.color ?? null })
    .select()
    .single();

  if (error) throw error;
  return toWorkGroup(data);
}

export async function updateWorkGroup(id: string, wg: { name?: string; color?: string }): Promise<WorkGroup> {
  const updateData: Record<string, unknown> = {};
  if (wg.name !== undefined) updateData.name = wg.name;
  if (wg.color !== undefined) updateData.color = wg.color ?? null;

  const { data, error } = await supabase
    .from('work_groups')
    .update(updateData)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return toWorkGroup(data);
}

export async function deleteWorkGroup(id: string): Promise<void> {
  const { error } = await supabase.from('work_groups').delete().eq('id', id);
  if (error) throw error;
}
