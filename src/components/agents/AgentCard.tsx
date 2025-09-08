"use client";

import React from "react";
import { motion } from "framer-motion";
import { Agent } from "@/data/mock-agents";
import * as LucideIcons from "lucide-react";
import { Bot } from "lucide-react";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";

const Icon = ({ name, ...props }: { name: string } & LucideIcons.LucideProps) => {
  const LucideIcon = LucideIcons[name as keyof typeof LucideIcons] as LucideIcons.LucideIcon;
  return LucideIcon ? <LucideIcon {...props} /> : <Bot {...props} />;
};

interface AgentCardProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
  index: number;
  isInteractive?: boolean;
  disableAnimation?: boolean;
}

export const AgentCard = ({ agent, onClick, index, isInteractive = true, disableAnimation = false }: AgentCardProps) => {
  const cardProps = useInteractiveCard<HTMLButtonElement>();

  const finalRef = isInteractive ? cardProps.ref : null;
  const eventHandlers = isInteractive ? { onMouseMove: cardProps.onMouseMove, onMouseLeave: cardProps.onMouseLeave } : {};
  const finalClassName = isInteractive ? cardProps.className : "";

  const motionProps = disableAnimation ? {} : {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.3, delay: 0.1 * index + 0.8 }
  };

  return (
    <motion.button
      ref={finalRef}
      {...eventHandlers}
      {...motionProps}
      onClick={() => onClick(agent)}
      className={cn(
        finalClassName,
        "w-full text-left p-4 rounded-xl flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-400"
      )}
    >
      <div className="p-2 bg-white/10 rounded-md">
        <Icon name={agent.avatar} className="w-6 h-6 text-gray-300" />
      </div>
      <div>
        <p className="font-semibold text-white">{agent.name}</p>
        <p className="text-sm text-gray-400">{agent.description}</p>
      </div>
    </motion.button>
  );
};