import React from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import { Bot, Trash2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Agent {
  id: string;
  name: string;
  description: string | null;
  status: string;
}

interface UserAgentCardProps {
  agent: Agent;
  index: number;
  onDelete: (agentId: string) => void;
}

export const UserAgentCard = ({ agent, index, onDelete }: UserAgentCardProps) => {
  const cardProps = useInteractiveCard<HTMLDivElement>();

  return (
    <motion.div
      {...cardProps}
      ref={cardProps.ref}
      key={agent.id}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.1 }}
      className={cn(cardProps.className, "bg-black/30 rounded-xl p-4 border border-white/10 hover:border-blue-400 transition-all duration-200 flex items-center justify-between")}
    >
      <Link to={`/agent/${agent.id}`} className="flex-grow min-w-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-md">
            <Bot className="w-6 h-6 text-gray-300" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-white truncate">{agent.name}</h3>
              <Badge variant={agent.status === 'active' ? 'default' : 'secondary'} className={cn('flex-shrink-0', agent.status === 'active' ? 'bg-green-500/20 text-green-300 border-green-500/30' : 'bg-gray-500/20 text-gray-300 border-gray-500/30')}>
                {agent.status === 'active' ? 'Activo' : 'Inactivo'}
              </Badge>
            </div>
            <p className="text-sm text-gray-400 line-clamp-1">{agent.description || 'Sin descripción'}</p>
          </div>
        </div>
      </Link>
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button variant="ghost" size="icon" className="h-8 w-8 text-gray-400 hover:text-red-500 flex-shrink-0 ml-2">
            <Trash2 className="w-4 h-4" />
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta acción eliminará permanentemente el agente "{agent.name}" y todos sus datos asociados.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => onDelete(agent.id)} className="bg-red-600 hover:bg-red-700">
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};