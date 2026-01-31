-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Projects table
CREATE TABLE IF NOT EXISTS projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title TEXT NOT NULL,
  customer_name TEXT NOT NULL,
  site_name TEXT NOT NULL,
  contract_type TEXT NOT NULL CHECK (contract_type IN ('請負', '常用', '追加工事')),
  contract_amount NUMERIC,
  site_address TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Members table
CREATE TABLE IF NOT EXISTS members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work lines table
CREATE TABLE IF NOT EXISTS work_lines (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Assignments table
CREATE TABLE IF NOT EXISTS assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_line_id UUID REFERENCES work_lines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  member_id UUID REFERENCES members(id) ON DELETE CASCADE,
  is_holiday BOOLEAN DEFAULT FALSE,
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(work_line_id, date, member_id)
);

-- Day site status table
CREATE TABLE IF NOT EXISTS day_site_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  work_line_id UUID REFERENCES work_lines(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(work_line_id, date)
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_assignments_work_line_id ON assignments(work_line_id);
CREATE INDEX IF NOT EXISTS idx_assignments_date ON assignments(date);
CREATE INDEX IF NOT EXISTS idx_assignments_member_id ON assignments(member_id);
CREATE INDEX IF NOT EXISTS idx_work_lines_project_id ON work_lines(project_id);
CREATE INDEX IF NOT EXISTS idx_day_site_status_work_line_id ON day_site_status(work_line_id);
CREATE INDEX IF NOT EXISTS idx_day_site_status_date ON day_site_status(date);

-- Enable Row Level Security (RLS)
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_lines ENABLE ROW LEVEL SECURITY;
ALTER TABLE assignments ENABLE ROW LEVEL SECURITY;
ALTER TABLE day_site_status ENABLE ROW LEVEL SECURITY;

-- Create policies (allow all for now - adjust based on your auth requirements)
CREATE POLICY "Allow all operations on projects" ON projects
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on members" ON members
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on work_lines" ON work_lines
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on assignments" ON assignments
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all operations on day_site_status" ON day_site_status
  FOR ALL USING (true) WITH CHECK (true);
