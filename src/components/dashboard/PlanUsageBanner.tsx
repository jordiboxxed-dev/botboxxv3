import { useUsage } from '@/hooks/useUsage';
import { Card, CardContent } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, Calendar, Bot, MessageSquare } from 'lucide-react';
import { Button } from '../ui/button';

export const PlanUsageBanner = () => {
  const { usageInfo, isLoading } = useUsage();

  if (isLoading) {
    return <Skeleton className="h-36 w-full max-w-4xl" />;
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

  const messagePercentage = (messagesSent / messageLimit) * 100;
  const agentPercentage = (agentsCreated / agentLimit) * 100;

  return (
    <Card className="bg-black/30 border-white/10 text-white w-full max-w-4xl">
      <CardContent className="p-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h3 className="text-xl font-bold capitalize">Plan {plan}</h3>
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
          <Button>Actualizar Plan</Button>
        </div>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-300 flex items-center gap-2"><Bot className="w-4 h-4" /> Agentes</span>
              <span>{agentsCreated} / {agentLimit}</span>
            </div>
            <Progress value={agentPercentage} className="h-2" />
          </div>
          <div>
            <div className="flex justify-between items-center mb-2 text-sm">
              <span className="text-gray-300 flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Mensajes</span>
              <span>{messagesSent} / {messageLimit}</span>
            </div>
            <Progress value={messagePercentage} className="h-2" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
};