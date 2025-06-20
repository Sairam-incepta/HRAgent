"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { 
  Clock, 
  BarChart, 
  MessageSquare, 
  FileText, 
  Settings, 
  Users, 
  LogOut,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";

interface DashboardSidebarProps {
  userRole: "admin" | "employee";
  onToggleRole: () => void;
  employeeName?: string;
  employeeEmail?: string;
}

export function DashboardSidebar({ userRole, onToggleRole, employeeName, employeeEmail }: DashboardSidebarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  const handleNavigation = (tabValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", tabValue);
    params.set("role", userRole);
    router.push(`/dashboard?${params.toString()}`);
    setIsOpen(false);
  };

  const employeeNavItems = [
    {
      title: "Time Tracking",
      icon: Clock,
      tabValue: "time",
    },
    {
      title: "Overview",
      icon: BarChart,
      tabValue: "overview",
    },
  ];

  const adminNavItems = [
    {
      title: "Overview",
      icon: BarChart,
      tabValue: "overview",
    },
    {
      title: "Employees",
      icon: Users,
      tabValue: "employees",
    },
    {
      title: "Reports",
      icon: FileText,
      tabValue: "reports",
    },
  ];

  const navItems = userRole === "admin" ? adminNavItems : employeeNavItems;

  return (
    <>
      <Button
        variant="outline"
        size="icon"
        className="absolute top-3 left-4 z-50 md:hidden"
        onClick={toggleSidebar}
      >
        {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
      </Button>

      <div
        className={cn(
          "fixed inset-0 z-40 bg-background/80 backdrop-blur-sm md:hidden",
          isOpen ? "block" : "hidden"
        )}
        onClick={toggleSidebar}
      />

      <aside 
        className={cn(
          "fixed md:sticky top-0 left-0 z-40 h-full w-64 border-r bg-background transition-transform duration-300 md:translate-x-0", 
          isOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-14 items-center border-b px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-teal-600" />
            <span className="font-bold">LetsInsure HR</span>
          </Link>
        </div>
        <div className="flex flex-col gap-1 p-4">
          <p className="text-xs font-medium text-muted-foreground mb-2 uppercase">
            {userRole === "admin" ? "Admin Portal" : "Employee Portal"}
          </p>
          <nav className="grid gap-1">
            {navItems.map((item, index) => (
              <button
                key={index}
                onClick={() => handleNavigation(item.tabValue)}
                className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground text-left w-full"
              >
                <item.icon className="h-4 w-4" />
                {item.title}
              </button>
            ))}
          </nav>
          
          <div className="mt-auto pt-4 border-t">
            <Button 
              variant="outline" 
              className="w-full justify-start mb-2"
              onClick={onToggleRole}
            >
              <Users className="mr-2 h-4 w-4" />
              Switch to {userRole === "admin" ? "Employee" : "Admin"} View
            </Button>
            <Button 
              variant="outline" 
              className="w-full justify-start mb-2"
              onClick={() => setSettingsOpen(true)}
            >
              <Settings className="mr-2 h-4 w-4" />
              Settings
            </Button>
            <Button variant="outline" className="w-full justify-start text-destructive">
              <LogOut className="mr-2 h-4 w-4" />
              Log Out
            </Button>
          </div>
        </div>
      </aside>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        employeeName={employeeName}
        employeeEmail={employeeEmail}
      />
    </>
  );
}