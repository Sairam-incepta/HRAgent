'use client';

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { AlertTriangle, Clock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { addOvertimeRequest } from "@/lib/util/overtime-requests";
import { useUser } from "@clerk/nextjs";

interface OvertimeNotificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentHours: number;
  maxHours: number;
  onSubmitRequest: (reason: string) => void;
  onClockOut: () => void;
}

export function OvertimeNotificationDialog({
  open,
  onOpenChange,
  currentHours,
  maxHours,
  onSubmitRequest,
  onClockOut
}: OvertimeNotificationDialogProps) {
  const [reason, setReason] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const overtimeHours = Math.max(0, currentHours - maxHours);

  const handleSubmitRequest = async () => {
    if (!reason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for overtime",
        variant: "destructive",
      });
      return;
    }

    if (!user?.id) {
      toast({
        title: "Error",
        description: "User not authenticated",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    
    try {
      const request = await addOvertimeRequest({
        employeeId: user.id,
        hoursRequested: 2, // Default additional hours requested
        reason: reason.trim(),
        currentOvertimeHours: overtimeHours
      });

      if (request) {
        onSubmitRequest(reason);
        setReason("");
        onOpenChange(false);
        
        toast({
          title: "Overtime Request Submitted",
          description: "Your request has been sent to admin for approval. You can continue working.",
        });
      } else {
        throw new Error("Failed to submit request");
      }
    } catch (error) {
      console.error('Error submitting overtime request:', error);
      toast({
        title: "Error",
        description: "Failed to submit overtime request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClockOut = () => {
    onClockOut();
    onOpenChange(false);
  };

  const handleContinueWorking = () => {
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Overtime Alert
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-amber-600" />
              <span className="font-medium text-amber-900 dark:text-amber-100">
                You've exceeded your daily hour limit
              </span>
            </div>
            <div className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              <p>Current hours worked: <span className="font-medium">{currentHours.toFixed(1)} hours</span></p>
              <p>Daily limit: <span className="font-medium">{maxHours} hours</span></p>
              <p>Overtime hours: <span className="font-medium">{overtimeHours.toFixed(1)} hours</span></p>
            </div>
          </div>

          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              You have three options:
            </p>
            
            <div className="space-y-3">
              <div className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">Option 1: Request Overtime Approval</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Submit a request to continue working overtime. You'll be paid overtime rates for additional hours.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="reason">Reason for Overtime</Label>
                  <Textarea
                    id="reason"
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Please explain why overtime is necessary..."
                    className="min-h-[80px]"
                    disabled={isSubmitting}
                  />
                </div>
                
                <Button 
                  onClick={handleSubmitRequest}
                  disabled={isSubmitting || !reason.trim()}
                  className="w-full mt-3 bg-[#005cb3] hover:bg-[#005cb3]/90"
                >
                  {isSubmitting ? "Submitting..." : "Submit Overtime Request"}
                </Button>
              </div>

              <div className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">Option 2: Clock Out Now</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Clock out immediately. You'll be paid overtime rates for the {overtimeHours.toFixed(1)} hours already worked beyond your limit.
                </p>
                
                <Button 
                  onClick={handleClockOut}
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  Clock Out Now
                </Button>
              </div>

              <div className="border rounded-lg p-3">
                <h4 className="font-medium mb-2">Option 3: Continue Working</h4>
                <p className="text-sm text-muted-foreground mb-3">
                  Continue working without requesting overtime approval right now. You can submit a request later if needed.
                </p>
                
                <Button 
                  onClick={handleContinueWorking}
                  variant="outline"
                  className="w-full"
                  disabled={isSubmitting}
                >
                  Continue Working (I'll decide later)
                </Button>
              </div>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}