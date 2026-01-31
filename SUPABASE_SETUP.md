# Supabase Setup Guide

## 1. Create Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in
3. Create a new project
4. Wait for the project to be set up

## 2. Get Your Credentials

1. Go to Project Settings → API
2. Copy the following:
   - **Project URL** (under "Project URL")
   - **anon/public key** (under "Project API keys")

## 3. Set Environment Variables

Create a `.env.local` file in the root directory:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

Replace `your_supabase_project_url` and `your_supabase_anon_key` with your actual values.

## 4. Run Database Schema

1. Go to your Supabase project dashboard
2. Navigate to SQL Editor
3. Copy the contents of `supabase/schema.sql`
4. Paste and run the SQL script
5. Verify that all tables are created successfully (including `user_profiles` table)

## 5. Set Up Authentication

### Step 1: Enable Email Authentication

1. Go to **Authentication** → **Settings** in Supabase dashboard
2. Under **Auth Providers**, ensure **Email** is enabled
3. **重要**: 開発環境ではメール確認をスキップするため、以下の設定を推奨:
   - **Enable email confirmations** を **無効** にする
   - または、ユーザー作成時に「Auto Confirm User」にチェックを入れる
4. (Optional) Configure email templates if needed

### Step 2: Create the Default Admin User

**重要**: この手順を正確に実行しないと「Invalid login credentials」エラーが発生します。

1. Go to **Authentication** → **Users** in Supabase dashboard
2. Click **Add user** button (右上)
3. Select **Create new user**
4. Fill in the form:
   - **Email**: `admin@gmail.com`
   - **Password**: `password123!`
   - **Auto Confirm User**: ✅ **必ずチェックを入れる**（これがないとログインできません）
5. Click **Create user**

### Step 3: Set Admin Role

ユーザーを作成した後、管理者ロールを設定します:

1. Go to **SQL Editor** in Supabase dashboard
2. Run the following SQL:

```sql
-- ユーザープロファイルを管理者に設定
UPDATE user_profiles
SET role = 'admin'
WHERE email = 'admin@gmail.com';

-- プロファイルが存在しない場合は作成
INSERT INTO user_profiles (id, email, role)
SELECT id, email, 'admin'
FROM auth.users
WHERE email = 'admin@gmail.com'
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

3. Click **Run** to execute

### Step 4: Verify User Creation

ユーザーが正しく作成されたか確認:

```sql
-- ユーザーが存在するか確認
SELECT id, email, email_confirmed_at 
FROM auth.users 
WHERE email = 'admin@gmail.com';

-- プロファイルが正しく設定されているか確認
SELECT id, email, role 
FROM user_profiles 
WHERE email = 'admin@gmail.com';
```

`role` が `admin` になっていることを確認してください。

### Troubleshooting "Invalid login credentials"

このエラーが発生する場合、以下を確認してください:

1. **ユーザーが作成されているか**
   - Authentication → Users で `admin@gmail.com` が存在するか確認

2. **Auto Confirm User が有効か**
   - ユーザー詳細ページで確認
   - 無効な場合は、ユーザーを削除して再作成

3. **パスワードが正しいか**
   - パスワードは `password123!` であることを確認
   - コピー&ペースト時に余分なスペースが入っていないか確認

4. **プロファイルが作成されているか**
   - SQL Editorで `SELECT * FROM user_profiles WHERE email = 'admin@gmail.com';` を実行
   - 存在しない場合は、上記のSQLを実行して作成

詳細な手順は `supabase/setup_admin.md` を参照してください。

## 6. (Optional) Seed Initial Data

You can insert initial data using the SQL Editor:

```sql
-- Insert sample members
INSERT INTO members (name) VALUES
  ('寺道雅気'),
  ('寺道隆浩'),
  ('大和優士'),
  ('岡崎永遠'),
  ('黒澤健二'),
  ('安田零唯'),
  ('林工業(大橋)'),
  ('林工業(中嶋)'),
  ('フジシン(立松)'),
  ('YNP(土屋)'),
  ('YNP(大野)'),
  ('YNP(長谷部)'),
  ('藤工業(田中)');

-- Insert a sample project
INSERT INTO projects (title, customer_name, site_name, contract_type, site_address, start_date, end_date)
VALUES ('サンプルプロジェクト', 'サンプル顧客', 'サンプル現場', '請負', '東京都', '2024-01-01', '2024-12-31')
RETURNING id;

-- Insert work lines (replace project_id with the actual project ID from above)
INSERT INTO work_lines (project_id, name, color) VALUES
  ('your-project-id', '堀川班', '#3b82f6'),
  ('your-project-id', '辻班', '#f97316'),
  ('your-project-id', '橋本班', '#22c55e'),
  ('your-project-id', '小原班', '#eab308');
```

## 7. Test the Connection

After setting up, restart your Next.js development server:

```bash
npm run dev
```

The application should now connect to Supabase instead of using mock data.

## 8. Authentication & Authorization

### User Roles
- **admin**: すべての操作（作成、編集、削除）が可能
- **viewer**: 閲覧のみ可能（編集・削除不可）

### Default Admin Account
- Email: `admin@gmail.com`
- Password: `password123!`

### Access Control
- **案件立ち上げページ**: 管理者のみアクセス可能
- **工程・人員配置ページ**: 全ユーザーがアクセス可能（権限に応じて編集可能/閲覧のみ）

## Security Notes

- RLS (Row Level Security) が有効になっています
- 管理者のみがデータの作成・更新・削除が可能
- 閲覧者はデータの閲覧のみ可能
- 本番環境では、より厳格なセキュリティポリシーを設定することを推奨します
