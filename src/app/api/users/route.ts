import { NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

export type ApiUserRow = {
  id: string;
  email: string;
  role: "admin" | "viewer";
};

/**
 * GET /api/users
 * Returns all users: auth.users merged with user_profiles (role).
 * Requires SUPABASE_SERVICE_ROLE_KEY to be set.
 */
export async function GET() {
  const admin = getSupabaseAdmin();
  if (!admin) {
    return NextResponse.json(
      { error: "SUPABASE_SERVICE_ROLE_KEY is not set. Only user_profiles are available from the client." },
      { status: 503 }
    );
  }

  try {
    const allAuthUsers: { id: string; email: string }[] = [];
    let page = 1;
    const perPage = 1000;

    while (true) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error("auth.admin.listUsers error:", error);
        return NextResponse.json(
          { error: error.message || "Failed to list auth users" },
          { status: 500 }
        );
      }
      const users = data?.users ?? [];
      for (const u of users) {
        allAuthUsers.push({
          id: u.id,
          email: u.email ?? "",
        });
      }
      const pagination = data as { nextPage?: number | null };
      if (pagination.nextPage == null || users.length === 0) break;
      page = pagination.nextPage;
    }

    const roleById = new Map<string, "admin" | "viewer">();
    if (allAuthUsers.length > 0) {
      const { data: profiles } = await admin
        .from("user_profiles")
        .select("id, role")
        .in("id", allAuthUsers.map((u) => u.id));
      for (const p of profiles ?? []) {
        if (p?.role === "admin" || p?.role === "viewer") {
          roleById.set(p.id, p.role);
        }
      }
    }

    const result: ApiUserRow[] = allAuthUsers.map((u) => ({
      id: u.id,
      email: u.email,
      role: roleById.get(u.id) ?? "viewer",
    }));

    result.sort((a, b) => a.email.localeCompare(b.email, "ja"));

    return NextResponse.json(result);
  } catch (err) {
    console.error("GET /api/users error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
