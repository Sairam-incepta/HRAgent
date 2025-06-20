import { DashboardHeader } from "@/components/dashboard/header";
import { EmployeeDashboard } from "@/components/dashboard/employee-dashboard";
import { AdminDashboard } from "@/components/dashboard/admin-dashboard";
import { ChatInterfaceToggle } from "@/components/dashboard/chat-interface-toggle";
import { getUserRole } from "@/lib/get-user-role";
import { getEmployee } from "@/lib/database";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
  const { userId } = auth();

  // If no user, redirect to sign-in page
  if (!userId) {
    redirect('/sign-in');
  }

  const userRole = await getUserRole();
  
  // Fetch employee data for the header
  let employeeName: string | undefined;
  let employeeEmail: string | undefined;
  
  if (userRole === "employee") {
    try {
      const employee = await getEmployee(userId);
      if (employee) {
        employeeName = employee.name;
        employeeEmail = employee.email;
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
    }
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      <DashboardHeader 
        userRole={userRole} 
        employeeName={employeeName}
        employeeEmail={employeeEmail}
      />
      <div className="flex flex-1 overflow-hidden">
        {/* Main Dashboard Content */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          {userRole === "employee" ? (
            <EmployeeDashboard />
          ) : (
            <AdminDashboard />
          )}
        </main>
        
        {/* Chat Interface */}
        <ChatInterfaceToggle />
      </div>
    </div>
  );
}