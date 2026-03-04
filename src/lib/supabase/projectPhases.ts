import { supabase } from './client';

export interface ProjectPhase {
  id: string;
  projectId: string;
  startDate: string;
  endDate: string;
  siteStatus: string;
}

export async function getProjectPhases(projectId: string): Promise<ProjectPhase[]> {
  const { data, error } = await supabase
    .from('project_phases')
    .select('id, project_id, start_date, end_date, site_status')
    .eq('project_id', projectId)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`工程の取得に失敗しました: ${error.message}`);
  }
  return data.map((r) => ({
    id: r.id,
    projectId: r.project_id,
    startDate: r.start_date,
    endDate: r.end_date,
    siteStatus: r.site_status
  }));
}

export async function setProjectPhases(
  projectId: string,
  phases: { startDate: string; endDate: string; siteStatus: string }[]
): Promise<void> {
  const { error: delError } = await supabase
    .from('project_phases')
    .delete()
    .eq('project_id', projectId);

  if (delError) throw delError;

  if (phases.length === 0) return;

  const rows = phases.map((p) => ({
    project_id: projectId,
    start_date: p.startDate,
    end_date: p.endDate,
    site_status: p.siteStatus
  }));
  const { error: insError } = await supabase.from('project_phases').insert(rows);

  if (insError) throw insError;
}

/** 複数案件の工程を一括取得。projectId -> phases[] の Map を返す */
export async function getProjectPhasesMap(projectIds: string[]): Promise<Map<string, { startDate: string; endDate: string; siteStatus: string }[]>> {
  if (projectIds.length === 0) return new Map();
  const { data, error } = await supabase
    .from('project_phases')
    .select('project_id, start_date, end_date, site_status')
    .in('project_id', projectIds)
    .order('start_date', { ascending: true });

  if (error) {
    console.error('Supabase error:', error);
    return new Map();
  }
  const map = new Map<string, { startDate: string; endDate: string; siteStatus: string }[]>();
  for (const r of data) {
    const arr = map.get(r.project_id) ?? [];
    arr.push({ startDate: r.start_date, endDate: r.end_date, siteStatus: r.site_status });
    map.set(r.project_id, arr);
  }
  return map;
}

/** 指定日が含まれる工程のステータスを返す。該当なしなら null */
export function getPhaseStatusForDate(
  phases: { startDate: string; endDate: string; siteStatus: string }[],
  date: string
): string | null {
  for (const p of phases) {
    if (date >= p.startDate && date <= p.endDate) {
      return p.siteStatus;
    }
  }
  return null;
}
