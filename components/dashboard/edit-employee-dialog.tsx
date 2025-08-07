"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { updateEmployee } from "@/lib/util/employee";
import type { Employee } from "@/lib/supabase";

interface EditEmployeeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: Employee | null;
  onEmployeeUpdated: () => void;
}

export function EditEmployeeDialog({
  open,
  onOpenChange,
  employee,
  onEmployeeUpdated
}: EditEmployeeDialogProps) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [position, setPosition] = useState("");
  const [status, setStatus] = useState<"active" | "inactive" | "on_leave">("active");
  const [maxHoursBeforeOvertime, setMaxHoursBeforeOvertime] = useState(8);
  const [hourlyRate, setHourlyRate] = useState(25);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  // Populate form when employee changes
  useEffect(() => {
    if (employee) {
      setName(employee.name);
      setEmail(employee.email);
      setDepartment(employee.department);
      setPosition(employee.position);
      setStatus(employee.status as "active" | "inactive" | "on_leave");
      setMaxHoursBeforeOvertime(employee.max_hours_before_overtime);
      setHourlyRate(employee.hourly_rate);
    }
  }, [employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!employee) return;

    if (!name || !email || !department || !position) {
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
      const updatedEmployee = await updateEmployee(employee.id, {
        name,
        email,
        department,
        position,
        status,
        maxHoursBeforeOvertime,
        hourlyRate,
      });

      if (updatedEmployee) {
        toast({
          title: "Employee Updated",
          description: `${name}'s information has been successfully updated`,
        });

        onEmployeeUpdated();
        onOpenChange(false);
      } else {
        throw new Error("Failed to update employee");
      }
    } catch (error) {
      console.error('Error updating employee:', error);
      toast({
        title: "Error",
        description: "Failed to update employee. Please try again.",
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
          <DialogTitle>Edit Employee</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                type="text"
                value={hourlyRate || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*\.?\d*$/.test(value)) {
                    setHourlyRate(Number(value));
                  }
                }}
                placeholder="e.g. 25.50"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="maxHours">Max Hours Before OT *</Label>
              <Input
                id="maxHours"
                type="text"
                value={maxHoursBeforeOvertime || ''}
                onChange={(e) => {
                  const value = e.target.value;
                  if (value === '' || /^\d*$/.test(value)) {
                    setMaxHoursBeforeOvertime(Number(value));
                  }
                }}
                placeholder="e.g. 40"
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
            <h4 className="font-medium text-blue-900 dark:text-blue-100 mb-2">Update Notes</h4>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li>• Changes will take effect immediately</li>
              <li>• Employee will be notified when they exceed max hours per day</li>
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
              {isSubmitting ? "Updating..." : "Update Employee"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}