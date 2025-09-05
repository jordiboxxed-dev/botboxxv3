import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { motion } from "framer-motion";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isUser = role === "user";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
      className={cn(
        "flex items-start gap-4 p-4 rounded-lg max-w-[80%]",
        isUser ? "self-end bg-blue-500/20" : "self-start bg-white/10"
      )}
    >
      <div
        className={cn(
          "p-2 rounded-full",
          isUser ? "bg-blue-500/30" : "bg-white/20"
        )}
      >
        {isUser ? (
          <User className="w-5 h-5 text-blue-300" />
        ) : (
          <Bot className="w-5 h-5 text-gray-300" />
        )}
      </div>
      <p className="text-white whitespace-pre-wrap pt-1">{content}</p>
    </motion.div>
  );
};