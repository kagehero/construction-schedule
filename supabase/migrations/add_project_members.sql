-- 案件ごとに自社メンバーを紐づける project_members テーブル追加
-- Supabase SQL Editor で実行してください。

CREATE TABLE IF NOT EXISTS project_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_project_members_project_id ON project_members(project_id);
CREATE INDEX IF NOT EXISTS idx_project_members_member_id ON project_members(member_id);

ALTER TABLE project_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view project members" ON project_members
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage project members" ON project_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

