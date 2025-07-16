'use client';

import { useState, useEffect } from "react";
import { Users, Clock, TrendingUp, DollarSign } from "lucide-react";
import { getEmployees } from "@/lib/util/employee";
import { getPolicySales } from "@/lib/util/policies";
import { calculateActualHoursForPeriod } from "@/lib/util/misc";
import { getTotalPolicySalesAmount } from "@/lib/util/admin-dashboard-widgets";
import { getTodayTimeTracking } from "@/lib/util/today";
import { getPayrollPeriodDetails } from "@/lib/util/payroll";
import { dashboardEvents } from "@/lib/events";

export function AdminStats() {
  const [stats, setStats] = useState({
    clockedInEmployees: { clockedIn: 0, total: 0 },
    totalHours: 0,
    totalPolicies: 0,
    totalPolicySalesAmount: 0,
    overtimeHoursThisWeek: 0,
    regularHoursThisWeek: 0,
    expenditure: 0
  });
  const [loading, setLoading] = useState(true);



  useEffect(() => {
    loadStats();
  }, []);

  // Listen for real-time events
  useEffect(() => {
    const handlePolicySale = () => {
      loadStats(); // Refresh stats when new policy is added
    };

    const handleRequest = () => {
      loadStats(); // Refresh stats when new request is added
    };

    const unsubscribe1 = dashboardEvents.on('policy_sale', handlePolicySale);
    const unsubscribe2 = dashboardEvents.on('request_submitted', handleRequest);

    return () => {
      unsubscribe1();
      unsubscribe2();
    };
  }, []);

  const loadStats = async () => {
    try {      
      // Get employees (all employees - role is handled by Clerk, not database)
      const employees = await getEmployees();
      
      let totalPolicies = 0;
      let totalHours = 0;
      let totalOvertimeThisWeek = 0;
      let totalRegularHoursThisWeek = 0;
      let clockedInCount = 0;
      
      // Calculate current biweekly period dates
      const currentDate = new Date();
      const referenceDate = new Date('2025-01-06'); // Monday, January 6, 2025
      const daysSinceReference = Math.floor((currentDate.getTime() - referenceDate.getTime()) / (24 * 60 * 60 * 1000));
      const biweeklyPeriodsSinceReference = Math.floor(daysSinceReference / 14);
      
      const currentPeriodStart = new Date(referenceDate);
      currentPeriodStart.setDate(referenceDate.getDate() + (biweeklyPeriodsSinceReference * 14));
      const currentPeriodEnd = new Date(currentPeriodStart);
      currentPeriodEnd.setDate(currentPeriodStart.getDate() + 13);
      
      // Get current week dates for overtime calculation
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDate.getDay()); // Sunday
      startOfWeek.setHours(0, 0, 0, 0);
      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6); // Saturday
      endOfWeek.setHours(23, 59, 59, 999);
      
      // Get policy sales and hours for each employee using correct employee ID
      for (const employee of employees) {

        // Skip admin users for hour calculations (they don't clock in/out)
        const isAdmin = employee.position === 'HR Manager' || employee.email === 'admin@letsinsure.hr';
        
        if (!isAdmin) {
          // Check if employee is currently clocked in
          const { clockedIn } = await getTodayTimeTracking(employee.clerk_user_id);
          if (clockedIn) {
            clockedInCount++;
          }
          
          // Calculate hours for current biweekly period using clerk_user_id
          const empHours = await calculateActualHoursForPeriod(employee.clerk_user_id, currentPeriodStart, currentPeriodEnd);
          totalHours += empHours;
          
          // Calculate this week's hours and overtime (using 40-hour weekly limit)
          const weekHours = await calculateActualHoursForPeriod(employee.clerk_user_id, startOfWeek, endOfWeek);
          const weeklyOvertimeLimit = 40; // Standard 40-hour work week
          
          if (weekHours > weeklyOvertimeLimit) {
            const overtime = weekHours - weeklyOvertimeLimit;
            totalOvertimeThisWeek += overtime;
            totalRegularHoursThisWeek += weeklyOvertimeLimit;
          } else {
            totalRegularHoursThisWeek += weekHours;
          }
        }
        
        // Get policy sales using clerk_user_id (this is what's stored in policy_sales.employee_id)
        const policySales = await getPolicySales(employee.clerk_user_id);
        
        totalPolicies += policySales.length;
      }
      
      // Get new stats using the new functions
      const totalPolicySalesAmount = await getTotalPolicySalesAmount();
      
      // Calculate expenditure based on actual payroll costs (use the same period as calculated above)
      const payrollDetails = await getPayrollPeriodDetails(
        currentPeriodStart.toISOString().split('T')[0],
        currentPeriodEnd.toISOString().split('T')[0]
      );
      
      const expenditure = payrollDetails.summary.totalPay;

      setStats({
        clockedInEmployees: { clockedIn: clockedInCount, total: employees.length },
        totalHours,
        totalPolicies,
        totalPolicySalesAmount,
        overtimeHoursThisWeek: totalOvertimeThisWeek,
        regularHoursThisWeek: totalRegularHoursThisWeek,
        expenditure
      });
      
    } catch (error) {
      console.error("❌ AdminStats: Error loading statistics:", error);
    } finally {
      setLoading(false);
    }
  };

  // Format hours with minutes
  const formatHours = (totalHours: number) => {
    const hours = Math.floor(totalHours);
    const minutes = Math.round((totalHours - hours) * 60);
    return `${hours}h ${minutes}m`;
  };

  if (loading) {
    return (
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-card rounded-lg border p-4 h-20">
            <div className="animate-pulse flex items-center justify-between h-full">
              <div className="flex flex-col justify-center space-y-2 flex-1">
                <div className="h-3 bg-muted rounded w-2/3"></div>
                <div className="h-6 bg-muted rounded w-1/3"></div>
              </div>
              <div className="h-8 w-8 bg-muted rounded-lg flex-shrink-0 ml-3"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5">
        {/* Total Employees */}
        <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
          <div className="flex items-center justify-between h-full">
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-xs text-muted-foreground leading-tight truncate">Clocked In</p>
              <p className="text-2xl font-semibold text-foreground leading-tight">
                {stats.clockedInEmployees.clockedIn}/{stats.clockedInEmployees.total}
              </p>
            </div>
            <div className="h-8 w-8 bg-blue-100 dark:bg-blue-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
              <Users className="h-4 w-4 text-[#005cb3] dark:text-blue-400" />
            </div>
          </div>
        </div>

        {/* Weekly Hours Overview */}
        <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
          <div className="flex items-center justify-between h-full">
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-xs text-muted-foreground leading-tight truncate">Weekly Hours</p>
              <p className="text-2xl font-semibold text-foreground leading-tight">
                {formatHours(stats.regularHoursThisWeek + stats.overtimeHoursThisWeek)}
              </p>
            </div>
            <div className="h-8 w-8 bg-green-100 dark:bg-green-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
              <Clock className="h-4 w-4 text-green-600 dark:text-green-400" />
            </div>
          </div>
        </div>

        {/* Overtime Hours */}
        <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
          <div className="flex items-center justify-between h-full">
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-xs text-muted-foreground leading-tight truncate">Overtime Hours</p>
              <p className="text-2xl font-semibold text-amber-600 leading-tight">
                {formatHours(stats.overtimeHoursThisWeek)}
              </p>
            </div>
            <div className="h-8 w-8 bg-amber-100 dark:bg-amber-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
              <Clock className="h-4 w-4 text-amber-600 dark:text-amber-400" />
            </div>
          </div>
        </div>

        {/* Policy Sales */}
        <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
          <div className="flex items-center justify-between h-full">
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-xs text-muted-foreground leading-tight truncate">Policy Sales</p>
              <p className="text-2xl font-semibold text-foreground leading-tight">
                ${Math.round(stats.totalPolicySalesAmount).toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-8 bg-purple-100 dark:bg-purple-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
              <TrendingUp className="h-4 w-4 text-purple-600 dark:text-purple-400" />
            </div>
          </div>
        </div>

        {/* Expenditure */}
        <div className="bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow h-20">
          <div className="flex items-center justify-between h-full">
            <div className="flex flex-col justify-center min-w-0 flex-1">
              <p className="text-xs text-muted-foreground leading-tight truncate">Expenditure</p>
              <p className="text-2xl font-semibold text-foreground leading-tight">
                ${Math.round(stats.expenditure).toLocaleString()}
              </p>
            </div>
            <div className="h-8 w-8 bg-orange-100 dark:bg-orange-900/30 rounded-lg flex items-center justify-center flex-shrink-0 ml-3">
              <DollarSign className="h-4 w-4 text-orange-600 dark:text-orange-400" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}