'use client';

import { useState, useEffect } from "react";
import { useUser, useClerk } from "@clerk/nextjs";
import { DashboardHeader } from "@/components/dashboard/header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ChatInterface } from "@/components/dashboard/chat-interface";
import { Loader2, MessageSquare, X, Maximize2, Minimize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getEmployee } from "@/lib/database";

export default function ClerkWrapper() {
  const { user, isLoaded, isSignedIn } = useUser();
  const { signOut } = useClerk();
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [isChatCollapsed, setIsChatCollapsed] = useState(false);
  const [isChatExpanded, setIsChatExpanded] = useState(false);
  const [showClockOutPrompt, setShowClockOutPrompt] = useState(false);
  const [clockOutPromptMessage, setClockOutPromptMessage] = useState<string | undefined>();
  const [authError, setAuthError] = useState(false);
  // Welcome message state removed per user request
  const [employeeData, setEmployeeData] = useState<{
    name: string;
    email: string;
  }>({
    name: "",
    email: ""
  });

  // Single effect to handle authentication and role determination
  useEffect(() => {
    console.log('ClerkWrapper: Auth state changed', { isLoaded, isSignedIn, userId: user?.id });
    
    if (isLoaded) {
      if (isSignedIn && user) {
        // Only set role if it hasn't been set yet to prevent loops
        if (!userRole) {
          // Determine user role
          const isAdmin = user.emailAddresses[0]?.emailAddress === 'admin@letsinsure.hr' ||
                         user.publicMetadata?.role === 'admin' ||
                         user.id === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
          
          const role = isAdmin ? "admin" : "employee";
          console.log('ClerkWrapper: User role determined', { role, email: user.emailAddresses[0]?.emailAddress });
          
          setUserRole(role);
          setAuthError(false);
          
          // Load employee data for header
          loadEmployeeData();
        }
      } else if (isSignedIn === false) {
        // User is definitely not signed in, redirect to sign-in
        console.log('ClerkWrapper: User not signed in, redirecting to sign-in');
        // Use replace to prevent back button issues
        window.location.replace('/sign-in');
      }
      // If isSignedIn is undefined, we're still loading
    }
  }, [isLoaded, isSignedIn, user, userRole]);

  // Welcome message functions removed per user request

  // Load employee data for header
  const loadEmployeeData = async () => {
    if (!user?.id) return;
    
    try {
      const employee = await getEmployee(user.id);
      
      if (employee) {
        setEmployeeData({
          name: employee.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '',
          email: employee.email || user.emailAddresses[0]?.emailAddress || '',
        });
      } else {
        // Use Clerk user data as fallback
        const clerkName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
        setEmployeeData({
          name: clerkName || '',
          email: user.emailAddresses[0]?.emailAddress || '',
        });
      }
    } catch (error) {
      console.error('Error loading employee data for header:', error);
      // Use Clerk user data as fallback
      const clerkName = `${user.firstName || ''} ${user.lastName || ''}`.trim();
      setEmployeeData({
        name: clerkName || '',
        email: user.emailAddresses[0]?.emailAddress || '',
      });
    }
  };

  // Timeout to prevent infinite loading
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!userRole && isLoaded) {
        console.warn('ClerkWrapper: Authentication timeout after 15 seconds', { 
          isLoaded, 
          isSignedIn, 
          hasUser: !!user,
          userRole 
        });
        setAuthError(true);
      }
    }, 15000);

    return () => clearTimeout(timeout);
  }, [userRole, isLoaded, isSignedIn, user]);

  // Force sign out and redirect
  const handleForceSignOut = async () => {
    try {
      await signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Error during force sign out:', error);
      // Force reload as fallback
      window.location.reload();
    }
  };

  // Handler to trigger after clock out
  const handleClockOut = async () => {
    // Clock out logic can be handled here if needed
  };

  // Handler to receive clock-out prompt from EmployeeDashboard
  const handleClockOutPrompt = (message: string) => {
    setClockOutPromptMessage(message);
    setShowClockOutPrompt(true);
    
    // Reset after 30 seconds
    setTimeout(() => {
      setShowClockOutPrompt(false);
      setClockOutPromptMessage(undefined);
    }, 30000);
  };

  // Show loading while authentication is being determined
  if (!isLoaded || (!userRole && !authError)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-[#005cb3]" />
          <p className="text-muted-foreground">Loading your dashboard...</p>
          <p className="text-xs text-muted-foreground">
            {!isLoaded ? 'Initializing authentication...' : 'Determining user role...'}
          </p>
        </div>
      </div>
    );
  }

  // Show error state if authentication failed
  if (authError || (isLoaded && !isSignedIn)) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">
            {authError ? 'Authentication timeout occurred.' : 'Authentication required.'}
          </p>
          <p className="text-sm text-muted-foreground">
            Please sign in to access your dashboard.
          </p>
          <div className="flex gap-2 justify-center">
            <button 
              onClick={() => window.location.href = '/sign-in'} 
              className="px-4 py-2 bg-[#005cb3] text-white rounded hover:bg-[#004a96]"
            >
              Sign In
            </button>
            <button 
              onClick={handleForceSignOut} 
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
            >
              Reset Session
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render dashboard if everything is loaded and user has a role
  if (!userRole) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900 dark:to-slate-800">
        <div className="text-center space-y-4">
          <p className="text-muted-foreground">Unable to determine user role.</p>
          <button 
            onClick={() => window.location.reload()} 
            className="px-4 py-2 bg-[#005cb3] text-white rounded hover:bg-[#004a96]"
          >
            Refresh Page
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-background flex flex-col overflow-hidden">
      <DashboardHeader 
        userRole={userRole} 
        employeeName={employeeData.name}
        employeeEmail={employeeData.email}
      />
      
      {/* Welcome Message Banner removed per user request */}
      
      <div className="flex flex-1 min-h-0 overflow-hidden">
        {/* Main Dashboard Content - Responsive based on chat state */}
        <main 
          className={`flex-1 flex flex-col transition-all duration-300 min-h-0 overflow-hidden ${
            isChatCollapsed 
              ? 'w-full' 
              : isChatExpanded
                ? 'w-full sm:w-[60%] md:w-[55%] lg:w-[55%] xl:w-[55%] 2xl:w-[45%]'
                : 'w-full sm:w-[70%] md:w-[65%] lg:w-[65%] xl:w-[65%] 2xl:w-[55%]'
          }`}
        >
          <div className="flex-1 overflow-y-auto p-4 md:p-6 min-h-0">
            {userRole === "employee" ? (
              <EmployeeDashboard 
                onClockOut={handleClockOut} 
                onClockOutPrompt={handleClockOutPrompt}
              />
            ) : (
              <AdminDashboard />
            )}
          </div>
        </main>
        
        {/* Chat Interface - Responsive width: 35% collapsed, 45% expanded */}
        {userRole && (
          <div 
            className={`transition-all duration-300 border-l bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex flex-col ${
              isChatCollapsed 
                ? 'w-0 overflow-hidden' 
                : isChatExpanded
                  ? 'w-full sm:w-[40%] md:w-[45%] lg:w-[45%] xl:w-[45%] 2xl:w-[55%] min-w-[320px] max-w-[700px]'
                  : 'w-full sm:w-[30%] md:w-[35%] lg:w-[35%] xl:w-[35%] 2xl:w-[45%] min-w-[300px] max-w-[580px]'
            }`}
            style={{ height: 'calc(100vh - 64px)' }}
          >
            {!isChatCollapsed && (
              <div className="h-full flex flex-col min-h-0">
                {/* Chat Header with Expand/Collapse Buttons */}
                <div className="flex items-center justify-between p-3 border-b bg-background/95 backdrop-blur">
                  <div className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-[#005cb3]" />
                    <span className="text-sm font-medium">
                      {userRole === 'admin' ? 'HR Admin Assistant' : 'HR Assistant'}
                    </span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsChatExpanded(!isChatExpanded)}
                      className="h-7 w-7 p-0 hover:bg-muted"
                      title={isChatExpanded ? "Collapse chat" : "Expand chat"}
                    >
                      {isChatExpanded ? (
                        <Minimize2 className="h-4 w-4" />
                      ) : (
                        <Maximize2 className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setIsChatCollapsed(true)}
                      className="h-7 w-7 p-0 hover:bg-muted"
                      title="Close chat"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Chat Content - Fixed props */}
                <div className="flex-1 min-h-0">
                  <ChatInterface 
                    onClockOutPrompt={showClockOutPrompt}
                    clockOutPromptMessage={clockOutPromptMessage}
                    isExpanded={isChatExpanded}
                    onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
                  />
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Floating Chat Toggle Button when collapsed */}
        {isChatCollapsed && (
          <Button
            onClick={() => setIsChatCollapsed(false)}
            className="fixed bottom-6 right-6 h-12 w-12 rounded-full bg-[#005cb3] hover:bg-[#004a96] shadow-lg z-50"
            size="sm"
          >
            <MessageSquare className="h-5 w-5" />
          </Button>
        )}
      </div>
    </div>
  );
} 