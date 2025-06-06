'use client';

import { redirect } from "next/navigation";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ChatInterface } from "@/components/dashboard/chat-interface";

export default function DashboardPage() {
  const searchParams = useSearchParams();
  const initialRole = searchParams.get("role") as "admin" | "employee" || "employee";
  const initialTab = searchParams.get("tab") || "overview";
  
  const [userRole, setUserRole] = useState<"admin" | "employee">(initialRole);

  return (
    <div className="flex flex-col h-screen bg-background">
      <DashboardHeader userRole={userRole} />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {userRole === "employee" ? (
            <EmployeeDashboard initialTab={initialTab} />
          ) : (
            <AdminDashboard initialTab={initialTab} />
          )}
        </main>
        <div className="w-[600px] border-l hidden lg:block overflow-y-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}