import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface ChatMessageProps {
  role: "user" | "assistant";
  content: string;
}

export const ChatMessage = ({ role, content }: ChatMessageProps) => {
  const isUser = role === "user";

  if (role === "assistant" && !content) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex items-start gap-4 p-4 rounded-lg max-w-[80%] self-start bg-white/10"
      >
        <div className="p-2 rounded-full bg-white/20">
          <Bot className="w-5 h-5 text-gray-300" />
        </div>
        <div className="pt-2">
          <div className="typing-indicator">
            <span></span>
            <span></span>
            <span></span>
          </div>
        </div>
      </motion.div>
    );
  }

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
      <div className="prose prose-sm prose-invert max-w-none text-white pt-1 w-full">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
      </div>
    </motion.div>
  );
};