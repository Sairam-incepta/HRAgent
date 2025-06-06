'use client';

import { useState, useRef, useEffect } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PlaneIcon as PaperPlaneIcon, PlusCircle } from "lucide-react";
import { cn } from "@/lib/utils";

type Message = {
  id: string;
  content: string;
  sender: "user" | "bot";
  timestamp: Date;
};

const MAX_MESSAGES = 35;

export function ChatInterface() {
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "1",
      content: "Hello! I'm your TimeBoost assistant. How can I help you today?",
      sender: "bot",
      timestamp: new Date(),
    },
  ]);
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!input.trim()) return;

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
    
    // Simulate bot typing
    setIsTyping(true);
    
    // Simulate bot response
    setTimeout(() => {
      let botResponse = "";
      
      if (input.toLowerCase().includes("policy") || input.toLowerCase().includes("sale")) {
        botResponse = "Great job on the policy sale! Can you provide the policy number and customer details? This will help me track your bonus eligibility.";
      } else if (input.toLowerCase().includes("break") || input.toLowerCase().includes("lunch")) {
        botResponse = "I've noted your break time. Remember, standard breaks are 45 minutes. Enjoy your break!";
      } else if (input.toLowerCase().includes("overtime") || input.toLowerCase().includes("late")) {
        botResponse = "I've recorded your overtime notification. Please make sure to clock out properly when you finish.";
      } else if (input.toLowerCase().includes("vacation") || input.toLowerCase().includes("time off")) {
        botResponse = "I can help you submit a time off request. Please specify the dates and type of leave (vacation, sick, personal, etc.).";
      } else {
        botResponse = "Thanks for your message. How else can I assist you today with time tracking, sales reporting, or requests?";
      }
      
      const botMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: botResponse,
        sender: "bot",
        timestamp: new Date(),
      };
      
      // Remove oldest messages if limit is reached
      const updatedMessagesWithBot = [...messages, userMessage, botMessage];
      if (updatedMessagesWithBot.length > MAX_MESSAGES) {
        updatedMessagesWithBot.splice(0, updatedMessagesWithBot.length - MAX_MESSAGES);
      }
      
      setIsTyping(false);
      setMessages(updatedMessagesWithBot);
    }, 1500);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="h-full flex flex-col">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <span className="h-3 w-3 rounded-full bg-green-500"></span>
          Bonus Bot Assistant
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto p-4">
        <div className="space-y-4">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn(
                "flex items-start gap-3 max-w-[80%]",
                message.sender === "user" ? "ml-auto" : ""
              )}
            >
              {message.sender === "bot" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback className="bg-teal-100 text-teal-800">BB</AvatarFallback>
                </Avatar>
              )}
              <div
                className={cn(
                  "rounded-lg px-4 py-2",
                  message.sender === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                )}
              >
                <p>{message.content}</p>
                <p className="text-xs opacity-70 mt-1">
                  {message.timestamp.toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </p>
              </div>
              {message.sender === "user" && (
                <Avatar className="h-8 w-8">
                  <AvatarFallback>JD</AvatarFallback>
                </Avatar>
              )}
            </div>
          ))}
          
          {isTyping && (
            <div className="flex items-start gap-3 max-w-[80%]">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-teal-100 text-teal-800">BB</AvatarFallback>
              </Avatar>
              <div className="rounded-lg px-4 py-2 bg-muted">
                <div className="flex gap-1">
                  <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="h-2 w-2 bg-muted-foreground/40 rounded-full animate-bounce"></span>
                </div>
              </div>
            </div>
          )}
          
          <div ref={messagesEndRef} />
        </div>
      </CardContent>
      <CardFooter className="border-t p-4">
        <div className="flex w-full items-center gap-2">
          <Button variant="outline" size="icon" className="shrink-0">
            <PlusCircle className="h-4 w-4" />
            <span className="sr-only">Attach file</span>
          </Button>
          <Input
            placeholder="Type your message..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1"
          />
          <Button onClick={handleSend} disabled={!input.trim()} className="bg-teal-600 hover:bg-teal-700">
            <PaperPlaneIcon className="h-4 w-4" />
            <span className="sr-only">Send</span>
          </Button>
        </div>
      </CardFooter>
    </div>
  );
}