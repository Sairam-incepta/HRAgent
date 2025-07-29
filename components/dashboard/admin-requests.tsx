'use client';

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { 
  Clock, 
  Calendar, 
  AlertTriangle, 
  Check, 
  X, 
  Filter,
  Search,
  Edit
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getAllRequests, updateRequestStatus } from "@/lib/util/requests";
import { getEmployees } from "@/lib/util/employee";
import { dashboardEvents } from "@/lib/events";
import { DatabaseRequest } from "@/lib/supabase";

interface AdminRequestsProps {
  pendingCount?: number;
}

export function AdminRequests({ pendingCount }: AdminRequestsProps) {
  const [requests, setRequests] = useState<DatabaseRequest[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [selectedRequest, setSelectedRequest] = useState<DatabaseRequest | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    loadData();
  }, []);

  // Listen for real-time events for live updates
  useEffect(() => {
    const handleRequestUpdate = () => {
      loadData(); // Refresh requests when status changes or new requests are submitted
    };

    // Subscribe to events and store cleanup functions
    const cleanupFunctions = [
      dashboardEvents.on('request_submitted', handleRequestUpdate),
      dashboardEvents.on('request_status_updated', handleRequestUpdate)
    ];

    return () => {
      // Call all cleanup functions
      cleanupFunctions.forEach(cleanup => cleanup());
    };
  }, []);

  const loadData = async () => {
    try {
      const [allRequests, employeeData] = await Promise.all([
        getAllRequests(),
        getEmployees()
      ]);
      // Transform requests to match the interface
      const transformedRequests: DatabaseRequest[] = allRequests.map(req => {
        const employee = employeeData.find(emp => emp.clerk_user_id === req.employee_id);
        return {
          ...req,
          employeeName: employee?.name || 'Unknown Employee',
          reason: req.reason || '',
        };
      });
      setRequests(transformedRequests);
      setEmployees(employeeData);
    } catch (error) {
      console.error('Error loading requests:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredRequests = requests.filter(request => {
    const matchesSearch = 
      request.employeeName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      request.description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesStatus = statusFilter === "all" || request.status === statusFilter;
    const matchesType = typeFilter === "all" || request.type === typeFilter;
    
    return matchesSearch && matchesStatus && matchesType;
  });

  const handleApprove = async (requestId: string) => {
    try {
      const success = await updateRequestStatus(requestId, 'approved');
      if (success) {
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? { ...req, status: "approved" as const }
            : req
        ));
        
        const request = requests.find(r => r.id === requestId);
        toast({
          title: "Request Approved",
          description: `${request?.employeeName}'s ${request?.type} request has been approved.`,
        });
        
        // Emit event to update notification bell
        dashboardEvents.emit('request_status_updated', { requestId, status: 'approved' });
      }
    } catch (error) {
      console.error('Error approving request:', error);
      toast({
        title: "Error",
        description: "Failed to approve request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleReject = async (requestId: string) => {
    try {
      const success = await updateRequestStatus(requestId, 'rejected');
      if (success) {
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? { ...req, status: "rejected" as const }
            : req
        ));
        
        const request = requests.find(r => r.id === requestId);
        toast({
          title: "Request Rejected",
          description: `${request?.employeeName}'s ${request?.type} request has been rejected.`,
          variant: "destructive",
        });
        
        // Emit event to update notification bell
        dashboardEvents.emit('request_status_updated', { requestId, status: 'rejected' });
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast({
        title: "Error",
        description: "Failed to reject request. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleSetPending = async (requestId: string) => {
    try {
      const success = await updateRequestStatus(requestId, 'pending');
      if (success) {
        setRequests(prev => prev.map(req => 
          req.id === requestId 
            ? { ...req, status: "pending" as const }
            : req
        ));
        
        const request = requests.find(r => r.id === requestId);
        toast({
          title: "Request Status Updated",
          description: `${request?.employeeName}'s ${request?.type} request has been set to pending.`,
        });
        
        // Emit event to update notification bell
        dashboardEvents.emit('request_status_updated', { requestId, status: 'pending' });
      }
    } catch (error) {
      console.error('Error updating request status:', error);
      toast({
        title: "Error",
        description: "Failed to update request status. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleViewDetails = (request: DatabaseRequest) => {
    setSelectedRequest(request);
    setDetailsOpen(true);
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "overtime": return <Clock className="h-4 w-4" />;
      case "vacation": return <Calendar className="h-4 w-4" />;
      case "sick": return <AlertTriangle className="h-4 w-4" />;
      case "edit-clock-time": return <Edit className="h-4 w-4" />;
      default: return <Calendar className="h-4 w-4" />;
    }
  };

  const getTypeDisplayName = (type: string) => {
    switch (type) {
      case "edit-clock-time": return "Edit Clock Time";
      case "overtime": return "Overtime";
      case "vacation": return "Vacation";
      case "sick": return "Sick Leave";
      default: return "Other";
    }
  };

  const overtimeCount = requests.filter(r => r.type === "overtime" && r.status === "pending").length;

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-4">
            <div className="h-4 bg-gray-200 rounded w-1/4"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
            <div className="h-8 bg-gray-200 rounded"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle>Employee Requests ({pendingCount ?? requests.filter(r => r.status === "pending").length})</CardTitle>
              <div className="flex gap-2 mt-2">
                <Badge variant="outline" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                  {pendingCount ?? requests.filter(r => r.status === "pending").length} Pending
                </Badge>
                {overtimeCount > 0 && (
                  <Badge variant="outline" className="bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400">
                    {overtimeCount} Overtime
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search requests..."
                className="pl-8"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="approved">Approved</SelectItem>
                <SelectItem value="rejected">Rejected</SelectItem>
              </SelectContent>
            </Select>
            <Select value={typeFilter} onValueChange={setTypeFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="edit-clock-time">Edit Clock Time</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Requests List */}
          <div className="max-h-96 overflow-y-auto space-y-3 pr-2">
            {filteredRequests.length > 0 ? (
              filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 flex-1">
                      <Avatar className="h-10 w-10">
                        <AvatarFallback>
                          {request.employeeName.split(" ").map(n => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          {getTypeIcon(request.type)}
                          <h4 className="font-medium truncate">{request.title}</h4>
                        </div>
                        
                        <p className="text-sm text-muted-foreground mb-2">
                          {request.employeeName} • {new Date(request.request_date).toLocaleDateString()}
                        </p>
                        
                        <p className="text-sm line-clamp-2">{request.description}</p>
                      </div>
                    </div>
                    
                    <div className="flex items-center gap-2 ml-4">
                      <Badge 
                        variant="outline"
                        className={
                          request.status === "approved" 
                            ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                            : request.status === "rejected"
                            ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                            : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                        }
                      >
                        {request.status}
                      </Badge>
                      
                      {request.status === "pending" && (
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            onClick={() => handleApprove(request.id)}
                            className="h-8 w-8 p-0 bg-green-600 hover:bg-green-700"
                          >
                            <Check className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleReject(request.id)}
                            className="h-8 w-8 p-0"
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                      
                      {request.status === "approved" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetPending(request.id)}
                          className="h-8"
                        >
                          Set Pending
                        </Button>
                      )}
                      
                      {request.status === "rejected" && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleSetPending(request.id)}
                          className="h-8"
                        >
                          Set Pending
                        </Button>
                      )}
                      
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleViewDetails(request)}
                        className="h-8"
                      >
                        Details
                      </Button>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                {requests.length === 0 ? "No requests submitted yet." : "No requests found matching your filters."}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Request Details Dialog */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Request Details</DialogTitle>
          </DialogHeader>
          
          {selectedRequest && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarFallback>
                    {selectedRequest.employeeName.split(" ").map(n => n[0]).join("")}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <h3 className="font-semibold">{selectedRequest.employeeName}</h3>
                  <p className="text-sm text-muted-foreground">
                    {getTypeDisplayName(selectedRequest.type)} Request
                  </p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium">Title</label>
                  <p className="text-sm">{selectedRequest.title}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Description</label>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
                
                <div>
                  <label className="text-sm font-medium">Request Date</label>
                  <p className="text-sm">{new Date(selectedRequest.request_date).toLocaleString()}</p>
                </div>
                
                {selectedRequest.hours_requested && (
                  <div>
                    <label className="text-sm font-medium">Additional Hours Requested</label>
                    <p className="text-sm">{selectedRequest.hours_requested} hours</p>
                  </div>
                )}
                
                {selectedRequest.clock_in_time && selectedRequest.clock_out_time && (
                  <>
                    <div>
                      <label className="text-sm font-medium">Clock In Time</label>
                      <p className="text-sm">{selectedRequest.clock_in_time}</p>
                    </div>
                    <div>
                      <label className="text-sm font-medium">Clock Out Time</label>
                      <p className="text-sm">{selectedRequest.clock_out_time}</p>
                    </div>
                  </>
                )}
                
                {selectedRequest.start_date && (
                  <div>
                    <label className="text-sm font-medium">Start Date</label>
                    <p className="text-sm">{new Date(selectedRequest.start_date).toLocaleDateString()}</p>
                  </div>
                )}
                
                {selectedRequest.end_date && (
                  <div>
                    <label className="text-sm font-medium">End Date</label>
                    <p className="text-sm">{new Date(selectedRequest.end_date).toLocaleDateString()}</p>
                  </div>
                )}
              </div>
              
              <div className="flex items-center gap-2">
                <label className="text-sm font-medium">Status:</label>
                <Badge 
                  variant="outline"
                  className={
                    selectedRequest.status === "approved" 
                      ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400"
                      : selectedRequest.status === "rejected"
                      ? "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400"
                  }
                >
                  {selectedRequest.status}
                </Badge>
              </div>
              
              {selectedRequest.status === "pending" && (
                <div className="flex gap-2 pt-4">
                  <Button
                    onClick={() => {
                      handleApprove(selectedRequest.id);
                      setDetailsOpen(false);
                    }}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    <Check className="mr-2 h-4 w-4" />
                    Approve
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => {
                      handleReject(selectedRequest.id);
                      setDetailsOpen(false);
                    }}
                    className="flex-1"
                  >
                    <X className="mr-2 h-4 w-4" />
                    Reject
                  </Button>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}