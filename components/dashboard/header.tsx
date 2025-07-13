"use client";

import { Bell, Moon, Settings, Sun, LogOut, DollarSign, Clock, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useTheme } from "next-themes";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";
import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useClerk, useUser } from "@clerk/nextjs";
import { getHighValuePolicyNotificationsList } from "@/lib/util/high-value-policy-notifications";
import { getAllRequests } from "@/lib/util/requests";
import { dashboardEvents } from "@/lib/events";

interface DashboardHeaderProps {
  userRole: "admin" | "employee";
  employeeName?: string;
  employeeEmail?: string;
}

interface NotificationItem {
  id: string;
  type: 'high_value_policy' | 'request';
  title: string;
  description: string;
  isUrgent?: boolean;
  policyId?: string;
}

export function DashboardHeader({ userRole, employeeName, employeeEmail }: DashboardHeaderProps) {
  const { setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [showNotifications, setShowNotifications] = useState(false);
  const notificationRef = useRef<HTMLDivElement>(null);
  const { signOut } = useClerk();
  const { user } = useUser();

  useEffect(() => {
    if (userRole === "admin") {
      const fetchNotifications = async () => {
        try {
          const [highValueNotifications, requests] = await Promise.all([
            getHighValuePolicyNotificationsList(),
            getAllRequests()
          ]);
          
          const notificationItems: NotificationItem[] = [];
          
          // Process high-value policy notifications (only pending ones for alerts)
          highValueNotifications?.forEach((notification: any) => {
            if (notification.status === 'pending') {
              const daysUntilEnd = notification.biweekly_period_end 
                ? Math.ceil((new Date(notification.biweekly_period_end).getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24))
                : null;
              const isUrgent = daysUntilEnd !== null && daysUntilEnd <= 2;
              
              notificationItems.push({
                id: notification.id,
                type: 'high_value_policy',
                title: `${notification.policy_number}`,
                description: `$${notification.policy_amount.toLocaleString()} Policy`,
                isUrgent,
                policyId: notification.id
              });
            }
          });
          
          // Process requests
          requests?.forEach((request: any) => {
            if (request.status === 'pending') {
              notificationItems.push({
                id: request.id,
                type: 'request',
                title: request.title || `${request.type} Request`,
                description: request.description || `${request.type} request from employee`,
                isUrgent: request.type === 'overtime'
              });
            }
          });
          
          setNotifications(notificationItems);
          setPendingCount(notificationItems.length);
        } catch (error) {
          console.error('Error fetching notifications:', error);
        }
      };

      fetchNotifications();
      const interval = setInterval(fetchNotifications, 10000); // Update every 10 seconds for more responsive notifications
      
      // Listen for real-time updates
      const cleanupFunctions = [
        dashboardEvents.on('high_value_policy_updated', fetchNotifications),
        dashboardEvents.on('request_submitted', fetchNotifications),
        dashboardEvents.on('request_status_updated', fetchNotifications),
        dashboardEvents.on('policy_sale', fetchNotifications)
      ];

      return () => {
        clearInterval(interval);
        cleanupFunctions.forEach(cleanup => cleanup());
      };
    }
  }, [userRole]);

  // Close notifications when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (notificationRef.current && !notificationRef.current.contains(event.target as Node)) {
        setShowNotifications(false);
      }
    };

    if (showNotifications) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showNotifications]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Logout error:', error);
      setIsLoggingOut(false);
    }
  };

  const handleNotificationClick = (notification: NotificationItem) => {
    setShowNotifications(false);
    
    if (notification.type === 'high_value_policy' && notification.policyId) {
      // Scroll to the specific policy in the high-value section
      const element = document.getElementById(`policy-${notification.policyId}`);
      if (element) {
        element.scrollIntoView({ 
          behavior: 'smooth',
          block: 'center'
        });
        // Add a highlight effect
        element.classList.add('ring-2', 'ring-blue-500', 'ring-opacity-50');
        setTimeout(() => {
          element.classList.remove('ring-2', 'ring-blue-500', 'ring-opacity-50');
        }, 3000);
      } else {
        // If element not found, scroll to high-value section
        const highValueSection = document.querySelector('[data-section="high-value-policies"]');
        if (highValueSection) {
          highValueSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    } else if (notification.type === 'request') {
      // Scroll to requests section
      const requestsSection = document.querySelector('[data-section="requests"]');
      if (requestsSection) {
        requestsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }
  };

  const getUserInitials = () => {
    if (employeeName) {
      const names = employeeName.split(" ");
      if (names.length >= 2) {
        return `${names[0][0]}${names[1][0]}`.toUpperCase();
      }
      return employeeName.substring(0, 2).toUpperCase();
    }
    
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user?.emailAddresses[0]?.emailAddress) {
      const email = user.emailAddresses[0].emailAddress;
      return email.substring(0, 2).toUpperCase();
    }
    return userRole === "admin" ? "AD" : "EM";
  };

  const getUserName = () => {
    if (employeeName) {
      return employeeName;
    }
    
    if (user?.firstName && user?.lastName) {
      const fullName = `${user.firstName} ${user.lastName}`;
      return userRole === "admin" ? `${fullName} (Admin)` : fullName;
    }
    if (user?.firstName) {
      return userRole === "admin" ? `${user.firstName} (Admin)` : user.firstName;
    }
    
    return userRole === "admin" ? "Admin User" : "Employee";
  };

  const getUserEmail = () => {
    if (employeeEmail) {
      return employeeEmail;
    }
    
    return user?.emailAddresses[0]?.emailAddress || 
           (userRole === "admin" ? "admin@letsinsure.hr" : "employee@letsinsure.hr");
  };

  return (
    <>
      <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10 flex-shrink-0">
        <div className="h-full px-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Image
              src="/image.png"
              alt="LetsInsure Logo"
              width={140}
              height={40}
              className="h-8 w-auto"
            />
          </div>
          
          <div className="flex items-center gap-2">
            {userRole === "admin" && (
              <Button 
                variant="outline" 
                size="icon" 
                className="relative"
                onClick={() => setShowNotifications(!showNotifications)}
              >
                <Bell className="h-4 w-4" />
                {pendingCount > 0 && (
                  <span className="absolute -top-1 -right-1 h-5 w-5 rounded-full bg-[#ff9211] border-2 border-background text-white text-xs flex items-center justify-center">
                    {pendingCount}
                  </span>
                )}
              </Button>
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <Sun className="h-[1.2rem] w-[1.2rem] rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                  <Moon className="absolute h-[1.2rem] w-[1.2rem] rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
                  <span className="sr-only">Toggle theme</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setTheme("light")}>
                  Light
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("dark")}>
                  Dark
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setTheme("system")}>
                  System
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user?.imageUrl} alt={getUserName()} />
                    <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">
                      {getUserInitials()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <div className="flex items-center justify-start gap-2 p-2">
                  <div className="flex flex-col space-y-1 leading-none">
                    <p className="font-medium">
                      {getUserName()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {getUserEmail()}
                    </p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => setSettingsOpen(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  <span>Settings</span>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} disabled={isLoggingOut}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>{isLoggingOut ? "Logging out..." : "Log out"}</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* Notifications Dropdown */}
      {userRole === "admin" && showNotifications && (
        <div ref={notificationRef} className="absolute top-14 right-4 w-96 bg-background border rounded-lg shadow-lg z-50">
          <div className="p-4 border-b">
            <h3 className="font-semibold">High Value Policy Alerts ({pendingCount})</h3>
          </div>
          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">
                <Bell className="h-8 w-8 mx-auto mb-2 opacity-50" />
                <p>No pending notifications</p>
              </div>
            ) : (
              <div className="p-2">
                {notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full p-3 text-left hover:bg-muted rounded-lg transition-colors border-b border-border/50 last:border-b-0"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.isUrgent 
                          ? 'bg-red-100 dark:bg-red-900/30' 
                          : notification.type === 'high_value_policy'
                          ? 'bg-amber-100 dark:bg-amber-900/30'
                          : 'bg-blue-100 dark:bg-blue-900/30'
                      }`}>
                        {notification.type === 'high_value_policy' ? (
                          <DollarSign className={`h-4 w-4 ${
                            notification.isUrgent 
                              ? 'text-red-600 dark:text-red-400' 
                              : 'text-amber-600 dark:text-amber-400'
                          }`} />
                        ) : (
                          <Clock className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-sm truncate">{notification.title}</p>
                          {notification.isUrgent && (
                            <AlertTriangle className="h-3 w-3 text-red-500 flex-shrink-0" />
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{notification.description}</p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        employeeName={employeeName}
        employeeEmail={employeeEmail}
        userRole={userRole}
      />
    </>
  );
}