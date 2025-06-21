'use client';

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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

export function ChatInterface({ 
  onClockOutPrompt, 
  clockOutPromptMessage,
  onCollapse,
  isExpanded,
  onToggleExpand
}: { 
  onClockOutPrompt?: boolean; 
  clockOutPromptMessage?: string;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
}) {
  const { user, isLoaded } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [hasShownClockOutPrompt, setHasShownClockOutPrompt] = useState(false);
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

  // Load messages from localStorage and send initial AI greeting
  useEffect(() => {
    if (!STORAGE_KEY || !userRole || hasInitialized) return;

    const loadMessagesAndInitialize = async () => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsedMessages = JSON.parse(stored).map((msg: any) => ({
            ...msg,
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(parsedMessages);
        } else {
          // If no stored messages, get AI greeting
          await getInitialAIGreeting();
        }
        setHasInitialized(true);
      } catch (error) {
        console.error('Error loading chat messages:', error);
        // Fallback to getting AI greeting
        await getInitialAIGreeting();
        setHasInitialized(true);
      }
    };

    loadMessagesAndInitialize();
  }, [userRole, STORAGE_KEY, user?.id, hasInitialized]);

  // Get initial AI greeting
  const getInitialAIGreeting = async () => {
    if (!userRole) return;

    setIsTyping(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: userRole === 'admin' 
            ? "Hello, I'm the new admin. Please introduce yourself and tell me how you can help."
            : "Hello, I'm a new employee. Please introduce yourself and tell me how you can help.",
          userRole: userRole,
          employeeId: user?.id || "emp-001"
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const aiMessage: Message = {
          id: "initial-greeting",
          content: data.response,
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages([aiMessage]);
      }
    } catch (error) {
      console.error('Error getting initial AI greeting:', error);
    } finally {
      setIsTyping(false);
    }
  };

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0 && STORAGE_KEY && hasInitialized) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving chat messages:', error);
      }
    }
  }, [messages, STORAGE_KEY, hasInitialized]);

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
    
    // Reset textarea height after sending
    setTimeout(() => {
      const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
      if (textarea) {
        textarea.style.height = '44px';
      }
    }, 0);
    
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

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Allow Shift+Enter for new lines - no need to prevent default
    // The textarea will handle it naturally
  };

  // Auto-resize textarea based on content
  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    
    // Auto-resize the textarea
    const textarea = e.target;
    textarea.style.height = 'auto';
    const scrollHeight = Math.min(textarea.scrollHeight, 120); // max-height: 120px
    textarea.style.height = Math.max(44, scrollHeight) + 'px'; // min-height: 44px
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
          label: "Daily Summary",
          action: "How was your day? I'd love to hear about it!"
        }
      ];
    }
  };

  // Handle clock out prompt from dashboard (when employee clocks out)
  useEffect(() => {
    if (
      onClockOutPrompt && 
      clockOutPromptMessage && 
      userRole === 'employee' && 
      hasInitialized && 
      !hasShownClockOutPrompt
    ) {
      const botMessage: Message = {
        id: `clock-out-prompt-${Date.now()}`,
        content: clockOutPromptMessage,
        sender: "bot",
        timestamp: new Date(),
      };
      
      setMessages((prev) => {
        const updated = [...prev, botMessage];
        if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
        return updated;
      });
      
      setHasShownClockOutPrompt(true);
    }
  }, [onClockOutPrompt, clockOutPromptMessage, userRole, hasInitialized, hasShownClockOutPrompt]);

  // Reset the clock out prompt flag when the prompt is cleared
  useEffect(() => {
    if (!onClockOutPrompt) {
      setHasShownClockOutPrompt(false);
    }
  }, [onClockOutPrompt]);

  // Don't render chat until we have a confirmed role and initialized
  if (!userRole || !isLoaded || !hasInitialized) {
    return (
      <div className="h-full flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const quickActions = getQuickActions();

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Removed duplicate header - title is now in parent component */}
      
      {/* Quick Action Buttons */}
      <div className="p-3 border-b bg-background/95 backdrop-blur">
        <div className="grid grid-cols-3 gap-2">
          {quickActions.map((action, index) => (
            <Button
              key={index}
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction(action.action)}
              className="h-auto py-2 flex flex-col items-center gap-1 hover:bg-[#005cb3]/5 hover:border-[#005cb3]/20 transition-all"
            >
              <action.icon className="h-3 w-3 text-[#005cb3]" />
              <span className="font-medium text-[10px] text-center leading-tight">{action.label}</span>
            </Button>
          ))}
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 min-h-0">
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
      <div className="border-t p-3 bg-background flex-shrink-0">
        <div className="flex w-full items-end gap-2">
          <Textarea
            placeholder={userRole === 'admin' 
              ? "Ask about employee performance, company metrics, or team analytics... (Shift+Enter for new line)" 
              : "Tell me about your day, add sales data, or ask for help... (Shift+Enter for new line)"
            }
            value={input}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            className="flex-1 border-muted-foreground/20 focus:border-[#005cb3] transition-colors resize-none min-h-[44px] max-h-[120px]"
            disabled={isTyping}
            rows={1}
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