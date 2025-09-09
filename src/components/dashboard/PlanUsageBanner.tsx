import { useUsage } from '@/hooks/useUsage';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Calendar, Bot, MessageSquare, ShieldCheck, CreditCard } from 'lucide-react';
import { Button } from '../ui/button';
import { Link } from 'react-router-dom';

export const PlanUsageBanner = () => {
  const { usageInfo, isLoading } = useUsage();

  if (isLoading) {
    return <Skeleton className="h-40 w-full max-w-4xl" />;
  }

  if (!usageInfo) {
    return null;
  }

  const {
    plan,
    trialDaysLeft,
    messagesSent,
    messageLimit,
    agentsCreated,
    agentLimit,
    isTrialActive,
  } = usageInfo;

  if (plan === 'admin') {
    return (
      <Card className="bg-black/30 border-blue-400/50 text-white w-full max-w-4xl">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold capitalize flex items-center gap-2">
                <ShieldCheck className="w-6 h-6 text-blue-400" />
                Plan Administrador
              </h3>
              <p className="text-sm text-gray-400 mt-1">
                Tienes acceso ilimitado a todas las funcionalidades para pruebas.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const messagePercentage = (messagesSent / messageLimit) * 100;
  const agentPercentage = (agentsCreated / agentLimit) * 100;

  return (
    <Card className="bg-black/30 border-white/10 text-white w-full max-w-4xl">
      <CardHeader>
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <CardTitle className="text-xl font-bold capitalize">Plan {plan}</CardTitle>
            {isTrialActive && trialDaysLeft !== null ? (
              <p className="text-sm text-gray-400 flex items-center gap-2 mt-1">
                <Calendar className="w-4 h-4" />
                Te quedan {trialDaysLeft} {trialDaysLeft === 1 ? 'día' : 'días'} de prueba.
              </p>
            ) : (
              <p className="text-sm text-yellow-400 flex items-center gap-2 mt-1">
                <AlertCircle className="w-4 h-4" />
                Tu período de prueba ha finalizado.
              </p>
            )}
          </div>
          <Button asChild>
            <Link to="/billing" className="flex items-center gap-2">
              <CreditCard className="w-4 h-4" />
              Mejorar Plan
            </Link>
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-300 flex items-center gap-2 font-medium"><Bot className="w-4 h-4" /> Uso de Agentes</span>
              <span className="font-semibold">{agentsCreated} / {agentLimit}</span>
            </div>
            <Progress value={agentPercentage} className="h-2" />
          </div>
          <div className="bg-black/20 p-4 rounded-lg">
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-300 flex items-center gap-2 font-medium"><MessageSquare className="w-4 h-4" /> Mensajes (este mes)</span>
              <span className="font-semibold">{messagesSent} / {messageLimit}</span>
            </div>
            <Progress value={messagePercentage} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};