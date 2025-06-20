"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { addRequest } from "@/lib/database";
import { useUser } from "@clerk/nextjs";

interface RequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onRequestSubmitted?: () => void;
}

export function RequestDialog({ open, onOpenChange, onRequestSubmitted }: RequestDialogProps) {
  const [requestType, setRequestType] = useState<string>("");
  const [startDate, setStartDate] = useState<Date>();
  const [endDate, setEndDate] = useState<Date>();
  const [reason, setReason] = useState("");
  const [hours, setHours] = useState<number | undefined>(undefined);
  const { toast } = useToast();
  const { user } = useUser();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('📝 Submitting request:', {
      requestType,
      startDate,
      endDate,
      reason,
      hours,
      userId: user?.id
    });
    
    if (!requestType || !startDate || !reason || !user?.id) {
      console.log('❌ Validation failed:', { requestType, startDate, reason, userId: user?.id });
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }
    
    // Additional validation for overtime requests
    if (requestType === "overtime" && (!hours || hours <= 0)) {
      console.log('❌ Overtime validation failed:', { hours });
      toast({
        title: "Error",
        description: "Please enter a valid number of hours for overtime requests",
        variant: "destructive",
      });
      return;
    }
    
    // Additional validation for vacation requests
    if (requestType === "vacation" && !endDate) {
      console.log('❌ Vacation validation failed:', { endDate });
      toast({
        title: "Error",
        description: "Please select an end date for vacation requests",
        variant: "destructive",
      });
      return;
    }
    
    const requestData = {
      employeeId: user.id,
      type: requestType as any,
      title: `${requestType.charAt(0).toUpperCase() + requestType.slice(1)} Request`,
      description: reason,
      requestDate: startDate.toISOString().split('T')[0],
      hoursRequested: requestType === "overtime" ? hours : undefined,
      reason,
      startDate: startDate.toISOString().split('T')[0],
      endDate: endDate ? endDate.toISOString().split('T')[0] : undefined,
    };
    
    console.log('📝 Sending request data:', requestData);
    
    try {
      const result = await addRequest(requestData);
      if (result) {
        console.log('✅ Request submitted successfully:', result);
        toast({
          title: "Request Submitted",
          description: "Your request has been submitted for approval",
        });
        setRequestType("");
        setStartDate(undefined);
        setEndDate(undefined);
        setReason("");
        setHours(undefined);
        onOpenChange(false);
        if (onRequestSubmitted) {
          onRequestSubmitted();
        }
      } else {
        console.log('❌ Request submission failed - no result returned');
        toast({
          title: "Error",
          description: "Failed to submit request. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error('❌ Exception during request submission:', error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>New Request</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="type">Request Type</Label>
            <Select value={requestType} onValueChange={setRequestType}>
              <SelectTrigger>
                <SelectValue placeholder="Select request type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="vacation">Vacation</SelectItem>
                <SelectItem value="sick">Sick Leave</SelectItem>
                <SelectItem value="overtime">Overtime</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Start Date</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    "w-full justify-start text-left font-normal",
                    !startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {startDate ? format(startDate, "PPP") : "Pick a date"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={startDate}
                  onSelect={setStartDate}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>

          {requestType === "vacation" && (
            <div className="space-y-2">
              <Label>End Date</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className={cn(
                      "w-full justify-start text-left font-normal",
                      !endDate && "text-muted-foreground"
                    )}
                  >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {endDate ? format(endDate, "PPP") : "Pick a date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    initialFocus
                  />
                </PopoverContent>
              </Popover>
            </div>
          )}

          {requestType === "overtime" && (
            <div className="space-y-2">
              <Label htmlFor="hours">Hours</Label>
              <Input
                id="hours"
                type="number"
                min="1"
                max="24"
                placeholder="Number of hours"
                value={hours ?? ""}
                onChange={e => setHours(Number(e.target.value))}
              />
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="reason">Reason</Label>
            <Textarea
              id="reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Please provide details about your request"
              className="min-h-[100px]"
            />
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" className="bg-[#005cb3] hover:bg-[#005cb3]/90">
              Submit Request
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}