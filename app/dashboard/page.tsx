'use client';

import { Loader2 } from "lucide-react";

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