'use client';

import { useState, useEffect, useRef } from "react";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ChatInterface } from "@/components/dashboard/chat-interface";
import { Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

// Dynamic import of Clerk hooks to handle SSR issues
import dynamic from 'next/dynamic';

// Create a wrapper component for Clerk hooks
const ClerkWrapper = dynamic(() => import('@/app/dashboard/clerk-wrapper'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
      <div className="text-center space-y-4">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
        <p className="text-muted-foreground">Loading authentication...</p>
      </div>
    </div>
  )
});

export default function DashboardPage() {
  return <ClerkWrapper />;
}