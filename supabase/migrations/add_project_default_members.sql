-- Project default members (案件の既定メンバー)
CREATE TABLE IF NOT EXISTS project_default_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  member_id UUID NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(project_id, member_id)
);

CREATE INDEX IF NOT EXISTS idx_project_default_members_project_id ON project_default_members(project_id);

ALTER TABLE project_default_members ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view project default members" ON project_default_members
  FOR SELECT USING (true);
CREATE POLICY "Only admins can manage project default members" ON project_default_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
