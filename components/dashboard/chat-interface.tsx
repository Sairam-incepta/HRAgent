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
import { getChatMessages } from '@/lib/database';
import { useRouter } from "next/navigation";

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const MAX_MESSAGES = 35;

// Enhanced welcome messages with personalization
const getWelcomeMessage = (userRole: string, userName: string) => {
  const currentHour = new Date().getHours();
  let greeting = "Hello";
  
  if (currentHour < 12) {
    greeting = "Good morning";
  } else if (currentHour < 17) {
    greeting = "Good afternoon";
  } else {
    greeting = "Good evening";
  }

  if (userRole === 'admin') {
    return `${greeting}, ${userName}! 👋 I'm your Let's Insure Admin Assistant, ready to help you manage your team and analyze company performance.

🎯 **Quick Admin Actions:**
• 👥 View employee performance metrics
• 📊 Analyze company-wide sales data  
• 💼 Review overtime requests and approvals
• 📈 Track department performance and KPIs
• 💰 Monitor payroll and compensation data

What would you like to know about your team or company performance today?`;
  } else {
    return `${greeting}, ${userName}! 🌟 I'm your Let's Insure Employee Assistant, here to help you track your success and achieve your goals.

✨ **I'm here to help you:**
• 📊 Track your policy sales and performance
• ⏰ Log your work hours efficiently  
• ⭐ Record amazing client reviews
• 📝 Create meaningful daily summaries
• 🎯 Celebrate your achievements

Ready to make today productive? Just tell me what you'd like to do, or try one of the quick actions below! 💪`;
  }
};

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
          "relative rounded-lg px-3 py-3 pb-8 shadow-sm min-h-[3.5rem]",
          // Simple max-width based on chat state
          isExpanded ? "max-w-[75%]" : "max-w-[85%]",
          // Styling based on sender
          isUser
            ? "bg-[#005cb3] text-white"
            : "bg-muted/50 border"
        )}>
          <p 
            className="text-sm break-words whitespace-pre-wrap pr-10"
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
  onToggleExpand,
  defaultMessage,
  onClockOutPrompt,
  clockOutPromptMessage
}: { 
  dailySummaryPrompt?: string | null;
  onDailySummaryPromptShown?: () => void;
  onCollapse?: () => void;
  isExpanded?: boolean;
  onToggleExpand?: () => void;
  defaultMessage?: string;
  onClockOutPrompt?: boolean;
  clockOutPromptMessage?: string;
}) {
  const { user, isLoaded, isSignedIn } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [userRole, setUserRole] = useState<"admin" | "employee" | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();
  const router = useRouter();
  const [hasRedirected, setHasRedirected] = useState(false);
  const [awaitingDailySummary, setAwaitingDailySummary] = useState(false);
  const [hasShownClockOutPrompt, setHasShownClockOutPrompt] = useState(false);

  // Determine user role
  useEffect(() => {
    if (isLoaded && user) {
      const isAdmin = user.emailAddresses[0]?.emailAddress === 'admin@letsinsure.hr' ||
                     user.publicMetadata?.role === 'admin' ||
                     user.id === 'user_2y2ylH58JkmHljhJT0BXIfjHQui';
      setUserRole(isAdmin ? 'admin' : 'employee');
    }
  }, [isLoaded, user]);

  // Load messages from backend on mount OR show enhanced welcome
  useEffect(() => {
    const loadMessages = async () => {
      if (!user?.id || !userRole) return;
      
      try {
        const msgs = await getChatMessages({ userId: user.id, limit: MAX_MESSAGES });
        if (msgs && msgs.length > 0) {
          setMessages(msgs.map((msg: any) => ({
            id: msg.id,
            content: msg.content,
            sender: msg.role === 'bot' ? 'bot' : 'user',
            timestamp: new Date(msg.timestamp)
          })));
        } else {
          // Show enhanced welcome message if no previous messages
          const userName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';
          const welcomeMessage: Message = {
            id: "welcome",
            content: getWelcomeMessage(userRole, userName),
            sender: "bot",
            timestamp: new Date(),
          };
          setMessages([welcomeMessage]);
        }
      } catch (error) {
        // Fallback to enhanced welcome message
        const userName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';
        const welcomeMessage: Message = {
          id: "welcome",
          content: getWelcomeMessage(userRole, userName),
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    };

    loadMessages();
  }, [user?.id, userRole]);

  // Show default message on mount if provided and no other messages
  useEffect(() => {
    if (defaultMessage && messages.length === 0 && userRole) {
      setMessages([
        {
          id: `default-message-${Date.now()}`,
          content: defaultMessage,
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    }
  }, [defaultMessage, userRole]);

  // Enhanced daily summary prompt with motivational messages
  useEffect(() => {
    if (dailySummaryPrompt && userRole === 'employee') {
      const motivationalPrompts = [
        "🌟 Hey superstar! What an accomplishment clocking out after a productive day! I'd love to hear about your wins, challenges, and everything in between. What made today special?",
        "💪 You did it! Another day of hard work complete! I'm excited to hear about your journey today - the highs, the lessons, and all the moments that made it yours. How was your day?",
        "🎉 Time to celebrate another day of dedication! You've put in the effort, and that's something to be proud of. Tell me about your day - what went well, what you learned, or just how you're feeling!",
        "✨ What a champion! You've wrapped up another day of making things happen. I'm here to listen to your story - the victories, the challenges, the growth. How did today treat you?",
        "🚀 Amazing work today! You've invested your time and energy into your goals, and that's incredible. Share with me how your day unfolded - I'd love to hear about your experiences!",
        "🌈 You've reached the finish line of another productive day! Whether it was smooth sailing or had its bumps, every day is a step forward. What's your story from today?",
        "💎 Look at you, completing another day of pursuing excellence! Each day is a building block in your success story. Tell me about today's chapter - what happened?",
        "🎯 Fantastic! You've dedicated another day to your professional growth and goals. I'm genuinely curious about your journey today - the good, the challenging, and everything in between!"
      ];

      // Pick a random motivational prompt
      const randomPrompt = motivationalPrompts[Math.floor(Math.random() * motivationalPrompts.length)];
      
      const botMessage: Message = {
        id: `motivational-prompt-${Date.now()}`,
        content: randomPrompt,
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

  // Show post-clock-out prompt when onClockOutPrompt becomes true
  useEffect(() => {
    if (onClockOutPrompt && !hasShownClockOutPrompt && userRole === 'employee') {
      setAwaitingDailySummary(true);
      setHasShownClockOutPrompt(true);
      // Add the prompt as a bot message
      setMessages(prev => [
        ...prev,
        {
          id: `clockout-prompt-${Date.now()}`,
          content: clockOutPromptMessage || "How was your day? Please share a brief summary before you clock out!",
          sender: "bot",
          timestamp: new Date(),
        },
      ]);
    }
    if (!onClockOutPrompt) {
      setHasShownClockOutPrompt(false);
    }
  }, [onClockOutPrompt, userRole, hasShownClockOutPrompt, clockOutPromptMessage]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Handle daily summary submission (after clock out)
  const handleDailySummarySubmit = async () => {
    if (!input.trim() || isTyping || !userRole || !user?.id) return;
    setIsTyping(true);
    try {
      // Send to /api/chat with isDailySummarySubmission flag
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          userRole: userRole, 
          employeeId: user.id, 
          isDailySummarySubmission: true,
          userName: user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there'
        })
      });
      const data = await response.json();
      // Add user message
      addMessage({
        id: Date.now().toString(),
        content: input,
        sender: "user",
        timestamp: new Date(),
      });
      // Add bot response
      addMessage({
        id: (Date.now() + 1).toString(),
        content: data.response || "Thank you for your summary!",
        sender: "bot",
        timestamp: new Date(),
      });
      setAwaitingDailySummary(false);
      setInput("");
    } catch (error) {
      toast({ title: "Error", description: "Failed to submit summary.", variant: "destructive" });
      setAwaitingDailySummary(false);
    } finally {
      setIsTyping(false);
    }
  };

  // When adding a new message, keep only the latest 35 (excluding the welcome message)
  const addMessage = (newMsg: Message) => {
    setMessages(prev => {
      const updated = [...prev, newMsg];
      if (updated.length > MAX_MESSAGES) updated.splice(0, updated.length - MAX_MESSAGES);
      return updated;
    });
  };

  // Enhanced handleSend with better error handling and user name
  const handleSend = async () => {
    if (awaitingDailySummary) {
      await handleDailySummarySubmit();
      return;
    }
    if (!input.trim() || isTyping || !userRole || !user?.id) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      sender: "user",
      timestamp: new Date(),
    };
    addMessage(userMessage);
    setInput("");
    setIsTyping(true);
    
    try {
      // Get user name for personalization
      const userName = user?.firstName || user?.emailAddresses[0]?.emailAddress?.split('@')[0] || 'there';
      
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          message: input, 
          userRole: userRole, 
          employeeId: user.id,
          userName: userName // Add userName for personalized responses
        })
      });
      
      if (!response.ok) {
        let errorBody = '';
        try { errorBody = await response.text(); } catch {}
        console.error('Chat API error:', response.status, errorBody);
        throw new Error('Failed to get response');
      }
      
      const data = await response.json();
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: data.response,
        sender: "bot",
        timestamp: new Date(),
      };
      addMessage(botMessage);
    } catch (error) {
      console.error('Chat handleSend error:', error);
      toast({ 
        title: "Error", 
        description: "Failed to get response from assistant. Please try again.", 
        variant: "destructive" 
      });
      
      // Add encouraging error message
      const errorMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "I'm having a bit of trouble connecting right now, but don't worry! 😊 Please check that the OpenAI API is configured and try again. I'm here to help you succeed! 💪",
        sender: "bot",
        timestamp: new Date(),
      };
      addMessage(errorMessage);
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

  useEffect(() => {
    if (isLoaded && isSignedIn && !hasRedirected) {
      setHasRedirected(true);
      setTimeout(() => {
        router.replace('/dashboard');
      }, 100);
    }
  }, [isLoaded, isSignedIn, router, hasRedirected]);

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

  // Always show the welcome message at the top
  const renderMessages = () => {
    const welcomeMsg: Message[] = defaultMessage
      ? [{
          id: 'welcome-message',
          content: defaultMessage,
          sender: 'bot',
          timestamp: new Date(0),
        }]
      : [];
    return [
      ...welcomeMsg,
      ...messages.slice(-MAX_MESSAGES)
    ];
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
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-3">
        {renderMessages().map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            userInitials={getUserInitials()}
            userImageUrl={user?.imageUrl}
            isExpanded={!!isExpanded}
          />
        ))}
        {isTyping && <TypingIndicator isExpanded={!!isExpanded} />}
        <div ref={messagesEndRef} />
      </div>

      {/* Input Area */}
      <form
        className="flex items-center gap-2 p-3 border-t bg-background"
        onSubmit={e => {
          e.preventDefault()
          handleSend();
        }}
      >
        <Input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={awaitingDailySummary ? "Share a brief summary of your day..." : "Type your message..."}
          disabled={isTyping}
        />
        <Button type="submit" disabled={isTyping || !input.trim()}>
          {isTyping ? <Loader2 className="animate-spin h-4 w-4" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}