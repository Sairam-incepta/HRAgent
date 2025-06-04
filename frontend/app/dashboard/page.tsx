import { currentUser } from "@clerk/nextjs/server"
import { redirect } from "next/navigation"
import { DashboardLayout } from "@/components/layout/dashboard-layout"
import { ClockSection } from "@/components/features/clock/clock-section"
import { RequestsSection } from "@/components/features/requests/requests-section"
import { ChatbotSection } from "@/components/features/chat/chatbot-section"
import { EmployeeOverview } from "@/components/features/admin/employee-overview"

export default async function Dashboard() {
  const user = await currentUser()
  
  if (!user) {
    redirect('/sign-in')
  }

  // Check user role from metadata
  const role = user.publicMetadata?.role as string || 'employee'
  const isAdmin = role === 'admin'

  return (
    <DashboardLayout isAdmin={isAdmin}>
      {isAdmin ? (
        // Admin Layout - with scrollable employee overview
        <div className="flex flex-col">
          {/* Main dashboard content */}
          <div className="h-[calc(100vh-4rem)] flex">
            {/* Left Side - Clock and Requests */}
            <div className="flex-1 p-6 space-y-6 overflow-y-auto">
              <ClockSection />
              <RequestsSection />
            </div>

            {/* Right Side - Chatbot */}
            <div className="w-96 border-l border-slate-800">
              <ChatbotSection />
            </div>
          </div>

          {/* Employee Overview - Below main content */}
          <div className="border-t border-slate-800 p-6 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950">
            <EmployeeOverview />
          </div>
        </div>
      ) : (
        // Employee Layout - no employee overview
        <div className="h-[calc(100vh-4rem)] flex">
          {/* Left Side - Clock and Requests */}
          <div className="flex-1 p-6 space-y-6 overflow-y-auto">
            <ClockSection />
            <RequestsSection />
          </div>

          {/* Right Side - Chatbot */}
          <div className="w-96 border-l border-slate-800">
            <ChatbotSection />
          </div>
        </div>
      )}
    </DashboardLayout>
  )
}
