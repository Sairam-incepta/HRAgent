"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { FileText, Clock, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useUser } from "@clerk/nextjs";

interface DailySummaryRequiredDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  hoursWorked: number;
  onComplete: () => void;
}

export function DailySummaryRequiredDialog({
  open,
  onOpenChange,
  hoursWorked,
  onComplete
}: DailySummaryRequiredDialogProps) {
  const [description, setDescription] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user } = useUser();

  const handleSubmit = async () => {
    if (!description.trim()) {
      toast({
        title: "Description Required",
        description: "Please provide a brief description of your day before clocking out.",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Submit daily summary via chat API (same as the chat flow)
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: description.trim(),
          userRole: 'employee',
          employeeId: user?.id || "emp-001",
          isDailySummarySubmission: true
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to submit daily summary');
      }

      toast({
        title: "Daily Summary Submitted",
        description: "Your daily summary has been recorded. You can now clock out.",
      });

      setDescription("");
      onComplete();
    } catch (error) {
      console.error('Error submitting daily summary:', error);
      toast({
        title: "Error",
        description: "Failed to submit daily summary. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    // Allow skipping but show warning
    toast({
      title: "Daily Summary Skipped",
      description: "You've skipped the daily summary. Consider adding it later for better tracking.",
      variant: "destructive",
    });
    onComplete();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-[#005cb3]" />
            Daily Summary Required
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="h-4 w-4 text-blue-600" />
              <span className="font-medium text-blue-900 dark:text-blue-100">
                Work Session Complete
              </span>
            </div>
            <div className="text-sm text-blue-700 dark:text-blue-300">
              <p>You worked {hoursWorked.toFixed(1)} hours today. Please provide a brief summary of your day before clocking out.</p>
            </div>
          </div>

          <div className="space-y-3">
            <Label htmlFor="description">Daily Summary *</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your main activities, accomplishments, and any challenges from today..."
              className="min-h-[120px]"
              disabled={isSubmitting}
            />
            <p className="text-xs text-muted-foreground">
              This helps track productivity and provides valuable insights for performance reviews.
            </p>
          </div>

          <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="text-sm text-amber-700 dark:text-amber-300">
                <p><strong>Note:</strong> Hours worked and policies sold are automatically calculated from your activity. You only need to provide a brief description.</p>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-4">
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !description.trim()}
              className="flex-1 bg-[#005cb3] hover:bg-[#005cb3]/90"
            >
              {isSubmitting ? "Submitting..." : "Submit & Clock Out"}
            </Button>
            <Button
              onClick={handleSkip}
              variant="outline"
              disabled={isSubmitting}
              className="text-muted-foreground"
            >
              Skip
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}