"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";


import { useToast } from "@/hooks/use-toast";
import { User, Mail } from "lucide-react";
import { useUser } from "@clerk/nextjs";

interface SettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName?: string;
  employeeEmail?: string;
  userRole?: "admin" | "employee";
}

export function SettingsDialog({ open, onOpenChange, employeeName, employeeEmail, userRole }: SettingsDialogProps) {
  const { toast } = useToast();
  const { user } = useUser();

  const handleSave = () => {
    // Here you would typically save the settings to your backend
    toast({
      title: "Settings Saved",
      description: "Your preferences have been updated successfully",
    });
    onOpenChange(false);
  };

  // Get the actual employee name
  const getEmployeeName = () => {
    // If we have employee name from database, use it
    if (employeeName && employeeName.trim() !== "") {
      return employeeName;
    }
    
    // Try to get name from Clerk user data
    if (user?.firstName && user?.lastName) {
      const fullName = `${user.firstName} ${user.lastName}`;
      return userRole === "admin" ? `${fullName} (Admin)` : fullName;
    }
    if (user?.firstName) {
      return userRole === "admin" ? `${user.firstName} (Admin)` : user.firstName;
    }
    
    // Final fallback
    return userRole === "admin" ? "Admin User" : "Employee";
  };

  // Get the actual employee email
  const getEmployeeEmail = () => {
    if (employeeEmail && employeeEmail !== "No email") {
      return employeeEmail;
    }
    if (user?.emailAddresses[0]?.emailAddress) {
      return user.emailAddresses[0].emailAddress;
    }
    return "No email";
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Settings</DialogTitle>
        </DialogHeader>
        <div className="space-y-6">
          {/* Employee Information */}
          <div className="space-y-4">
            <h4 className="text-sm font-medium">
              {userRole === "admin" ? "Admin Account Information" : "Employee Information"}
            </h4>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <User className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{getEmployeeName()}</p>
                  <p className="text-xs text-muted-foreground">Name</p>
                </div>
              </div>
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{getEmployeeEmail()}</p>
                  <p className="text-xs text-muted-foreground">Email</p>
                </div>
              </div>
            </div>
          </div>



          <div className="space-y-4">
            <h4 className="text-sm font-medium">Security</h4>
            <div className="space-y-2">
              <Label>Change Password</Label>
              <Input type="password" placeholder="Current password" />
              <Input type="password" placeholder="New password" />
              <Input type="password" placeholder="Confirm new password" />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} className="bg-[#005cb3] hover:bg-[#005cb3]/90">
              Save Changes
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}