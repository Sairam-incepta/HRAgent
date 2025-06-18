'use client';

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaneIcon as PaperPlaneIcon, PlusCircle, Loader2, TrendingUp, Clock, Star, Users, BarChart } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const MAX_MESSAGES = 35;

export function ChatInterface({ dailySummaryPrompt, onDailySummaryPromptShown }: { dailySummaryPrompt?: string | null, onDailySummaryPromptShown?: () => void }) {
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

  const STORAGE_KEY = userRole ? `letsinsure_chat_messages_${userRole}_${user?.id || 'anonymous'}` : null;

  // Load messages from localStorage on component mount
  useEffect(() => {
    if (!STORAGE_KEY || !userRole) return;

    const loadMessages = () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedMessages = JSON.parse(stored).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(parsedMessages);
        } else {
          // Set initial welcome message based on role
          const welcomeMessage: Message = {
            id: "welcome",
            content: userRole === 'admin' 
              ? "Hello Admin! I'm your Let's Insure Admin Assistant. I can help you:\n\n👥 Analyze employee performance and metrics\n📊 Review company-wide sales data\n💼 Manage overtime requests and approvals\n📈 Track department performance\n🎯 Monitor KPIs and business insights\n💰 Analyze payroll and compensation data\n\nWhat would you like to know about your team or company performance today?"
              : "Hello! I'm your Let's Insure Employee Assistant. I can help you:\n\n📊 Track policy sales and performance\n⏰ Log your hours\n⭐ Record client reviews\n📝 Create daily summaries\n🎯 View your performance metrics\n\nJust tell me what you'd like to do, or try one of the quick actions below!",
            sender: "bot",
            timestamp: new Date(),
          };
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        console.error('Error loading chat messages:', error);
        // Fallback to welcome message
        const welcomeMessage: Message = {
          id: "welcome",
          content: userRole === 'admin' 
            ? "Hello Admin! I'm your Let's Insure Admin Assistant. I can help you:\n\n👥 Analyze employee performance and metrics\n📊 Review company-wide sales data\n💼 Manage overtime requests and approvals\n📈 Track department performance\n🎯 Monitor KPIs and business insights\n💰 Analyze payroll and compensation data\n\nWhat would you like to know about your team or company performance today?"
            : "Hello! I'm your Let's Insure Employee Assistant. I can help you:\n\n📊 Track policy sales and performance\n⏰ Log your hours\n⭐ Record client reviews\n📝 Create daily summaries\n🎯 View your performance metrics\n\nJust tell me what you'd like to do, or try one of the quick actions below!",
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    };

    loadMessages();
  }, [userRole, STORAGE_KEY, user?.id]);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0 && STORAGE_KEY) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving chat messages:', error);
      }
    }
  }, [messages, STORAGE_KEY]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const getUserInitials = () => {
    if (user?.firstName && user?.lastName) {
      return `${user.firstName[0]}${user.lastName[0]}`;
    }
    if (user?.emailAddresses[0]?.emailAddress) {
      const email = user.emailAddresses[0].emailAddress;
      return email.substring(0, 2).toUpperCase();
    }
    return userRole === 'admin' ? "AD" : "EM";
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping || !userRole) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };
    
    // Remove oldest messages if limit is reached
    const updatedMessages = [...messages, userMessage];
    if (updatedMessages.length > MAX_MESSAGES) {
      updatedMessages.splice(0, updatedMessages.length - MAX_MESSAGES);
    }
    
    setMessages(updatedMessages);
    setInput("");
    setIsTyping(true);
    
    try {
      // Call OpenAI API with user role
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          userRole: userRole,
          employeeId: user?.id || "emp-001"
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: "bot",
        timestamp: new Date(),
      };
      
      // Remove oldest messages if limit is reached
      const updatedMessagesWithBot = [...updatedMessages, botMessage];
      if (updatedMessagesWithBot.length > MAX_MESSAGES) {
        updatedMessagesWithBot.splice(0, updatedMessagesWithBot.length - MAX_MESSAGES);
      }
      
      setMessages(updatedMessagesWithBot);
    } catch (error) {
      console.error('Chat error:', error);
      toast({
        title: "Error",
        description: "Failed to get response from assistant. Please try again.",
        variant: "destructive",
      });
      
      // Add error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm sorry, I'm having trouble connecting right now. Please check that your OpenAI API key is configured and try again.",
        sender: "bot",
        timestamp: new Date(),
      };
      
      const updatedMessagesWithError = [...updatedMessages, errorMessage];
      if (updatedMessagesWithError.length > MAX_MESSAGES) {
        updatedMessagesWithError.splice(0, updatedMessagesWithError.length - MAX_MESSAGES);
      }
      
      setMessages(updatedMessagesWithError);
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
          label: "Employee Performance",
          action: "Show me employee performance metrics"
        },
        {
          icon: BarChart,
          label: "Company Analytics",
          action: "Give me company sales analytics"
        },
        {
          icon: TrendingUp,
          label: "Sales Overview",
          action: "Show me recent policy sales"
        }
      ];
    } else {
      return [
        {
          icon: TrendingUp,
          label: "Add Policy Sale",
          action: "I sold a new policy today"
        },
        {
          icon: Star,
          label: "Add Review",
          action: "I have a client review to record"
        },
        {
          icon: Clock,
          label: "How was your day?",
          action: "How was your day? I'd love to hear about it!"
        }
      ];
    }
  };

  // Don't render chat until we have a confirmed role
  if (!userRole || !isLoaded) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const quickActions = getQuickActions();

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

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Chat Header */}
      <div className="p-4 border-b bg-background">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-[#005cb3] animate-pulse"></div>
          <h3 className="font-semibold">Let's Insure {userRole === 'admin' ? 'Admin' : 'Employee'} Assistant</h3>
        </div>
        {userRole === 'admin' && (
          <p className="text-sm text-muted-foreground mt-1">
            Company insights and management
          </p>
        )}
      </div>
      
      {/* Employee Quick Action Buttons - Only for employees */}
      {userRole === 'employee' && (
        <div className="p-4 border-b bg-background/95 backdrop-blur">
          <div className="grid grid-cols-3 gap-3">
            {getQuickActions().map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.action)}
                className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-[#005cb3]/5 hover:border-[#005cb3]/20 transition-all"
              >
                <action.icon className="h-5 w-5 text-[#005cb3]" />
                <span className="font-medium text-sm text-center leading-tight">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}
      
      {/* Admin Quick Action Buttons - Only for admins */}
      {userRole === 'admin' && (
        <div className="p-4 border-b bg-background/95 backdrop-blur">
          <div className="grid grid-cols-3 gap-3">
            {getQuickActions().map((action, index) => (
              <Button
                key={index}
                variant="outline"
                size="sm"
                onClick={() => handleQuickAction(action.action)}
                className="h-auto py-4 flex flex-col items-center gap-2 hover:bg-[#005cb3]/5 hover:border-[#005cb3]/20 transition-all"
              >
                <action.icon className="h-5 w-5 text-[#005cb3]" />
                <span className="font-medium text-sm text-center leading-tight">{action.label}</span>
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex items-start gap-3 max-w-[95%]",
              message.sender === "user" ? "ml-auto flex-row-reverse" : ""
            )}
          >
            <Avatar className="h-8 w-8 flex-shrink-0">
              {message.sender === "bot" ? (
                <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3] text-xs font-semibold">
                  {userRole === 'admin' ? 'LA' : 'LI'}
                </AvatarFallback>
              ) : (
                <>
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback className="text-xs font-semibold">{getUserInitials()}</AvatarFallback>
                </>
              )}
            </Avatar>
            <div
              className={cn(
                "rounded-lg px-4 py-3 max-w-full shadow-sm",
                message.sender === "user"
                  ? "bg-[#005cb3] text-white ml-auto"
                  : "bg-muted/50 border"
              )}
            >
              <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
              <p className={cn(
                "text-xs mt-2 opacity-70",
                message.sender === "user" ? "text-blue-100" : "text-muted-foreground"
              )}>
                {message.timestamp.toLocaleTimeString([], { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </p>
            </div>
          </div>
        ))}
        
        {isTyping && (
          <div className="flex items-start gap-3 max-w-[95%]">
            <Avatar className="h-8 w-8 flex-shrink-0">
              <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3] text-xs font-semibold">
                {userRole === 'admin' ? 'LA' : 'LI'}
              </AvatarFallback>
            </Avatar>
            <div className="rounded-lg px-4 py-3 bg-muted/50 border">
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                <span className="text-sm">Assistant is thinking...</span>
              </div>
            </div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <div className="border-t p-4 bg-background">
        <div className="flex w-full items-center gap-2">
          <Input
            placeholder={userRole === 'admin' 
              ? "Ask about employee performance, company metrics, or team analytics..." 
              : "Tell me about your day, add sales data, or ask for help..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 border-muted-foreground/20 focus:border-[#005cb3] transition-colors"
            disabled={isTyping}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isTyping} 
            className="bg-[#005cb3] hover:bg-[#004a96] px-3"
            size="sm"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PaperPlaneIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </div>
    </div>
  );
}