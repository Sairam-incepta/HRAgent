"use client";

import { Bell, Moon, Settings, Sun, LogOut } from "lucide-react";
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
import { useState } from "react";
import Image from "next/image";
import { useClerk, useUser } from "@clerk/nextjs";

interface DashboardHeaderProps {
  userRole: "admin" | "employee";
  employeeName?: string;
  employeeEmail?: string;
}

export function DashboardHeader({ userRole, employeeName, employeeEmail }: DashboardHeaderProps) {
  const { setTheme } = useTheme();
  const [settingsOpen, setSettingsOpen] = useState(false);
  const { signOut } = useClerk();
  const { user } = useUser();

  const handleLogout = () => {
    signOut();
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
      return `${user.firstName} ${user.lastName}`;
    }
    if (user?.firstName) {
      return user.firstName;
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
      <header className="h-14 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-10">
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
            <Button variant="outline" size="icon" className="relative">
              <Bell className="h-4 w-4" />
              <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-[#ff9211] border-2 border-background"></span>
            </Button>

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
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      <SettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        employeeName={employeeName}
        employeeEmail={employeeEmail}
      />
    </>
  );
}