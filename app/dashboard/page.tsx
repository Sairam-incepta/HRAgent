'use client';

import { useState, useEffect, useRef } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ChatInterface } from "@/components/dashboard/chat-interface";
import { Loader2, MessageSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

export default function DashboardPage() {
  const { user, isLoaded } = useUser();
  const { signOut } = useClerk();
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [isRoleLoaded, setIsRoleLoaded] = useState(false);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [hasError, setHasError] = useState(false);
  const [dailySummaryPrompt, setDailySummaryPrompt] = useState<string | null>(null);
  const dailySummaryPrompts = [
    "How was your day? Anything you'd like to share?",
    "Hope you had a productive day! How did it go?",
    "Tell me about your day – any wins or challenges?",
    "How did things go today? Anything stand out?",
    "What was the highlight of your day?"
  ];
  const lastPromptIndex = useRef<number>(-1);

  // Debug logging for loading states
  console.log('Dashboard Loading States:', {
    isLoaded,
    hasUser: !!user,
    userRole,
    isRoleLoaded,
    userEmail: user?.emailAddresses[0]?.emailAddress,
    userId: user?.id
  });

  useEffect(() => {
    if (isLoaded && user) {
      // Check if user is admin based on email or metadata
      const isAdmin = user.emailAddresses[0]?.emailAddress === 'admin@letsinsure.hr' ||
                     user.publicMetadata?.role === 'admin' ||
                     user.id === 'user_2y2ylH58JkmHljhJT0BXIfjHQui'; // Admin Clerk ID
      
      console.log('Setting user role:', isAdmin ? 'admin' : 'employee');
      setUserRole(isAdmin ? "admin" : "employee");
      setIsRoleLoaded(true);
    } else if (isLoaded && !user) {
      console.log('User loaded but no user data found');
      setIsRoleLoaded(true);
    }
  }, [isLoaded, user]);

  // Add timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isRoleLoaded && isLoaded) {
        console.log('Timeout reached - forcing role load');
        setHasError(true);
        setIsRoleLoaded(true);
      }
    }, 10000); // 10 second timeout

    return () => clearTimeout(timeout);
  }, [isRoleLoaded, isLoaded]);

  // Force sign out function
  const handleForceSignOut = async () => {
    try {
      // Sign out from Clerk
      await signOut();
      
      // Redirect to home page
      window.location.href = '/';
    } catch (error) {
      console.error('Error during force sign out:', error);
      // Fallback: just reload the page
      window.location.reload();
    }
  };

  // Handler to trigger after clock out
  const handleClockOut = () => {
    // Pick a random prompt, but not the same as last time
    let idx = Math.floor(Math.random() * dailySummaryPrompts.length);
    if (idx === lastPromptIndex.current) {
      idx = (idx + 1) % dailySummaryPrompts.length;
    }
    lastPromptIndex.current = idx;
    setDailySummaryPrompt(dailySummaryPrompts[idx]);
  };

  // Show loading while Clerk is initializing
  if (!isLoaded) {
    console.log('Clerk not loaded yet');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // Show loading while determining user role
  if (!isRoleLoaded) {
    console.log('Role not loaded yet');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  // If no user after loading, redirect to sign-in
  if (!user) {
    if (typeof window !== 'undefined') {
      window.location.href = '/sign-in';
    }
    return null;
  }

  // Show error state if timeout occurred
  if (hasError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Loading timeout. Please try refreshing the page or sign out.</p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => window.location.reload()} 
              className="px-4 py-2 bg-[#005cb3] text-white rounded hover:bg-[#004a96]"
            >
              Refresh Page
            </button>
            <button 
              onClick={handleForceSignOut} 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Force Sign Out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything until we have a confirmed role
  if (!userRole) {
    console.log('No user role determined');
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Initializing...</p>
        </div>
      </div>
    );
  }

  const isAdmin = userRole === "admin";

  // Debug logging
  console.log('Dashboard Debug:', {
    userRole,
    isAdmin,
    isChatCollapsed,
    userEmail: user?.emailAddresses[0]?.emailAddress,
    userId: user?.id
  });

  return (
    <div className="flex flex-col h-screen bg-background">
      <DashboardHeader userRole={userRole} />
      <div className="flex flex-1 overflow-hidden relative">
        {/* Main Dashboard Content - responsive width when chat is open */}
        <main 
          className={`flex-1 overflow-y-auto p-4 md:p-6 transition-all duration-300 ${
            isChatCollapsed 
              ? 'w-full' 
              : isChatExpanded 
                ? 'w-full md:w-[55%] lg:w-[55%] xl:w-[55%]' 
                : 'w-full md:w-[55%] lg:w-[65%] xl:w-[70%]'
          }`}
        >
          {userRole === "employee" ? (
            <EmployeeDashboard onClockOut={handleClockOut} />
          ) : (
            <AdminDashboard />
          )}
        </main>
        
        {/* Chat Interface - responsive width, collapsible */}
        {userRole && (
          <div 
            className={`transition-all duration-300 border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 
              ${isChatCollapsed 
                ? 'w-0 overflow-hidden' 
                : isChatExpanded
                  ? 'w-full md:w-[45%] lg:w-[45%] xl:w-[45%] md:relative absolute top-0 right-0 h-full z-40 md:z-auto'
                  : 'w-full md:w-[45%] lg:w-[35%] xl:w-[30%] md:relative absolute top-0 right-0 h-full z-40 md:z-auto'
              }`}
          >
            {!isChatCollapsed && (
              <div className="h-full">
                <ChatInterface 
                  dailySummaryPrompt={dailySummaryPrompt} 
                  onDailySummaryPromptShown={() => setDailySummaryPrompt(null)}
                  onCollapse={() => setIsChatCollapsed(true)}
                  isExpanded={isChatExpanded}
                  onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
                />
              </div>
            )}
          </div>
        )}
        
        {/* Floating Chat Toggle Button when collapsed */}
        {isChatCollapsed && (
          <Button
            onClick={() => setIsChatCollapsed(false)}
            className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-12 w-12 md:h-14 md:w-14 rounded-full bg-[#005cb3] hover:bg-[#004a96] shadow-lg z-50"
            size="sm"
          >
            <MessageSquare className="h-5 w-5 md:h-6 md:w-6" />
          </Button>
        )}
      </div>
    </div>
  );
}