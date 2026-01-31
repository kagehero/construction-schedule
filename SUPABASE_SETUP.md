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
5. Verify that all tables are created successfully

## 5. (Optional) Seed Initial Data

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

## 6. Test the Connection

After setting up, restart your Next.js development server:

```bash
npm run dev
```

The application should now connect to Supabase instead of using mock data.

## Security Notes

- The current RLS policies allow all operations. In production, you should:
  - Implement proper authentication
  - Create more restrictive RLS policies
  - Use service role key for server-side operations (never expose it in client code)
