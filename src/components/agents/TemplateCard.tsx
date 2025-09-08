import React from "react";
import { motion } from "framer-motion";
import { Agent as TemplateAgent } from "@/data/mock-agents";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import { AgentCard } from "./AgentCard";
import { Button } from "@/components/ui/button";

interface TemplateCardProps {
  agent: TemplateAgent;
  index: number;
  onPreview: (agent: TemplateAgent) => void;
  onUseTemplate: (agent: TemplateAgent) => void;
}

export const TemplateCard = ({ agent, index, onPreview, onUseTemplate }: TemplateCardProps) => {
  const cardProps = useInteractiveCard<HTMLDivElement>();

  return (
    <motion.div
      {...cardProps}
      ref={cardProps.ref}
      key={agent.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={cn(cardProps.className, "bg-black/30 rounded-xl p-6 border border-white/10 hover:border-blue-400 transition-all duration-200 h-full flex flex-col")}
    >
      <AgentCard
        agent={agent}
        onClick={() => {}}
        index={index}
        isInteractive={false}
        disableAnimation={true}
      />
      <p className="text-gray-400 text-sm mt-4 mb-6 flex-grow">{agent.description}</p>
      <div className="flex items-center gap-2 mt-auto">
        <Button
          variant="secondary"
          onClick={() => onPreview(agent)}
          className="w-full"
        >
          Previsualizar
        </Button>
        <Button
          onClick={() => onUseTemplate(agent)}
          className="w-full"
        >
          Usar Plantilla
        </Button>
      </div>
    </motion.div>
  );
};