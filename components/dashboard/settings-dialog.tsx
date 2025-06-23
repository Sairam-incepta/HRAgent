"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { User, Mail, Eye, EyeOff } from "lucide-react";
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
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isUpdatingPassword, setIsUpdatingPassword] = useState(false);

  const handlePasswordReset = async () => {
    if (!currentPassword || !newPassword || !confirmPassword) {
      toast({
        title: "Error",
        description: "Please fill in all password fields",
        variant: "destructive",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      toast({
        title: "Error",
        description: "New passwords do not match",
        variant: "destructive",
      });
      return;
    }

    if (newPassword.length < 8) {
      toast({
        title: "Error",
        description: "Password must be at least 8 characters long",
        variant: "destructive",
      });
      return;
    }

    setIsUpdatingPassword(true);

    try {
      // Update password using Clerk's updatePassword method
      await user?.updatePassword({
        currentPassword,
        newPassword,
      });

      toast({
        title: "Password Updated",
        description: "Your password has been updated successfully",
      });

      // Clear password fields
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      
    } catch (error: any) {
      console.error('Password update error:', error);
      toast({
        title: "Error",
        description: error.errors?.[0]?.message || "Failed to update password. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsUpdatingPassword(false);
    }
  };

  const handleSave = () => {
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
            <div className="space-y-3">
              <Label>Change Password</Label>
              
              <div className="space-y-2">
                <Label htmlFor="currentPassword" className="text-sm">Current Password</Label>
                <div className="relative">
                  <Input
                    id="currentPassword"
                    type={showCurrentPassword ? "text" : "password"}
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  >
                    {showCurrentPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="newPassword" className="text-sm">New Password</Label>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                  >
                    {showNewPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="text-sm">Confirm New Password</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Confirm new password"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 hover:bg-transparent"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <Button
                onClick={handlePasswordReset}
                disabled={isUpdatingPassword}
                className="w-full"
                variant="outline"
              >
                {isUpdatingPassword ? "Updating..." : "Update Password"}
              </Button>
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