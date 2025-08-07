'use client';

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: () => void;
  placeholder?: string;
  disabled?: boolean;
  isLoading?: boolean;
  className?: string;
  isExpanded?: boolean; // New prop to know if chat is expanded
}

export function ChatInput({
  value,
  onChange,
  onSend,
  placeholder = "Type your message...",
  disabled = false,
  isLoading = false,
  className,
  isExpanded = false
}: ChatInputProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [rows, setRows] = useState(1);

  // Auto-resize based on content
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // If empty, collapse to single line
    if (!value.trim()) {
      textarea.style.height = 'auto';
      textarea.style.height = '24px'; // Single line height
      setRows(1);
      return;
    }

    // Reset height to calculate new height
    textarea.style.height = 'auto';

    // Calculate new rows based on scroll height and available width
    const lineHeight = 24; // Line height in pixels
    const minHeight = lineHeight; // Start at 1 line
    const maxHeight = lineHeight * 8; // Max 8 lines for better UX

    const scrollHeight = textarea.scrollHeight;
    const newHeight = Math.min(Math.max(scrollHeight, minHeight), maxHeight);
    const newRows = Math.max(1, Math.min(8, Math.ceil(scrollHeight / lineHeight)));

    textarea.style.height = `${newHeight}px`;
    setRows(newRows);
  }, [value]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim() && !disabled && !isLoading) {
        onSend();
      }
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    onChange(e.target.value);
  };

  const canSend = value.trim().length > 0 && !disabled && !isLoading;

  return (
    <div className={cn(
      "relative w-full mx-auto px-2 sm:px-3 md:px-4",
      // Responsive max-widths based on chat expansion state
      isExpanded
        ? "max-w-xs sm:max-w-sm md:max-w-md lg:max-w-lg xl:max-w-xl 2xl:max-w-2xl" // Smaller when expanded (45% chat)
        : "max-w-2xs sm:max-w-xs md:max-w-sm lg:max-w-md xl:max-w-lg 2xl:max-w-xl", // Even smaller when collapsed (35% chat)
      className
    )}>
      <div className={cn(
        "relative flex items-end gap-3 p-3 bg-background border rounded-2xl shadow-sm transition-all duration-200",
        "hover:shadow-md focus-within:shadow-md",
        value.trim()
          ? "border-[#005cb3]/50 focus-within:border-[#005cb3] shadow-[0_0_0_1px_rgba(0,92,179,0.1)]"
          : "border-border focus-within:border-[#005cb3]/20"
      )}>
        <Textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          rows={1}
          className={cn(
            "flex-1 resize-none border-0 bg-transparent p-0 text-sm leading-6 min-h-6",
            "placeholder:text-muted-foreground/60 focus-visible:ring-0 focus-visible:ring-offset-0",
            "scrollbar-thin scrollbar-track-transparent scrollbar-thumb-muted-foreground/20",
            rows > 4 && "overflow-y-auto" // Only show scrollbar when exceeding 4 lines
          )}
          style={{
            minHeight: '24px',
            maxHeight: '192px', // 8 lines * 24px line height
            transition: 'height 0.1s ease-out'
          }}
        />

        <Button
          onClick={onSend}
          disabled={!canSend}
          size="sm"
          className={cn(
            "h-7 w-7 p-0 rounded-full shrink-0 transition-all duration-200",
            canSend
              ? "bg-[#005cb3] hover:bg-[#004a96] text-white shadow-sm hover:shadow-md"
              : "bg-muted/50 text-muted-foreground cursor-not-allowed"
          )}
        >
          {isLoading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <Send className="h-3.5 w-3.5" />
          )}
          <span className="sr-only">Send message</span>
        </Button>
      </div>

      {/* Character count indicator for long messages */}
      {value.length > 500 && (
        <div className="absolute -top-6 right-2 text-xs text-muted-foreground">
          {value.length} characters
        </div>
      )}
    </div>
  );
} 