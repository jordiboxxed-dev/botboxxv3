import { useParams } from "react-router-dom";

const Embed = () => {
  const { agentId } = useParams();

  // Nota: El estilo es temporal. Eventualmente, este será un widget flotante.
  return (
    <div className="w-screen h-screen bg-transparent flex items-center justify-center p-4">
      <div className="p-6 bg-white rounded-xl shadow-2xl border border-gray-200">
        <h1 className="text-xl font-bold text-gray-800">Chat Widget Placeholder</h1>
        <p className="text-gray-600 mt-2">
          Este es el contenedor para el agente con ID:
        </p>
        <p className="text-sm text-blue-600 font-mono bg-blue-50 p-2 rounded-md mt-1">
          {agentId}
        </p>
        <p className="text-xs text-gray-400 mt-4">
          En los próximos pasos, construiremos aquí el chat real.
        </p>
      </div>
    </div>
  );
};

export default Embed;