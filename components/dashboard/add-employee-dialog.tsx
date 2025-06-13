"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { createEmployee } from "@/lib/database";

interface AddEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAddEmployee: () => void;
}

export function AddEmployeeDialog({ open, onOpenChange, onAddEmployee }: AddEmployeeDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [clerkUserId, setClerkUserId] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "on_leave">("active");
  const [maxHoursBeforeOvertime, setMaxHoursBeforeOvertime] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!name || !email || !clerkUserId || !department || !position) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (maxHoursBeforeOvertime <= 0 || maxHoursBeforeOvertime > 24) {
      toast({
        title: "Error",
        description: "Maximum hours before overtime must be between 1 and 24",
        variant: "destructive",
      });
      return;
    }

    if (hourlyRate <= 0) {
      toast({
        title: "Error",
        description: "Hourly rate must be greater than 0",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const newEmployee = await createEmployee({
        clerkUserId,
        name,
        email,
        department,
        position,
        status,
        maxHoursBeforeOvertime,
        hourlyRate,
      });

      if (newEmployee) {
        toast({
          title: "Employee Added",
          description: `${name} has been successfully added to the system`,
        });

        // Reset form
        setName("");
        setEmail("");
        setClerkUserId("");
        setDepartment("");
        setPosition("");
        setStatus("active");
        setMaxHoursBeforeOvertime(8);
        setHourlyRate(25);
        
        onAddEmployee(); // Refresh the employee list
        onOpenChange(false);
      } else {
        throw new Error("Failed to create employee");
      }
    } catch (error) {
      console.error('Error creating employee:', error);
      toast({
        title: "Error",
        description: "Failed to add employee. Please check if the Clerk User ID already exists or try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="clerkUserId">Clerk User ID *</Label>
            <Input
              id="clerkUserId"
              value={clerkUserId}
              onChange={(e) => setClerkUserId(e.target.value)}
              placeholder="user_2y2ylH58JkmHljhJT0BXIfjHQui"
              required
            />
            <p className="text-xs text-muted-foreground">
              Get this from the Clerk Dashboard for the user
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Enter full name"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Enter email address"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="department">Department *</Label>
            <Select value={department} onValueChange={setDepartment}>
              <SelectTrigger>
                <SelectValue placeholder="Select department" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Sales">Sales</SelectItem>
                <SelectItem value="Customer Service">Customer Service</SelectItem>
                <SelectItem value="Account Management">Account Management</SelectItem>
                <SelectItem value="IT">IT</SelectItem>
                <SelectItem value="HR">HR</SelectItem>
                <SelectItem value="Finance">Finance</SelectItem>
                <SelectItem value="Marketing">Marketing</SelectItem>
                <SelectItem value="Administration">Administration</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="position">Position *</Label>
            <Input
              id="position"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="Enter job position"
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="hourlyRate">Hourly Rate ($) *</Label>
              <Input
                id="hourlyRate"
                type="number"
                min="1"
                step="0.01"
                value={hourlyRate}
                onChange={(e) => setHourlyRate(parseFloat(e.target.value) || 0)}
                placeholder="25.00"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxHours">Max Hours Before OT *</Label>
              <Input
                id="maxHours"
                type="number"
                min="1"
                max="24"
                value={maxHoursBeforeOvertime}
                onChange={(e) => setMaxHoursBeforeOvertime(parseInt(e.target.value) || 8)}
                placeholder="8"
                required
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select value={status} onValueChange={(value: "active" | "inactive" | "on_leave") => setStatus(value)}>
              <SelectTrigger>
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="bg-blue-50 dark:bg-blue-950/20 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Important Notes</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• The Clerk User ID must match exactly with the user's ID in Clerk</li>
              <li>• Employee will be notified when they exceed max hours per day</li>
              <li>• Overtime is calculated at 1.5x the hourly rate</li>
              <li>• All fields marked with * are required</li>
            </ul>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              className="bg-[#005cb3] hover:bg-[#005cb3]/90"
              disabled={isSubmitting}
            >
              {isSubmitting ? "Adding..." : "Add Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}