"use client";

import { useAuth } from "@/contexts/AuthContext";
import { AuthGuard } from "@/components/AuthGuard";
import SchedulePage from "@/app/schedule/page";

export default function DashboardPage() {
  return (
    <AuthGuard>
      <SchedulePage />
    </AuthGuard>
  );
}
