"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar, BarChart, FileText } from "lucide-react";

interface EmployeeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    name: string;
    email: string;
    department: string;
    position: string;
    status: string;
  };
}

export function EmployeeDetailsDialog({
  open,
  onOpenChange,
  employee,
}: EmployeeDetailsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Employee Details</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="text-lg">
                {employee.name.split(" ").map(n => n[0]).join("")}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-xl font-semibold">{employee.name}</h2>
              <p className="text-muted-foreground">{employee.email}</p>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline">{employee.department}</Badge>
                <Badge variant="outline">{employee.position}</Badge>
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
                  {employee.status}
                </Badge>
              </div>
            </div>
          </div>

          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">This Month</CardTitle>
                    <Clock className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">164.5 hours</div>
                    <p className="text-xs text-muted-foreground">
                      Target: 168 hours
                    </p>
                    <Progress value={98} className="mt-3" />
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Performance Score</CardTitle>
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">92%</div>
                    <p className="text-xs text-muted-foreground">
                      +5% from last month
                    </p>
                    <Progress value={92} className="mt-3" />
                  </CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-teal-600/10 flex items-center justify-center">
                        <Clock className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium">Clocked In</p>
                        <p className="text-sm text-muted-foreground">Today at 8:30 AM</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-teal-600/10 flex items-center justify-center">
                        <FileText className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium">Submitted Report</p>
                        <p className="text-sm text-muted-foreground">Yesterday at 4:45 PM</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-teal-600/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium">Vacation Request</p>
                        <p className="text-sm text-muted-foreground">2 days ago</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="attendance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Attendance History</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[...Array(5)].map((_, i) => (
                      <div key={i} className="flex justify-between items-center py-2 border-b">
                        <div>
                          <p className="font-medium">May {10 - i}, 2025</p>
                          <p className="text-sm text-muted-foreground">8:30 AM - 5:30 PM</p>
                        </div>
                        <div className="text-right">
                          <p>8h 30m</p>
                          <p className="text-sm text-muted-foreground">Regular Hours</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="performance" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Performance Metrics</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <div>
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">Sales Target</p>
                        <p>95%</p>
                      </div>
                      <Progress value={95} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">Customer Satisfaction</p>
                        <p>88%</p>
                      </div>
                      <Progress value={88} />
                    </div>
                    <div>
                      <div className="flex justify-between mb-2">
                        <p className="font-medium">Task Completion</p>
                        <p>92%</p>
                      </div>
                      <Progress value={92} />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}