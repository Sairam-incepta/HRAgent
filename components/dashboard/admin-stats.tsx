'use client';

import { useState, useEffect } from "react";
import { Users, Clock, AlertCircle, TrendingUp } from "lucide-react";
import { getEmployees, getPolicySales, getOvertimeRequests } from "@/lib/database";

export function AdminStats() {
  const [stats, setStats] = useState({
    totalEmployees: 0,
    activeEmployees: 0,
    pendingRequests: 0,
    totalPolicies: 0
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const [employees, overtimeRequests] = await Promise.all([
        getEmployees(),
        getOvertimeRequests()
      ]);

      // Get all policy sales for counting
      const allPolicySales = await Promise.all(
        employees.map(emp => getPolicySales(emp.clerk_user_id))
      );
      const totalPolicies = allPolicySales.flat().length;

      const activeEmployees = employees.filter(emp => emp.status === 'active').length;
      const pendingRequests = overtimeRequests.filter(req => req.status === 'pending').length;

      setStats({
        totalEmployees: employees.length,
        activeEmployees,
        pendingRequests,
        totalPolicies
      });
    } catch (error) {
      console.error('Error loading admin stats:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
      {loading ? (
        // Loading state
        Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-4">
            <div className="animate-pulse space-y-2">
              <div className="h-4 bg-muted rounded w-1/2"></div>
              <div className="h-6 bg-muted rounded w-1/3"></div>
            </div>
          </div>
        ))
      ) : (
        <>
          {/* Total Employees */}
          <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Employees</p>
                <p className="text-xl font-semibold text-foreground">{stats.totalEmployees}</p>
              </div>
              <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center">
                <Users className="h-4 w-4 text-[#005cb3] dark:text-blue-400" />
              </div>
            </div>
          </div>

          {/* Active Employees */}
          <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Currently Active</p>
                <div className="flex items-center gap-2">
                  <p className="text-xl font-semibold text-foreground">{stats.activeEmployees}</p>
                  <span className="text-sm text-muted-foreground">
                    ({stats.totalEmployees > 0 ? Math.round((stats.activeEmployees / stats.totalEmployees) * 100) : 0}%)
                  </span>
                </div>
              </div>
              <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center">
                <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>

          {/* Pending Requests */}
          <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Pending Requests</p>
                <p className="text-xl font-semibold text-foreground">{stats.pendingRequests}</p>
              </div>
              <div className="h-8 w-8 bg-yellow-100 dark:bg-yellow-900/30 rounded-lg flex items-center justify-center">
                <AlertCircle className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
              </div>
            </div>
          </div>

          {/* Total Policy Sales */}
          <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Policy Sales</p>
                <p className="text-xl font-semibold text-foreground">{stats.totalPolicies}</p>
              </div>
              <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center">
                <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}