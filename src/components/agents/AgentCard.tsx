"use client";

import React from "react";
import { motion } from "framer-motion";
import { Agent } from "@/data/mock-agents";
import * as LucideIcons from "lucide-react";
import { Bot } from "lucide-react";

const Icon = ({ name, ...props }: { name: string } & LucideIcons.LucideProps) => {
  const LucideIcon = LucideIcons[name as keyof typeof LucideIcons] as LucideIcons.LucideIcon;
  return LucideIcon ? <LucideIcon {...props} /> : <Bot {...props} />;
};

interface AgentCardProps {
  agent: Agent;
  onClick: (agent: Agent) => void;
  index: number;
}

export const AgentCard = ({ agent, onClick, index }: AgentCardProps) => {
  const cardRef = React.useRef<HTMLButtonElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLButtonElement>) => {
    const { clientX, clientY, currentTarget } = e;
    const { left, top, width, height } = currentTarget.getBoundingClientRect();
    const xPct = (clientX - left) / width;
    const yPct = (clientY - top) / height;

    const rotateX = (yPct - 0.5) * -15;
    const rotateY = (xPct - 0.5) * 15;

    if (cardRef.current) {
      cardRef.current.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
      cardRef.current.style.setProperty('--glow-x', `${xPct * 100}%`);
      cardRef.current.style.setProperty('--glow-y', `${yPct * 100}%`);
    }
  };

  const handleMouseLeave = () => {
    if (cardRef.current) {
      cardRef.current.style.transform = 'perspective(1000px) rotateX(0deg) rotateY(0deg) scale(1)';
    }
  };

  return (
    <motion.button
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: 0.1 * index + 0.8 }}
      onClick={() => onClick(agent)}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="agent-card w-full text-left p-4 rounded-xl flex items-center gap-4 bg-white/5 backdrop-blur-md border border-white/10 transition-all duration-300 ease-out focus:outline-none focus:ring-2 focus:ring-blue-400 relative overflow-hidden"
    >
      <div className="p-2 bg-white/10 rounded-md z-10">
        <Icon name={agent.avatar} className="w-6 h-6 text-gray-300" />
      </div>
      <div className="z-10">
        <p className="font-semibold text-white">{agent.name}</p>
        <p className="text-sm text-gray-400">{agent.description}</p>
      </div>
    </motion.button>
  );
};