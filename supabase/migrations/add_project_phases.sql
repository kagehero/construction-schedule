-- 案件の工程（組立・解体などを日ごとに設定）
CREATE TABLE IF NOT EXISTS project_phases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  site_status TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_project_phases_project_id ON project_phases(project_id);
CREATE INDEX IF NOT EXISTS idx_project_phases_dates ON project_phases(project_id, start_date, end_date);

ALTER TABLE project_phases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view project phases" ON project_phases
  FOR SELECT USING (true);
CREATE POLICY "Only admins can manage project phases" ON project_phases
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
