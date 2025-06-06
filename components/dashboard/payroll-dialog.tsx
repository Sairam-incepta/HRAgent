"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { CreditCard, Download } from "lucide-react";
import { Progress } from "@/components/ui/progress";

interface PayrollDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName?: string;
}

export function PayrollDialog({ open, onOpenChange, employeeName }: PayrollDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [isGenerated, setIsGenerated] = useState(false);
  const [progress, setProgress] = useState(0);

  const handleGenerate = () => {
    setIsGenerating(true);
    setProgress(0);

    // Simulate generation progress
    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsGenerating(false);
          setIsGenerated(true);
          return 100;
        }
        return prev + 10;
      });
    }, 500);
  };

  const handleClose = () => {
    setIsGenerating(false);
    setIsGenerated(false);
    setProgress(0);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Generate Payroll Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-4">
          {!isGenerating && !isGenerated ? (
            <div className="text-center space-y-4">
              <CreditCard className="mx-auto h-12 w-12 text-teal-600" />
              <p className="text-lg font-medium">
                {employeeName ? `Generate payroll for ${employeeName}` : 'Generate payroll report'}
              </p>
              <p className="text-sm text-muted-foreground">
                This will generate a detailed payroll report for the current pay period.
              </p>
              <Button 
                onClick={handleGenerate}
                className="w-full bg-teal-600 hover:bg-teal-700"
              >
                Generate Report
              </Button>
            </div>
          ) : isGenerating ? (
            <div className="space-y-4">
              <p className="text-center">Generating payroll report...</p>
              <Progress value={progress} />
              <p className="text-sm text-center text-muted-foreground">
                Please wait while we process the data
              </p>
            </div>
          ) : (
            <div className="text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-green-100 dark:bg-green-900/30 mx-auto flex items-center justify-center">
                <Download className="h-6 w-6 text-green-600 dark:text-green-400" />
              </div>
              <p className="text-lg font-medium">Report Generated!</p>
              <p className="text-sm text-muted-foreground">
                Your payroll report is ready to download
              </p>
              <div className="space-y-2">
                <Button 
                  className="w-full bg-teal-600 hover:bg-teal-700"
                  onClick={() => {
                    // Handle download here
                    handleClose();
                  }}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Download Report
                </Button>
                <Button 
                  variant="outline" 
                  className="w-full"
                  onClick={handleClose}
                >
                  Close
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}