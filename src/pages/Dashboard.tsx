import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Bot, PlusCircle } from "lucide-react";

const Dashboard = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-gray-900 text-white p-4">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-bold mb-2">Plataforma de Agentes IA</h1>
        <p className="text-lg text-gray-400">Crea o selecciona un agente para comenzar.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
        <Link to="/templates" className="bg-black/30 p-8 rounded-xl border border-white/10 hover:border-blue-400 transition-all duration-300 flex flex-col items-center text-center">
          <Bot className="w-16 h-16 mb-4 text-blue-400" />
          <h2 className="text-2xl font-semibold mb-2">Usar una Plantilla</h2>
          <p className="text-gray-400 mb-6">Comienza rápidamente con uno de nuestros agentes pre-configurados para diferentes industrias.</p>
          <Button>Explorar Plantillas</Button>
        </Link>
        <Link to="/create-agent" className="bg-black/30 p-8 rounded-xl border border-white/10 hover:border-green-400 transition-all duration-300 flex flex-col items-center text-center">
          <PlusCircle className="w-16 h-16 mb-4 text-green-400" />
          <h2 className="text-2xl font-semibold mb-2">Crear desde Cero</h2>
          <p className="text-gray-400 mb-6">Diseña un agente personalizado con su propia personalidad y conocimiento específico de tu negocio.</p>
          <Button variant="secondary">Crear Agente</Button>
        </Link>
      </div>
    </div>
  );
};

export default Dashboard;