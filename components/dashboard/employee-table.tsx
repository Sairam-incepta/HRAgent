"use client";

import { useState } from "react";
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Search, MoreHorizontal, Plus, Filter, CreditCard } from "lucide-react";
import { EmployeeDetailsDialog } from "./employee-details-dialog";

interface Employee {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  status: "active" | "inactive" | "on leave";
}

const dummyEmployees: Employee[] = [
  {
    id: "1",
    name: "John Doe",
    email: "john.doe@company.com",
    department: "Sales",
    position: "Sales Representative",
    status: "active",
  },
  {
    id: "2",
    name: "Jane Smith",
    email: "jane.smith@company.com",
    department: "Customer Service",
    position: "Customer Service Representative",
    status: "active",
  },
  {
    id: "3",
    name: "Robert Johnson",
    email: "robert.johnson@company.com",
    department: "Sales",
    position: "Sales Representative",
    status: "active",
  },
  {
    id: "4",
    name: "Lisa Wilson",
    email: "lisa.wilson@company.com",
    department: "Account Management",
    position: "Account Manager",
    status: "inactive",
  },
  {
    id: "5",
    name: "Michael Brown",
    email: "michael.brown@company.com",
    department: "IT",
    position: "IT Specialist",
    status: "on leave",
  },
];

export function EmployeeTable() {
  const [searchTerm, setSearchTerm] = useState("");
  const [employees] = useState<Employee[]>(dummyEmployees);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);

  const filteredEmployees = employees.filter((employee) =>
    employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.department.toLowerCase().includes(searchTerm.toLowerCase()) ||
    employee.position.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewDetails = (employee: Employee) => {
    setSelectedEmployee(employee);
    setDetailsOpen(true);
  };

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
            <Button variant="outline" size="sm" className="h-10">
              <Filter className="mr-2 h-4 w-4" />
              Filter
            </Button>
            <Button size="sm" className="h-10 bg-teal-600 hover:bg-teal-700">
              <Plus className="mr-2 h-4 w-4" />
              Add Employee
            </Button>
          </div>
        </div>

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Department</TableHead>
                <TableHead className="hidden md:table-cell">Position</TableHead>
                <TableHead className="hidden md:table-cell">Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredEmployees.length > 0 ? (
                filteredEmployees.map((employee) => (
                  <TableRow 
                    key={employee.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => handleViewDetails(employee)}
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
                    <TableCell className="hidden md:table-cell">
                      <Badge 
                        variant="outline"
                        className={
                          employee.status === "active" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : employee.status === "on leave" 
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400" 
                            : "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400"
                        }
                      >
                        {employee.status === "active" 
                          ? "Active" 
                          : employee.status === "on leave" 
                          ? "On Leave" 
                          : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuItem onClick={() => handleViewDetails(employee)}>
                            View Profile
                          </DropdownMenuItem>
                          <DropdownMenuItem>Edit Details</DropdownMenuItem>
                          <DropdownMenuItem>View Time Logs</DropdownMenuItem>
                          <DropdownMenuItem>
                            <CreditCard className="mr-2 h-4 w-4" />
                            Generate Payroll
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive">
                            Deactivate Account
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="h-24 text-center">
                    No employees found.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {selectedEmployee && (
        <EmployeeDetailsDialog
          open={detailsOpen}
          onOpenChange={setDetailsOpen}
          employee={selectedEmployee}
        />
      )}
    </>
  );
}