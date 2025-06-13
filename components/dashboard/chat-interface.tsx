'use client';

import { useState, useRef, useEffect } from "react";
import { useUser } from "@clerk/nextjs";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PlaneIcon as PaperPlaneIcon, PlusCircle, Loader2, TrendingUp, DollarSign, Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const MAX_MESSAGES = 35;
const STORAGE_KEY = 'letsinsure_chat_messages';

export function ChatInterface() {
  const { user } = useUser();
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

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
          // Set initial welcome message if no stored messages
          const welcomeMessage: Message = {
            id: "welcome",
            content: "Hello! I'm your Let's Insure Assistant. I can help you:\n\n📊 Track policy sales and bonuses\n💰 Calculate broker fees\n⏰ Log your hours\n⭐ Record client reviews\n📝 Create daily summaries\n\nJust tell me what you'd like to do, or try one of the quick actions below!",
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
          content: "Hello! I'm your Let's Insure Assistant. I can help you:\n\n📊 Track policy sales and bonuses\n💰 Calculate broker fees\n⏰ Log your hours\n⭐ Record client reviews\n📝 Create daily summaries\n\nJust tell me what you'd like to do, or try one of the quick actions below!",
          sender: "bot",
          timestamp: new Date(),
        };
        setMessages([welcomeMessage]);
      }
    };

    loadMessages();
  }, []);

  // Save messages to localStorage whenever messages change
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
      } catch (error) {
        console.error('Error saving chat messages:', error);
      }
    }
  }, [messages]);

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
    return "EM";
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
      // Call OpenAI API
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message: input,
          employeeId: user?.id || "emp-001" // Use Clerk user ID
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

  return (
    <div className="h-full flex flex-col">
      <CardHeader className="pb-3 pt-4 px-4">
        <CardTitle className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-[#005cb3]"></span>
          Let's Insure Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto px-4 pb-0">
        <div className="space-y-4">
          {/* Quick Action Buttons - Removed extra spacing */}
          <div className="grid grid-cols-2 gap-2 mb-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction("I sold a new policy today")}
              className="text-xs h-auto p-2 flex flex-col items-start gap-1 justify-start text-left hover:bg-[#005cb3]/5"
            >
              <TrendingUp className="h-4 w-4 text-[#005cb3] self-start" />
              <span className="text-left font-medium">Add Policy Sale</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction("I have a client review to record")}
              className="text-xs h-auto p-2 flex flex-col items-start gap-1 justify-start text-left hover:bg-[#005cb3]/5"
            >
              <Star className="h-4 w-4 text-[#005cb3] self-start" />
              <span className="text-left font-medium">Add Review</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction("Create my daily summary")}
              className="text-xs h-auto p-2 flex flex-col items-start gap-1 justify-start text-left hover:bg-[#005cb3]/5"
            >
              <Clock className="h-4 w-4 text-[#005cb3] self-start" />
              <span className="text-left font-medium">Daily Summary</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleQuickAction("Show my total bonus")}
              className="text-xs h-auto p-2 flex flex-col items-start gap-1 justify-start text-left hover:bg-[#005cb3]/5"
            >
              <DollarSign className="h-4 w-4 text-[#005cb3] self-start" />
              <span className="text-left font-medium">View Bonus</span>
            </Button>
          </div>

          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-2 max-w-[95%]",
                message.sender === "user" ? "ml-auto" : ""
              )}
            >
              {message.sender === "bot" && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">LI</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "rounded-lg px-3 py-2 max-w-full",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
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
              {message.sender === "user" && (
                <Avatar className="h-8 w-8 flex-shrink-0">
                  <AvatarImage src={user?.imageUrl} />
                  <AvatarFallback>{getUserInitials()}</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-start gap-2 max-w-[95%]">
              <Avatar className="h-8 w-8 flex-shrink-0">
                <AvatarFallback className="bg-[#005cb3]/10 text-[#005cb3]">LI</AvatarFallback>
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
            placeholder="Ask about policies, add sales data, record reviews..."
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