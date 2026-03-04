import { supabase } from './client';

export async function getProjectDefaultMemberIds(projectId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from('project_default_members')
    .select('member_id')
    .eq('project_id', projectId);

  if (error) {
    console.error('Supabase error:', error);
    throw new Error(`既定メンバーの取得に失敗しました: ${error.message}`);
  }
  return data.map((r) => r.member_id);
}

export async function setProjectDefaultMembers(
  projectId: string,
  memberIds: string[]
): Promise<void> {
  // 既存を削除してから挿入
  const { error: delError } = await supabase
    .from('project_default_members')
    .delete()
    .eq('project_id', projectId);

  if (delError) throw delError;

  if (memberIds.length === 0) return;

  const rows = memberIds.map((member_id) => ({ project_id: projectId, member_id }));
  const { error: insError } = await supabase.from('project_default_members').insert(rows);

  if (insError) throw insError;
}
