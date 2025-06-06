"use client";

import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { 
  BarChart, 
  Users, 
  Clock, 
  CreditCard, 
  ArrowRight, 
  FileText, 
  AlertCircle,
  ChevronDown,
  ChevronUp 
} from "lucide-react";
import { EmployeeTable } from "@/components/dashboard/employee-table";
import { AdminStats } from "@/components/dashboard/admin-stats";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

export function AdminDashboard() {
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Dashboard</h1>
        <p className="text-muted-foreground">
          Manage employees, track time, and generate reports.
        </p>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="employees">Employees</TabsTrigger>
          <TabsTrigger value="reports">Reports</TabsTrigger>
        </TabsList>
        
        <TabsContent value="overview" className="space-y-4">
          <AdminStats />
          
          <div className="grid gap-4 grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle>Employee Overview</CardTitle>
                <CardDescription>Current status and clock times of employees</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>JD</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">John Doe</p>
                        <p className="text-sm text-muted-foreground">Sales Representative</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge className="bg-green-500">Active</Badge>
                        <p className="text-sm text-muted-foreground mt-1">08:30 AM - Present</p>
                      </div>
                      <Button className="bg-teal-600 hover:bg-teal-700">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Generate Payroll
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>JS</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Jane Smith</p>
                        <p className="text-sm text-muted-foreground">Customer Service</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge className="bg-amber-500">On Break</Badge>
                        <p className="text-sm text-muted-foreground mt-1">09:00 AM - Present</p>
                      </div>
                      <Button className="bg-teal-600 hover:bg-teal-700">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Generate Payroll
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>RJ</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Robert Johnson</p>
                        <p className="text-sm text-muted-foreground">Sales Representative</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge className="bg-green-500">Active</Badge>
                        <p className="text-sm text-muted-foreground mt-1">08:45 AM - Present</p>
                      </div>
                      <Button className="bg-teal-600 hover:bg-teal-700">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Generate Payroll
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarFallback>LW</AvatarFallback>
                      </Avatar>
                      <div>
                        <p className="font-medium">Lisa Wilson</p>
                        <p className="text-sm text-muted-foreground">Account Manager</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <Badge variant="outline">Off Duty</Badge>
                        <p className="text-sm text-muted-foreground mt-1">Not Clocked In</p>
                      </div>
                      <Button className="bg-teal-600 hover:bg-teal-700">
                        <CreditCard className="mr-2 h-4 w-4" />
                        Generate Payroll
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        
        <TabsContent value="employees" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Employee Directory</CardTitle>
                <CardDescription>Manage and view all employees</CardDescription>
              </div>
              <Button className="bg-teal-600 hover:bg-teal-700">
                <CreditCard className="mr-2 h-4 w-4" />
                Generate Payroll
              </Button>
            </CardHeader>
            <CardContent>
              <EmployeeTable />
            </CardContent>
          </Card>
        </TabsContent>
        
        <TabsContent value="reports" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Payroll Reports</CardTitle>
              <CardDescription>Generate and view payroll reports</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CreditCard className="h-8 w-8 text-teal-600" />
                    <div>
                      <p className="font-medium">May 1-15, 2025 Payroll</p>
                      <p className="text-sm text-muted-foreground">15 employees, $25,450 total</p>
                    </div>
                  </div>
                  <Button size="sm">Generate</Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-teal-600" />
                    <div>
                      <p className="font-medium">April 16-30, 2025 Payroll</p>
                      <p className="text-sm text-muted-foreground">15 employees, $24,980 total</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Download</Button>
                </div>
                
                <div className="flex items-center justify-between p-4 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <FileText className="h-8 w-8 text-teal-600" />
                    <div>
                      <p className="font-medium">April 1-15, 2025 Payroll</p>
                      <p className="text-sm text-muted-foreground">14 employees, $23,450 total</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline">Download</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}