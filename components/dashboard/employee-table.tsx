"use client";

import { useState, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, Plus, Filter, CreditCard, Eye, History, Edit } from "lucide-react";
import { EmployeeDetailsDialog } from "./employee-details-dialog";
import { AddEmployeeDialog } from "./add-employee-dialog";
import { EditEmployeeDialog } from "./edit-employee-dialog";
import { PayrollDialog } from "./payroll-dialog";
import { EmployeePayrollHistoryDialog } from "./employee-payroll-history-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getEmployees } from "@/lib/database";
import type { Employee } from "@/lib/supabase";

interface CustomPublicMetadata {
  role?: "admin" | "employee";
}

interface EmployeeTableProps {
  showInOverview?: boolean;
}

export function EmployeeTable({ showInOverview = false }: EmployeeTableProps) {
  const { user } = useUser();
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState(showInOverview ? "active" : "all");
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [addEmployeeOpen, setAddEmployeeOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState<Employee | null>(null);
  const [payrollDialogOpen, setPayrollDialogOpen] = useState(false);
  const [resetPasswordDialogOpen, setResetPasswordDialogOpen] = useState(false);
  const [payrollHistoryDialogOpen, setPayrollHistoryDialogOpen] = useState(false);
  const [payrollEmployee, setPayrollEmployee] = useState<string | null>(null);
  const [historyEmployeeId, setHistoryEmployeeId] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);

  useEffect(() => {
    if (user) {
      // Get role from Clerk metadata on client side
      const publicMetadata = user.publicMetadata as CustomPublicMetadata;
      const role = publicMetadata?.role || "employee";
      setUserRole(role);
    }
  }, [user]);

  useEffect(() => {
    loadEmployees();
  }, []);

  const loadEmployees = async () => {
    try {
      const data = await getEmployees();
      setEmployees(data);
    } catch (error) {
      console.error('Error loading employees:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredEmployees = employees.filter((employee) => {
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.position.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || employee.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailsDialogOpen(true);
  };

  const handleEditEmployee = (employee: Employee) => {
    setEditingEmployee(employee);
    setEditDialogOpen(true);
  };

  const handleGeneratePayroll = (employee: Employee) => {
    setPayrollEmployee(employee.clerk_user_id);
    setPayrollDialogOpen(true);
  };

  const handleViewPayrollHistory = (employee: Employee) => {
    setHistoryEmployeeId(employee.clerk_user_id);
    setPayrollHistoryDialogOpen(true);
  };

  const handleAddEmployeeSuccess = () => {
    loadEmployees(); // Refresh the employee list
  };

  const handleEmployeeUpdated = () => {
    loadEmployees(); // Refresh the employee list
  };

  // Helper function to display status with proper formatting
  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'active': return 'Active';
      case 'inactive': return 'Inactive';
      case 'on_leave': return 'On Leave';
      default: return status;
    }
  };

  // Helper function to get status badge color
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'active': 
        return "bg-[#005cb3]/10 text-[#005cb3] dark:bg-[#005cb3]/30 dark:text-[#005cb3]";
      case 'on_leave': 
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400";
      case 'inactive':
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400";
    }
  };

  const isAdmin = userRole === "admin";

  if (loading) {
    return <div className="text-center py-4">Loading employees...</div>;
  }

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row justify-between gap-3">
          <div className="relative max-w-sm">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              type="search"
              placeholder="Search employees..."
              className="pl-8 w-full md:w-[300px]"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
                <SelectItem value="on_leave">On Leave</SelectItem>
              </SelectContent>
            </Select>
            {/* Show Add Employee button for admins */}
            {isAdmin && (
              <Button 
                size="sm" 
                className="h-10 bg-[#005cb3] hover:bg-[#005cb3]/90"
                onClick={() => setAddEmployeeOpen(true)}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Employee
              </Button>
            )}
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="hidden md:table-cell">Position</TableHead>
                <TableHead className="hidden lg:table-cell">Overtime Limit</TableHead>
                <TableHead className="hidden lg:table-cell">Hourly Rate</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <TableRow 
                    key={employee.id}
                    className="hover:bg-muted/50"
                  >
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <Avatar className="h-8 w-8">
                          <AvatarFallback>
                            {employee.name.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        <div>
                          <p>{employee.name}</p>
                          <p className="text-xs text-muted-foreground">{employee.email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{employee.department}</TableCell>
                    <TableCell className="hidden md:table-cell">{employee.position}</TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm">{employee.max_hours_before_overtime}h</span>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <span className="text-sm">${employee.hourly_rate}/hr</span>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <Badge 
                        variant="outline"
                        className={getStatusBadgeClass(employee.status)}
                      >
                        {getStatusDisplay(employee.status)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewDetails(employee)}
                          className="h-8"
                        >
                          <Eye className="mr-1 h-3 w-3" />
                          Details
                        </Button>
                        {isAdmin && (
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => handleEditEmployee(employee)}
                            className="h-8"
                          >
                            <Edit className="mr-1 h-3 w-3" />
                            Edit
                          </Button>
                        )}
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleGeneratePayroll(employee)}
                          className="h-8"
                        >
                          <CreditCard className="mr-1 h-3 w-3" />
                          Payroll
                        </Button>
                        <Button 
                          variant="outline" 
                          size="sm"
                          onClick={() => handleViewPayrollHistory(employee)}
                          className="h-8"
                        >
                          <History className="mr-1 h-3 w-3" />
                          History
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="h-24 text-center">
                    {employees.length === 0 ? "No employees found in the system." : "No employees found matching your filters."}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          employee={selectedEmployee}
        />
      )}

      {/* Show Add Employee dialog for admins */}
      {isAdmin && (
        <AddEmployeeDialog
          open={addEmployeeOpen}
          onOpenChange={setAddEmployeeOpen}
          onAddEmployee={handleAddEmployeeSuccess}
        />
      )}

      {/* Show Edit Employee dialog for admins */}
      {isAdmin && (
        <EditEmployeeDialog
          open={editDialogOpen}
          onOpenChange={setEditDialogOpen}
          employee={editingEmployee}
          onEmployeeUpdated={handleEmployeeUpdated}
        />
      )}

      <PayrollDialog
        open={payrollDialogOpen}
        onOpenChange={setPayrollDialogOpen}
        employeeName={payrollEmployee}
      />

      <EmployeePayrollHistoryDialog
        open={payrollHistoryDialogOpen}
        onOpenChange={setPayrollHistoryDialogOpen}
        employeeId={historyEmployeeId}
      />
    </>
  );
}