import { Zap } from "lucide-react";
import { GoogleCalendarTool } from "@/components/tools/GoogleCalendarTool";

export const ToolManager = () => {
  return (
    <div className="flex-1 flex flex-col bg-black/20 backdrop-blur-lg border border-white/10 rounded-xl p-4">
      <div className="flex items-center gap-2 mb-4">
        <Zap className="w-5 h-5 text-yellow-400" />
        <h3 className="text-lg font-semibold text-white">Herramientas</h3>
      </div>
      <div className="flex-1 space-y-4 overflow-y-auto pr-1">
        <p className="text-sm text-gray-400 px-1">
          Conecta herramientas externas para darle a tu agente nuevas habilidades y acceso a información en tiempo real.
        </p>
        <GoogleCalendarTool />
      </div>
    </div>
  );
};