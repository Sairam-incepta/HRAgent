'use client';

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChatInput } from "./chat-input";
import { PlaneIcon as PaperPlaneIcon, PlusCircle, Loader2, TrendingUp, Clock, Star, Users, AlertTriangle, DollarSign } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { getChatMessages, addChatMessage } from "@/lib/database";

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

  // Load messages from database and send initial AI greeting
  useEffect(() => {
    if (!userRole || hasInitialized || !user?.id) return;

    const loadMessagesAndInitialize = async () => {
      try {
        // Load existing chat messages from database
        const chatMessages = await getChatMessages({ userId: user.id, limit: MAX_MESSAGES });
        
        if (chatMessages && chatMessages.length > 0) {
          // Convert database messages to UI format
          const formattedMessages = chatMessages.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: (msg.role === 'bot' ? 'bot' : 'user') as "user" | "bot",
            timestamp: new Date(msg.timestamp)
          }));
          setMessages(formattedMessages);
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
  }, [userRole, user?.id, hasInitialized]);

  // Get initial AI greeting
  const getInitialAIGreeting = async () => {
    if (!userRole || !user?.id) return;

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
          employeeId: user.id
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
        
        // Save AI greeting to database
        try {
          await addChatMessage({
            userId: user.id,
            role: 'bot',
            content: data.response
          });
        } catch (dbError) {
          console.error('Error saving AI greeting to database:', dbError);
        }
        
        setMessages([aiMessage]);
      }
    } catch (error) {
      console.error('Error getting initial AI greeting:', error);
    } finally {
      setIsTyping(false);
    }
  };

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
    if (!input.trim() || isTyping || !userRole || !user?.id) return;

    // Add user message
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };
    
    // Save user message to database
    try {
      await addChatMessage({
        userId: user.id,
        role: userRole,
        content: input
      });
    } catch (error) {
      console.error('Error saving user message to database:', error);
    }
    
    // Remove oldest messages if limit is reached
    const updatedMessages = [...messages, userMessage];
    if (updatedMessages.length > MAX_MESSAGES) {
      updatedMessages.splice(0, updatedMessages.length - MAX_MESSAGES);
    }
    
    setMessages(updatedMessages);
    const currentInput = input;
    setInput("");
    setIsTyping(true);
    
    // Input cleared - textarea remains fixed height
    
    try {
      // Call OpenAI API with user role
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: currentInput,
          userRole: userRole,
          employeeId: user.id
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
      
      // Save bot message to database
      try {
        await addChatMessage({
          userId: user.id,
          role: 'bot',
          content: data.response
        });
      } catch (error) {
        console.error('Error saving bot message to database:', error);
      }
      
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

  const handleInputChange = (value: string) => {
    setInput(value);
  };

  const handleQuickAction = (action: string) => {
    setInput(action);
  };

  // Quick actions based on user role
  const getQuickActions = () => {
    if (userRole === 'admin') {
      return [
        {
          icon: AlertTriangle,
          label: "Attention",
          action: "What urgent items need my immediate attention?"
        },
        {
          icon: Users,
          label: "Team performance",
          action: "How is my team performing this month?"
        },
        {
          icon: DollarSign,
          label: "Sales summary",
          action: "Show me our sales summary and top performers"
        }
      ];
    } else {
      return [
        {
          icon: TrendingUp,
          label: "New Sale",
          action: "I sold a new policy today"
        },
        {
          icon: Star,
          label: "Add Review",
          action: "I have a client review to record"
        },
        {
          icon: Clock,
          label: "Share Day",
          action: "Here's how my day went"
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
      !hasShownClockOutPrompt &&
      user?.id
    ) {
      const botMessage: Message = {
        id: `clock-out-prompt-${Date.now()}`,
        content: clockOutPromptMessage,
        sender: "bot",
        timestamp: new Date(),
      };
      
      // Save clock out prompt to database
      try {
        addChatMessage({
          userId: user.id,
          role: 'bot',
          content: clockOutPromptMessage
        });
      } catch (error) {
        console.error('Error saving clock out prompt to database:', error);
      }
      
      setMessages((prev) => {
        const updated = [...prev, botMessage];
        if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
        return updated;
      });
      
      setHasShownClockOutPrompt(true);
    }
  }, [onClockOutPrompt, clockOutPromptMessage, userRole, hasInitialized, hasShownClockOutPrompt, user?.id]);

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
      <div className="px-4 py-3 border-b bg-background/50 backdrop-blur">
        <div className="flex gap-2 justify-between">
          {quickActions.map((action, index) => (
                          <Button
                key={index}
                variant="ghost"
                size="sm"
                onClick={() => handleQuickAction(action.action)}
                className="flex-1 h-10 flex items-center justify-start gap-2 px-3 rounded-lg hover:bg-[#005cb3]/8 hover:text-[#005cb3] transition-all duration-200 border border-border/40 hover:border-[#005cb3]/30"
              >
                <action.icon className="h-4 w-4 text-[#005cb3] shrink-0" />
                <span className="text-sm font-medium text-left leading-tight text-foreground/80 hover:text-[#005cb3] truncate">{action.label}</span>
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
              <div 
                className="whitespace-pre-wrap text-sm leading-relaxed"
                dangerouslySetInnerHTML={{ __html: message.content }}
              />
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
      <div className="p-3 bg-background flex-shrink-0">
        <ChatInput
          value={input}
          onChange={handleInputChange}
          onSend={handleSend}
          placeholder={userRole === 'admin' 
            ? "Ask about team performance or analytics..." 
            : "Share your wins, ask questions, or get support..."
          }
          disabled={isTyping}
          isLoading={isTyping}
          isExpanded={isExpanded}
        />
      </div>
    </div>
  );
}