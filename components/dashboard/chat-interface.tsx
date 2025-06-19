'use client';

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, PlusCircle, Loader2, TrendingUp, Clock, Star, Users, BarChart, X, Expand, Shrink, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { addChatMessage, getChatMessages } from '@/lib/database';

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const MAX_MESSAGES = 35;

// Dedicated MessageBubble component with better responsive design
const MessageBubble = ({ 
  message, 
  userInitials, 
  userImageUrl, 
  isExpanded 
}: {
  message: Message;
  userInitials: string;
  userImageUrl?: string;
  isExpanded: boolean;
}) => {
  const isUser = message.sender === "user";
  
  return (
    <div className={cn(
      "flex gap-3",
      isUser ? "flex-row-reverse" : "flex-row"
    )}>
      {/* Avatar */}
      <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
        {isUser ? (
          <>
            <AvatarImage src={userImageUrl} />
            <AvatarFallback className="text-xs font-medium">{userInitials}</AvatarFallback>
          </>
        ) : (
          <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">
            <Bot className="h-4 w-4" />
          </AvatarFallback>
        )}
      </Avatar>

      {/* Message Content Container */}
      <div className={cn(
        "flex flex-col min-w-0 flex-1",
        isUser ? "items-end" : "items-start"
      )}>
        {/* Message Bubble */}
        <div className={cn(
          "relative rounded-lg px-3 py-2 shadow-sm",
          // Simple max-width based on chat state
          isExpanded ? "max-w-[75%]" : "max-w-[85%]",
          // Styling based on sender
          isUser
            ? "bg-[#005cb3] text-white"
            : "bg-muted/50 border"
        )}>
          <p 
            className="text-sm break-words whitespace-pre-wrap pr-6"
            dangerouslySetInnerHTML={{ __html: message.content }}
          />
          
          {/* Timestamp */}
          <span className={cn(
            "absolute bottom-1.5 right-2 text-[10px] opacity-60",
            isUser ? "text-blue-100" : "text-muted-foreground"
          )}>
            {message.timestamp.toLocaleTimeString([], { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </span>
        </div>
      </div>
    </div>
  );
};

// Typing indicator component
const TypingIndicator = ({ isExpanded }: { isExpanded: boolean }) => (
  <div className="flex gap-3">
    <Avatar className="h-8 w-8 flex-shrink-0 mt-0.5">
      <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">
        <Bot className="h-4 w-4" />
      </AvatarFallback>
    </Avatar>
    
    <div className={cn(
      "rounded-lg px-3 py-2 bg-muted/50 border",
      isExpanded ? "max-w-[75%]" : "max-w-[85%]"
    )}>
      <div className="flex items-center gap-2">
        <Loader2 className="h-3.5 w-3.5 animate-spin text-[#005cb3]" />
        <span className="text-sm text-muted-foreground">Typing...</span>
      </div>
    </div>
  </div>
);

export function ChatInterface({ 
  dailySummaryPrompt, 
  onDailySummaryPromptShown, 
  onCollapse,
  isExpanded,
  onToggleExpand
}: { 
  dailySummaryPrompt?: string | null;
  onDailySummaryPromptShown?: () => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { user, isLoaded } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Determine user role
  useEffect(() => {
    if (isLoaded && user) {
      const isAdmin = user.emailAddresses[0]?.emailAddress === 'admin@letsinsure.hr' ||
                     user.publicMetadata?.role === 'admin' ||
                     user.id === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
      setUserRole(isAdmin ? 'admin' : 'employee');
    }
  }, [isLoaded, user]);

  // Load messages from backend on mount
  useEffect(() => {
    const loadMessages = async () => {
      if (!user?.id || !userRole) return;
      try {
        const msgs = await getChatMessages({ userId: user.id, role: userRole, limit: MAX_MESSAGES });
        setMessages(msgs.map((msg: any) => ({
          id: msg.id,
          content: msg.content,
          sender: msg.role === 'bot' ? 'bot' : 'user',
          timestamp: new Date(msg.timestamp)
        })));
      } catch (error) {
        setMessages([]);
      }
    };
    loadMessages();
  }, [user?.id, userRole]);

  // Save messages to backend on send
  const handleSend = async () => {
    if (!input.trim() || isTyping || !userRole || !user?.id) return;
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };
    setMessages(prev => {
      const updated = [...prev, userMessage];
      if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
      return updated;
    });
    setInput("");
    setIsTyping(true);
    await addChatMessage({ userId: user.id, role: userRole, content: input });
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: input, userRole: userRole, employeeId: user.id })
      });
      if (!response.ok) throw new Error('Failed to get response');
      const data = await response.json();
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, botMessage];
        if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
        return updated;
      });
      await addChatMessage({ userId: user.id, role: 'bot', content: data.response });
    } catch (error) {
      toast({ title: "Error", description: "Failed to get response from assistant. Please try again.", variant: "destructive" });
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting right now. Please check that your OpenAI API key is configured and try again.",
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages(prev => {
        const updated = [...prev, errorMessage];
        if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
        return updated;
      });
      await addChatMessage({ userId: user.id, role: 'bot', content: errorMessage.content });
    } finally {
      setIsTyping(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  // Quick actions based on user role
  const getQuickActions = () => {
    if (userRole === 'admin') {
      return [
        {
          icon: Users,
          label: "Team Stats",
          action: "Show me employee performance metrics"
        },
        {
          icon: BarChart,
          label: "Analytics",
          action: "Give me company sales analytics"
        },
        {
          icon: TrendingUp,
          label: "Sales",
          action: "Show me recent policy sales"
        }
      ];
    } else {
      return [
        {
          icon: TrendingUp,
          label: "Add Sale",
          action: "I just closed a new policy sale"
        },
        {
          icon: Star,
          label: "Add Review",
          action: "I received client feedback to share"
        },
        {
          icon: Clock,
          label: "Daily Check-in",
          action: "I'd like to share about my day"
        }
      ];
    }
  };

  // Handle daily summary prompt - MUST be before early return
  useEffect(() => {
    if (dailySummaryPrompt && userRole === 'employee') {
      const botMessage: Message = {
        id: `summary-prompt-${Date.now()}`,
        content: dailySummaryPrompt,
        sender: "bot",
        timestamp: new Date(),
      };
      setMessages((prev) => {
        const updated = [...prev, botMessage];
        if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
        return updated;
      });
      onDailySummaryPromptShown?.();
    }
  }, [dailySummaryPrompt, userRole, onDailySummaryPromptShown]);

  // Don't render chat until we have a confirmed role
  if (!userRole || !isLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const quickActions = getQuickActions();

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user?.emailAddresses?.[0]?.emailAddress) {
      const email = user.emailAddresses[0].emailAddress;
      return email.substring(0, 2).toUpperCase();
    }
    return userRole === "admin" ? "AD" : "EM";
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Chat Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-full bg-[#005cb3] animate-pulse"></div>
            <div>
              <h3 className="font-semibold text-sm md:text-base">
                {userRole === 'admin' ? 'HR Admin Assistant' : 'HR Assistant'}
              </h3>
              <p className="text-xs md:text-sm text-muted-foreground">
                {userRole === 'admin' ? 'Team & Analytics' : 'Sales & Performance'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {onToggleExpand && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onToggleExpand}
                className="h-8 w-8 p-0 shrink-0"
                title={isExpanded ? "Shrink chat (35%)" : "Expand chat (45%)"}
              >
                {isExpanded ? <Shrink className="h-4 w-4" /> : <Expand className="h-4 w-4" />}
              </Button>
            )}
            {onCollapse && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCollapse}
                className="h-8 w-8 p-0 shrink-0"
                title="Close chat"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* Employee Quick Action Buttons - Only for employees */}
      {userRole === 'employee' && (
        <div className="px-3 py-2 border-b bg-background/95 backdrop-blur">
          <div className="grid grid-cols-3 gap-1.5">
            {getQuickActions().map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.action)}
                className="h-auto py-2 flex flex-col items-center gap-1 hover:bg-[#005cb3]/5 hover:border-[#005cb3]/20 transition-all text-xs"
              >
                <action.icon className="h-4 w-4 text-[#005cb3]" />
                <span className="font-medium text-center leading-none">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Admin Quick Action Buttons - Only for admins */}
      {userRole === 'admin' && (
        <div className="px-3 py-2 border-b bg-background/95 backdrop-blur">
          <div className="grid grid-cols-3 gap-1.5">
            {getQuickActions().map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.action)}
                className="h-auto py-2 flex flex-col items-center gap-1 hover:bg-[#005cb3]/5 hover:border-[#005cb3]/20 transition-all text-xs"
              >
                <action.icon className="h-4 w-4 text-[#005cb3]" />
                <span className="font-medium text-center leading-none">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userInitials={getUserInitials()}
            userImageUrl={user?.imageUrl}
            isExpanded={isExpanded ?? false}
          />
        ))}
        
        {isTyping && (
          <TypingIndicator isExpanded={isExpanded ?? false} />
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-3 bg-background">
        <div className="flex w-full items-center gap-2">
          <Input
            placeholder={userRole === 'admin' 
              ? "Ask about team performance, sales data, or employee metrics..." 
              : "Record a sale, share feedback, ask questions, or get help..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-muted-foreground/20 focus:border-[#005cb3] transition-colors text-sm"
            disabled={isTyping}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isTyping} 
            className="bg-[#005cb3] hover:bg-[#004a96] px-3 shrink-0"
            size="sm"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}