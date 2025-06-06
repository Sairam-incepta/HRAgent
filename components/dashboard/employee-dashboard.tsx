'use client';

import { useState } from "react";
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Clock, 
  Play, 
  Square, 
  Coffee, 
  Check, 
  Timer, 
  ChevronDown, 
  ChevronUp,
  Filter,
  Search,
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { TimeTracker } from "@/components/dashboard/time-tracker";
import { RequestDialog } from "@/components/dashboard/request-dialog";
import { SettingsDialog } from "@/components/dashboard/settings-dialog";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

interface EmployeeDashboardProps {
  initialTab?: string;
}

export function EmployeeDashboard({ initialTab = "overview" }: EmployeeDashboardProps) {
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);
  const [settingsDialogOpen, setSettingsDialogOpen] = useState(false);
  const [isWeeklySummaryOpen, setIsWeeklySummaryOpen] = useState(false);
  const [requestFilter, setRequestFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [isOnLunch, setIsOnLunch] = useState(false);

  const requests = [
    {
      id: "1",
      type: "vacation",
      title: "Vacation Request",
      date: "May 15-20, 2025",
      status: "pending",
      description: "Annual summer vacation",
      comments: [
        { author: "John Doe", text: "Submitted request", timestamp: "2025-05-01 09:00 AM" },
        { author: "HR Manager", text: "Under review", timestamp: "2025-05-01 02:30 PM" }
      ]
    },
    {
      id: "2",
      type: "overtime",
      title: "Overtime Request",
      date: "May 10, 2025",
      status: "approved",
      description: "3 hours overtime for project completion",
      comments: [
        { author: "John Doe", text: "Overtime needed for project deadline", timestamp: "2025-05-08 04:00 PM" },
        { author: "Manager", text: "Approved. Please proceed.", timestamp: "2025-05-08 04:30 PM" }
      ]
    },
    {
      id: "3",
      type: "sick",
      title: "Sick Leave",
      date: "May 5, 2025",
      status: "approved",
      description: "Doctor's appointment",
      comments: [
        { author: "John Doe", text: "Medical checkup scheduled", timestamp: "2025-05-03 08:00 AM" },
        { author: "HR", text: "Approved. Get well soon!", timestamp: "2025-05-03 09:15 AM" }
      ]
    }
  ];

  const filteredRequests = requests.filter(request => {
    const matchesFilter = requestFilter === "all" || request.status === requestFilter;
    const matchesSearch = 
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.date.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Welcome back, John</h1>
        <p className="text-muted-foreground">
          Here's what's happening with your time tracking today.
        </p>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start justify-between">
        <div className="flex flex-col sm:flex-row gap-2 w-full">
          <TimeTracker />
          <Card className="w-full sm:w-auto">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                {!isOnLunch ? (
                  <Button 
                    onClick={() => setIsOnLunch(true)}
                    className="w-full sm:w-auto bg-amber-600 hover:bg-amber-700"
                  >
                    <Coffee className="mr-2 h-4 w-4" /> Start Lunch Break
                  </Button>
                ) : (
                  <Button 
                    onClick={() => setIsOnLunch(false)}
                    className="w-full sm:w-auto bg-teal-600 hover:bg-teal-700"
                  >
                    <Check className="mr-2 h-4 w-4" /> End Lunch Break
                  </Button>
                )}
                <div className={`
                  rounded-full px-4 py-2 text-sm font-medium
                  ${isOnLunch 
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
                  }
                `}>
                  {isOnLunch ? "On Lunch Break" : "Not on Break"}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Today's Hours</CardTitle>
          <CardDescription>Track your daily work hours and progress</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between mb-2">
                <span className="text-sm font-medium">Hours Worked</span>
                <span className="text-sm">6h 25m / 8h 00m</span>
              </div>
              <Progress value={78} />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>Requests & Communication</CardTitle>
              <CardDescription>Manage your requests and chat history</CardDescription>
            </div>
            <Button 
              onClick={() => setRequestDialogOpen(true)}
              className="bg-teal-600 hover:bg-teal-700"
            >
              New Request
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={requestFilter} onValueChange={setRequestFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Requests</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-4">
            {filteredRequests.map((request) => (
              <Collapsible key={request.id}>
                <div className="p-4 bg-secondary/50 rounded-lg">
                  <CollapsibleTrigger className="w-full">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-left">{request.title}</h4>
                        <p className="text-sm text-muted-foreground text-left">{request.date}</p>
                      </div>
                      <Badge 
                        variant="outline" 
                        className={
                          request.status === "approved"
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : request.status === "pending"
                            ? "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                            : "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                        }
                      >
                        {request.status.charAt(0).toUpperCase() + request.status.slice(1)}
                      </Badge>
                    </div>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-4 space-y-3">
                    <p className="text-sm text-muted-foreground">{request.description}</p>
                    <div className="space-y-2">
                      <p className="text-sm font-medium">Comments</p>
                      {request.comments.map((comment, index) => (
                        <div key={index} className="bg-background rounded-md p-3">
                          <div className="flex justify-between items-start mb-1">
                            <p className="text-sm font-medium">{comment.author}</p>
                            <p className="text-xs text-muted-foreground">{comment.timestamp}</p>
                          </div>
                          <p className="text-sm">{comment.text}</p>
                        </div>
                      ))}
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            ))}
          </div>
        </CardContent>
      </Card>

      <Collapsible
        open={isWeeklySummaryOpen}
        onOpenChange={setIsWeeklySummaryOpen}
        className="bg-card rounded-lg border"
      >
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            className="w-full flex items-center justify-between p-4"
          >
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4" />
              <span className="font-semibold">Weekly Summary</span>
            </div>
            {isWeeklySummaryOpen ? (
              <ChevronUp className="h-4 w-4" />
            ) : (
              <ChevronDown className="h-4 w-4" />
            )}
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="p-4 pt-0 space-y-3">
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Monday</p>
              <p className="text-sm text-muted-foreground">8:30 AM - 5:30 PM</p>
            </div>
            <div className="text-right">
              <p>8h 15m</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Tuesday</p>
              <p className="text-sm text-muted-foreground">9:00 AM - 5:45 PM</p>
            </div>
            <div className="text-right">
              <p>8h 30m</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Wednesday</p>
              <p className="text-sm text-muted-foreground">8:45 AM - 6:00 PM</p>
            </div>
            <div className="text-right">
              <p>8h 45m</p>
              <p className="text-sm text-muted-foreground">Regular Hours</p>
            </div>
          </div>
          <div className="flex justify-between items-center">
            <div>
              <p className="font-medium">Thursday</p>
              <p className="text-sm text-muted-foreground">8:30 AM - Present</p>
            </div>
            <div className="text-right">
              <p>6h 25m</p>
              <p className="text-sm text-muted-foreground">In Progress</p>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      <RequestDialog 
        open={requestDialogOpen} 
        onOpenChange={setRequestDialogOpen} 
      />

      <SettingsDialog
        open={settingsDialogOpen}
        onOpenChange={setSettingsDialogOpen}
      />
    </div>
  );
}