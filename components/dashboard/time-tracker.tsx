"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Play, Square } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type TimeStatus = "idle" | "working";

export function TimeTracker() {
  const [status, setStatus] = useState<TimeStatus>("idle");
  const [elapsedTime, setElapsedTime] = useState(0);
  const [startTime, setStartTime] = useState<number | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (status !== "idle" && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = Math.floor((now - startTime) / 1000);
        setElapsedTime(elapsed);
      }, 1000);
    }

    return () => clearInterval(interval);
  }, [status, startTime]);

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleClockIn = () => {
    setStatus("working");
    setStartTime(Date.now());
    setElapsedTime(0);
    toast({
      title: "Clocked In",
      description: `You clocked in at ${new Date().toLocaleTimeString()}`,
    });
  };

  const handleClockOut = () => {
    setStatus("idle");
    setStartTime(null);
    toast({
      title: "Clocked Out",
      description: `You clocked out at ${new Date().toLocaleTimeString()} after ${formatTime(elapsedTime)}`,
    });
  };

  return (
    <Card className="w-full sm:w-auto transition-all duration-300 hover:shadow-md">
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row items-center gap-3">
          <div className="flex gap-2 w-full sm:w-auto">
            {status === "idle" ? (
              <Button 
                onClick={handleClockIn} 
                className="w-full sm:w-auto bg-[#0064b4] hover:bg-[#0064b4]/90"
              >
                <Play className="mr-2 h-4 w-4" /> Clock In
              </Button>
            ) : (
              <Button 
                onClick={handleClockOut} 
                variant="outline"
                className="w-full sm:w-auto"
              >
                <Square className="mr-2 h-4 w-4" /> Clock Out
              </Button>
            )}
          </div>
          
          <div className={cn(
            "px-3 py-1 rounded-full text-sm font-medium flex items-center whitespace-nowrap",
            status === "idle" ? "bg-muted text-muted-foreground" :
            "bg-[#0064b4]/10 text-[#0064b4] dark:bg-[#0064b4]/30 dark:text-[#0064b4]"
          )}>
            {status === "idle" ? "Not Clocked In" : "Currently Working"}
            {status !== "idle" && (
              <span className="ml-2 font-mono">{formatTime(elapsedTime)}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}