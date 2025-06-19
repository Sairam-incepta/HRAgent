'use client';

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import { ChatInterface } from "./chat-interface";

export function ChatInterfaceToggle() {
  const [isChatOpen, setIsChatOpen] = useState(true);
  const [isChatExpanded, setIsChatExpanded] = useState(false);

  if (!isChatOpen) {
    return (
      <Button
        onClick={() => setIsChatOpen(true)}
        className="fixed bottom-4 right-4 md:bottom-6 md:right-6 h-14 w-14 rounded-full bg-[#005cb3] hover:bg-[#004a96] shadow-lg z-50"
        size="icon"
        aria-label="Open chat"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
    );
  }

  return (
    <div 
      className={`
        transition-all duration-300 border-l 
        bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 
        ${isChatExpanded
          ? 'w-full md:w-[45%] lg:w-[45%] xl:w-[45%]'
          : 'w-full md:w-[45%] lg:w-[35%] xl:w-[30%]'}
        md:relative absolute top-0 right-0 h-full z-40 md:z-auto
      `}
    >
      <ChatInterface 
        onCollapse={() => setIsChatOpen(false)}
        isExpanded={isChatExpanded}
        onToggleExpand={() => setIsChatExpanded(!isChatExpanded)}
      />
    </div>
  );
} 