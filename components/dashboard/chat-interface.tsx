'use client';

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaneIcon as PaperPlaneIcon, PlusCircle, Loader2, TrendingUp, DollarSign, Clock, Star, Users, BarChart, FileText } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const MAX_MESSAGES = 35;

export function ChatInterface() {
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Determine user role for separate chat histories
  const getUserRole = () => {
    if (!user) return 'employee';
    const isAdmin = user.emailAddresses[0]?.emailAddress === 'admin@letsinsure.hr' ||
                   user.publicMetadata?.role === 'admin' ||
                   user.id === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
    return isAdmin ? 'admin' : 'employee';
  };

  const userRole = getUserRole();
  const STORAGE_KEY = `letsinsure_chat_messages_${userRole}_${user?.id || 'anonymous'}`;

  // Load messages from localStorage on component mount
  useEffect(() => {
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
              : "Hello! I'm your Let's Insure Employee Assistant. I can help you:\n\n📊 Track policy sales and bonuses\n💰 Calculate broker fees\n⏰ Log your hours\n⭐ Record client reviews\n📝 Create daily summaries\n🎯 View your performance metrics\n\nJust tell me what you'd like to do, or try one of the quick actions below!",
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
            : "Hello! I'm your Let's Insure Employee Assistant. I can help you:\n\n📊 Track policy sales and bonuses\n💰 Calculate broker fees\n⏰ Log your hours\n⭐ Record client reviews\n📝 Create daily summaries\n🎯 View your performance metrics\n\nJust tell me what you'd like to do, or try one of the quick actions below!",
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
    if (messages.length > 0) {
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
    if (!input.trim() || isTyping) return;

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
          icon: FileText,
          label: "Pending Requests",
          action: "Show me pending overtime requests"
        },
        {
          icon: DollarSign,
          label: "Payroll Summary",
          action: "Show me payroll summary"
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
          label: "Daily Summary",
          action: "Create my daily summary"
        },
        {
          icon: DollarSign,
          label: "View Bonus",
          action: "Show my total bonus"
        }
      ];
    }
  };

  const quickActions = getQuickActions();

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#005cb3]"></span>
          Let's Insure {userRole === 'admin' ? 'Admin' : 'Employee'} Assistant
        </CardTitle>
      </CardHeader>
      
      {/* Sticky Quick Action Buttons */}
      <div className="px-4 pb-3 border-b bg-background sticky top-0 z-10">
        <div className="grid grid-cols-2 gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.action)}
              className="text-xs h-auto p-2 flex flex-col items-start gap-1 justify-start text-left hover:bg-[#005cb3]/5"
            >
              <action.icon className="h-4 w-4 text-[#005cb3] self-start" />
              <span className="text-left font-medium">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      <CardContent className="flex-1 overflow-y-auto px-4 pb-0">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-2 max-w-[95%]",
                message.sender === "user" ? "ml-auto flex-row-reverse" : ""
              )}
            >
              <Avatar className="h-8 w-8 flex-shrink-0">
                {message.sender === "bot" ? (
                  <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">
                    {userRole === 'admin' ? 'LA' : 'LI'}
                  </AvatarFallback>
                ) : (
                  <>
                    <AvatarImage src={user?.imageUrl} />
                    <AvatarFallback>{getUserInitials()}</AvatarFallback>
                  </>
                )}
              </Avatar>
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-full",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground ml-auto"
                    : "bg-muted"
                )}
              >
                <p className="whitespace-pre-wrap text-sm leading-relaxed">{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-start gap-2 max-w-[95%]">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">
                  {userRole === 'admin' ? 'LA' : 'LI'}
                </AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-3 py-2 bg-muted">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Assistant is thinking...</span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <CardFooter className="border-t p-4">
        <div className="flex w-full items-center gap-2">
          <Input
            placeholder={userRole === 'admin' 
              ? "Ask about employee performance, company metrics, or team analytics..." 
              : "Ask about policies, add sales data, record reviews..."
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
            disabled={isTyping}
          />
          <Button 
            onClick={handleSend} 
            disabled={!input.trim() || isTyping} 
            className="bg-[#005cb3] hover:bg-[#005cb3]/90"
          >
            {isTyping ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PaperPlaneIcon className="h-4 w-4" />
            )}
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </div>
  );
}