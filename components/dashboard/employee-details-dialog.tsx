"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Clock, Calendar, BarChart, FileText, TrendingUp, DollarSign } from "lucide-react";
import { getPolicySales, getClientReviews, getEmployeeBonus } from "@/lib/database";

interface EmployeeDetailsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employee: {
    id: string;
    clerk_user_id: string;
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
  const [employeePolicies, setEmployeePolicies] = useState<any[]>([]);
  const [clientReviews, setClientReviews] = useState<any[]>([]);
  const [employeeBonus, setEmployeeBonus] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open && employee?.clerk_user_id) {
      loadEmployeeData();
    }
  }, [open, employee?.clerk_user_id]);

  const loadEmployeeData = async () => {
    if (!employee?.clerk_user_id) return;
    
    setLoading(true);
    try {
      const [policies, reviews, bonus] = await Promise.all([
        getPolicySales(employee.clerk_user_id),
        getClientReviews(employee.clerk_user_id),
        getEmployeeBonus(employee.clerk_user_id)
      ]);
      
      setEmployeePolicies(policies);
      setClientReviews(reviews);
      setEmployeeBonus(bonus);
    } catch (error) {
      console.error('Error loading employee data:', error);
    } finally {
      setLoading(false);
    }
  };

  const totalPolicies = employeePolicies.length;
  const totalSales = employeePolicies.reduce((sum, policy) => sum + policy.amount, 0);
  const totalBonus = employeeBonus?.total_bonus || 0;
  const crossSoldCount = employeePolicies.filter(policy => policy.cross_sold).length;

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
                      : employee.status === "on_leave" 
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
              <TabsTrigger value="reviews">Client Reviews</TabsTrigger>
            </TabsList>

            <TabsContent value="overview" className="space-y-4">
              {loading ? (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
                  {[...Array(4)].map((_, i) => (
                    <Card key={i}>
                      <CardContent className="p-6">
                        <div className="animate-pulse">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-8 bg-gray-200 rounded w-1/2"></div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="grid gap-4 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
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
                        All time
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

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                      <CardTitle className="text-sm font-medium">Client Reviews</CardTitle>
                      <FileText className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{clientReviews.length}</div>
                      <p className="text-xs text-muted-foreground">
                        {clientReviews.length > 0 
                          ? `Avg: ${(clientReviews.reduce((sum, r) => sum + r.rating, 0) / clientReviews.length).toFixed(1)}/5`
                          : 'No reviews yet'
                        }
                      </p>
                    </CardContent>
                  </Card>
                </div>
              )}

              <Card>
                <CardHeader>
                  <CardTitle>Recent Activity</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse flex items-center gap-4">
                          <div className="h-8 w-8 rounded-full bg-gray-200"></div>
                          <div className="flex-1">
                            <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                            <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {employeePolicies.slice(0, 3).map((policy, index) => (
                        <div key={index} className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-full bg-teal-600/10 flex items-center justify-center">
                            <FileText className="h-4 w-4 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-medium">Policy Sale - {policy.policy_type}</p>
                            <p className="text-sm text-muted-foreground">
                              {policy.client_name} - ${policy.amount.toLocaleString()} - {new Date(policy.sale_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      {clientReviews.slice(0, 2).map((review, index) => (
                        <div key={`review-${index}`} className="flex items-center gap-4">
                          <div className="h-8 w-8 rounded-full bg-blue-600/10 flex items-center justify-center">
                            <BarChart className="h-4 w-4 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium">Client Review - {review.rating}/5 stars</p>
                            <p className="text-sm text-muted-foreground">
                              {review.client_name} - {new Date(review.review_date).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                      ))}
                      {employeePolicies.length === 0 && clientReviews.length === 0 && (
                        <p className="text-muted-foreground text-center py-4">No recent activity found.</p>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="policies" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Policies Sold ({totalPolicies})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse border rounded-lg p-4">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="h-3 bg-gray-200 rounded"></div>
                            <div className="h-3 bg-gray-200 rounded"></div>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : employeePolicies.length > 0 ? (
                    <div className="space-y-4">
                      {employeePolicies.map((policy, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{policy.policy_number}</h4>
                              <p className="text-sm text-muted-foreground">{policy.client_name}</p>
                            </div>
                            <div className="text-right">
                              <p className="font-medium">${policy.amount.toLocaleString()}</p>
                              <p className="text-sm text-muted-foreground">{new Date(policy.sale_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-4 text-sm">
                            <div>
                              <span className="text-muted-foreground">Type:</span>
                              <span className="ml-2 font-medium">{policy.policy_type}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Broker Fee:</span>
                              <span className="ml-2 font-medium">${policy.broker_fee}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Bonus:</span>
                              <span className="ml-2 font-medium text-[#005cb3]">${policy.bonus}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Cross-sold:</span>
                              <span className="ml-2 font-medium">
                                {policy.cross_sold ? `Yes - ${policy.cross_sold_type}` : "No"}
                              </span>
                            </div>
                          </div>
                          
                          {policy.client_description && (
                            <div className="bg-muted/50 rounded p-3">
                              <p className="text-sm">
                                <span className="font-medium">Client Notes:</span> {policy.client_description}
                              </p>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No policies sold yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="reviews" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Client Reviews ({clientReviews.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="space-y-4">
                      {[...Array(3)].map((_, i) => (
                        <div key={i} className="animate-pulse border rounded-lg p-4">
                          <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
                          <div className="h-3 bg-gray-200 rounded w-1/2 mb-3"></div>
                          <div className="h-3 bg-gray-200 rounded w-full"></div>
                        </div>
                      ))}
                    </div>
                  ) : clientReviews.length > 0 ? (
                    <div className="space-y-4">
                      {clientReviews.map((review, index) => (
                        <div key={index} className="border rounded-lg p-4 space-y-3">
                          <div className="flex justify-between items-start">
                            <div>
                              <h4 className="font-semibold">{review.client_name}</h4>
                              <p className="text-sm text-muted-foreground">Policy: {review.policy_number}</p>
                            </div>
                            <div className="text-right">
                              <div className="flex items-center gap-1">
                                {[...Array(5)].map((_, i) => (
                                  <span key={i} className={`text-sm ${i < review.rating ? 'text-yellow-500' : 'text-gray-300'}`}>
                                    ★
                                  </span>
                                ))}
                                <span className="ml-1 text-sm font-medium">{review.rating}/5</span>
                              </div>
                              <p className="text-sm text-muted-foreground">{new Date(review.review_date).toLocaleDateString()}</p>
                            </div>
                          </div>
                          
                          <div className="bg-muted/50 rounded p-3">
                            <p className="text-sm">"{review.review}"</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-center py-8 text-muted-foreground">No client reviews yet.</p>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </DialogContent>
    </Dialog>
  );
}