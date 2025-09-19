import { ClientList } from "@/components/agency/ClientList";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";

const AgencyDashboard = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-gray-900 p-4 md:p-8 text-white">
            <div className="max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: -20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between mb-8"
                >
                    <div>
                        <h1 className="text-3xl font-bold">Panel de Agencia</h1>
                        <p className="text-gray-400">Gestiona tus clientes y sus agentes.</p>
                    </div>
                    <Button variant="outline" onClick={() => navigate('/dashboard')} className="text-white border-white/30 hover:bg-white/10">
                        <ArrowLeft className="w-4 h-4 mr-2" />
                        Volver al Dashboard
                    </Button>
                </motion.div>
                
                <ClientList />
            </div>
        </div>
    );
}

export default AgencyDashboard;