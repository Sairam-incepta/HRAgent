"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar, BarChart, FileText, TrendingUp, DollarSign } from "lucide-react";

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
  // Mock policy data for the employee
  const employeePolicies = [
    {
      policyNumber: "POL-2025-001",
      clientName: "John Smith",
      policyType: "Auto Insurance",
      amount: 1200,
      brokerFee: 120,
      bonus: 110,
      saleDate: "2025-01-15",
      crossSold: true,
      crossSoldType: "Home Insurance",
      clientDescription: "Young professional, first-time homeowner, very interested in bundling policies for savings"
    },
    {
      policyNumber: "POL-2025-002",
      clientName: "Sarah Johnson",
      policyType: "Home Insurance",
      amount: 800,
      brokerFee: 80,
      bonus: 70,
      saleDate: "2025-01-18",
      crossSold: false,
      clientDescription: "Elderly client, downsizing home, needed basic coverage with good customer service"
    },
    {
      policyNumber: "POL-2025-003",
      clientName: "Mike Davis",
      policyType: "Life Insurance",
      amount: 2500,
      brokerFee: 250,
      bonus: 240,
      saleDate: "2025-01-20",
      crossSold: true,
      crossSoldType: "Disability Insurance",
      clientDescription: "Family man with two kids, concerned about financial security, very thorough in asking questions"
    }
  ];

  const totalPolicies = employeePolicies.length;
  const totalSales = employeePolicies.reduce((sum, policy) => sum + policy.amount, 0);
  const totalBonus = employeePolicies.reduce((sum, policy) => sum + policy.bonus, 0);
  const crossSoldCount = employeePolicies.filter(policy => policy.crossSold).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
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
              <TabsTrigger value="policies">Policies Sold</TabsTrigger>
              <TabsTrigger value="attendance">Attendance</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
                    <CardTitle className="text-sm font-medium">Policies Sold</CardTitle>
                    <TrendingUp className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">{totalPolicies}</div>
                    <p className="text-xs text-muted-foreground">
                      {crossSoldCount} cross-sold
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Total Sales</CardTitle>
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalSales.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      This month
                    </p>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                    <CardTitle className="text-sm font-medium">Bonus Earned</CardTitle>
                    <BarChart className="h-4 w-4 text-muted-foreground" />
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">${totalBonus.toLocaleString()}</div>
                    <p className="text-xs text-muted-foreground">
                      10% after first $100
                    </p>
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
                        <p className="font-medium">Policy Sale</p>
                        <p className="text-sm text-muted-foreground">Yesterday - Life Insurance $2,500</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="h-8 w-8 rounded-full bg-teal-600/10 flex items-center justify-center">
                        <Calendar className="h-4 w-4 text-teal-600" />
                      </div>
                      <div>
                        <p className="font-medium">Client Meeting</p>
                        <p className="text-sm text-muted-foreground">2 days ago - Cross-sell opportunity</p>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Policies Sold</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {employeePolicies.map((policy, index) => (
                      <div key={index} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{policy.policyNumber}</h4>
                            <p className="text-sm text-muted-foreground">{policy.clientName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium">${policy.amount.toLocaleString()}</p>
                            <p className="text-sm text-muted-foreground">{policy.saleDate}</p>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Type:</span>
                            <span className="ml-2 font-medium">{policy.policyType}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Broker Fee:</span>
                            <span className="ml-2 font-medium">${policy.brokerFee}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Bonus:</span>
                            <span className="ml-2 font-medium text-[#005cb3]">${policy.bonus}</span>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Cross-sold:</span>
                            <span className="ml-2 font-medium">
                              {policy.crossSold ? `Yes - ${policy.crossSoldType}` : "No"}
                            </span>
                          </div>
                        </div>
                        
                        {policy.clientDescription && (
                          <div className="bg-muted/50 rounded p-3">
                            <p className="text-sm">
                              <span className="font-medium">Client Notes:</span> {policy.clientDescription}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
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
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}