import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, PlusCircle, BookOpen, Star } from "lucide-react";
import { motion } from "framer-motion";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import React from "react";

export const OnboardingGuide = () => {
  const blueCardProps = useInteractiveCard<HTMLDivElement>({ glowColor: "rgba(59, 130, 246, 0.4)" });
  const greenCardProps = useInteractiveCard<HTMLDivElement>({ glowColor: "rgba(52, 211, 153, 0.4)" });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.1 }}
      className="w-full max-w-4xl mx-auto"
    >
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold text-white">¡Bienvenido a BotBoxx!</h2>
        <p className="text-lg text-gray-400 mt-2">Tu primer paso en el mundo de la IA conversacional. Vamos a crear tu primer agente.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-10">
        <Link to="/templates" className="block h-full">
          <div 
            {...blueCardProps}
            ref={blueCardProps.ref}
            className={cn(blueCardProps.className, "relative bg-black/30 p-8 rounded-xl border-2 border-blue-400 transition-all duration-300 flex flex-col items-center text-center h-full")}
          >
            <div className="absolute top-4 right-4 bg-blue-500 text-white px-3 py-1 text-xs font-bold rounded-full flex items-center gap-1">
              <Star className="w-3 h-3" /> Recomendado
            </div>
            <Bot className="w-16 h-16 mb-4 text-blue-400" />
            <h3 className="text-2xl font-semibold mb-2">Empezar con una Plantilla</h3>
            <p className="text-gray-400 mb-6 flex-grow">La forma más rápida de poner en marcha un agente. Elige un caso de uso pre-configurado y personalízalo.</p>
            <Button className="mt-auto bg-blue-600 hover:bg-blue-700">Elegir Plantilla</Button>
          </div>
        </Link>
        
        <Link to="/create-agent" className="block h-full">
          <div 
            {...greenCardProps}
            ref={greenCardProps.ref}
            className={cn(greenCardProps.className, "bg-black/30 p-8 rounded-xl border border-white/10 hover:border-green-400 transition-all duration-300 flex flex-col items-center text-center h-full")}
          >
            <PlusCircle className="w-16 h-16 mb-4 text-green-400" />
            <h3 className="text-2xl font-semibold mb-2">Crear desde Cero</h3>
            <p className="text-gray-400 mb-6 flex-grow">Para un control total. Define la personalidad, instrucciones y conocimiento de tu agente desde el principio.</p>
            <Button variant="secondary" className="mt-auto">Crear Agente</Button>
          </div>
        </Link>
      </div>

      <div className="bg-black/20 border border-white/10 rounded-xl p-6 flex items-start gap-4">
        <div className="p-2 bg-white/10 rounded-md mt-1">
          <BookOpen className="w-6 h-6 text-gray-300" />
        </div>
        <div>
          <h4 className="font-semibold text-white">¿Qué son las Fuentes de Conocimiento?</h4>
          <p className="text-gray-400 text-sm">Son el cerebro de tu agente. Puedes "alimentarlo" con el contenido de tu web, documentos PDF, o texto simple. El agente usará esta información para dar respuestas precisas y relevantes.</p>
        </div>
      </div>
    </motion.div>
  );
};