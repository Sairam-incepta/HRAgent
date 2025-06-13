'use client';

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ChatInterface } from "@/components/dashboard/chat-interface";
import { Loader2 } from "lucide-react";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const [userRole, setUserRole] = useState<"admin" | "employee">("employee");

  useEffect(() => {
    if (isLoaded && user) {
      // Check if user is admin based on email or metadata
      const isAdmin = user.emailAddresses[0]?.emailAddress === 'admin@letsinsure.hr' ||
                     user.publicMetadata?.role === 'admin' ||
                     user.id === 'user_2y2ylH58JkmHljhJT0BXIfjHQui'; // Admin Clerk ID
      setUserRole(isAdmin ? "admin" : "employee");
    }
  }, [isLoaded, user]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <DashboardHeader userRole={userRole} />
      <div className="flex flex-1 overflow-hidden">
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {userRole === "employee" ? (
            <EmployeeDashboard />
          ) : (
            <AdminDashboard />
          )}
        </main>
        {/* Chat interface for both admin and employee - Made wider */}
        <div className="w-[700px] border-l hidden lg:block overflow-y-auto bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
          <ChatInterface />
        </div>
      </div>
    </div>
  );
}