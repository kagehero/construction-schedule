-- Admin policies for user_profiles (ユーザー管理用)
-- 以前の自己参照ポリシーは「finite recursion detected」エラーを引き起こすため、
-- JWT の email で主管理者 (admin@gmail.com) を判定する方式に変更しています。

DROP POLICY IF EXISTS "Admins can view all user profiles" ON user_profiles;
DROP POLICY IF EXISTS "Admins can update any user profile" ON user_profiles;
DROP POLICY IF EXISTS "Admins can delete any user profile" ON user_profiles;

-- 主管理者（admin@gmail.com）は全ユーザーのプロファイルを参照可能
CREATE POLICY "Admins can view all user profiles"
  ON user_profiles
  FOR SELECT
  USING (
    (auth.jwt()->>'email') = 'admin@gmail.com'
  );

-- 主管理者（admin@gmail.com）は全ユーザーのプロファイルを更新可能
CREATE POLICY "Admins can update any user profile"
  ON user_profiles
  FOR UPDATE
  USING (
    (auth.jwt()->>'email') = 'admin@gmail.com'
  );

-- 主管理者（admin@gmail.com）は全ユーザーのプロファイルを削除可能
CREATE POLICY "Admins can delete any user profile"
  ON user_profiles
  FOR DELETE
  USING (
    (auth.jwt()->>'email') = 'admin@gmail.com'
  );
