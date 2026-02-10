-- 取引先メンバー（ビジネスパートナー担当者）テーブルと、案件の取引先紐づけ
-- Supabase SQL Editor で実行してください。

-- 取引先メンバー
CREATE TABLE IF NOT EXISTS customer_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  color TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_customer_members_customer_id ON customer_members(customer_id);

ALTER TABLE customer_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view customer members" ON customer_members
  FOR SELECT USING (true);

CREATE POLICY "Only admins can manage customer members" ON customer_members
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 案件に取引先IDを追加
ALTER TABLE projects ADD COLUMN IF NOT EXISTS customer_id UUID REFERENCES customers(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_projects_customer_id ON projects(customer_id);
