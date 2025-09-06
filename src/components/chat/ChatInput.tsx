import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Send, Mic } from "lucide-react";
import { useSpeechRecognition } from "@/hooks/useSpeechRecognition";
import { cn } from "@/lib/utils";

interface ChatInputProps {
  onSendMessage: (message: string) => void;
  isLoading: boolean;
}

export const ChatInput = ({ onSendMessage, isLoading }: ChatInputProps) => {
  const [message, setMessage] = useState("");
  const { transcript, isListening, startListening, stopListening, hasRecognitionSupport } = useSpeechRecognition();

  useEffect(() => {
    if (transcript) {
      setMessage(transcript);
    }
  }, [transcript]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (message.trim() && !isLoading) {
      onSendMessage(message);
      setMessage("");
    }
  };

  const handleMicClick = () => {
    if (isListening) {
      stopListening();
    } else {
      startListening();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="flex items-center gap-4 p-4 bg-black/20 border-t border-white/10">
      <Textarea
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Escribe tu mensaje o usa el micrófono..."
        className="flex-1 bg-black/30 border-white/20 text-white placeholder:text-gray-500 rounded-lg resize-none min-h-[60px] max-h-[120px]"
        disabled={isLoading}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSubmit(e);
          }
        }}
      />
      {hasRecognitionSupport && (
        <Button 
          type="button" 
          onClick={handleMicClick}
          size="icon" 
          className={cn(
            "rounded-full h-12 w-12 transition-colors",
            isListening ? "bg-red-600 hover:bg-red-700" : "bg-gray-600 hover:bg-gray-700"
          )}
        >
          <Mic className="w-5 h-5" />
        </Button>
      )}
      <Button 
        type="submit" 
        disabled={isLoading || !message.trim()} 
        size="icon" 
        className="rounded-full h-12 w-12"
      >
        <Send className="w-5 h-5" />
      </Button>
    </form>
  );
};