import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight, BarChart2 } from "lucide-react";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";
import React from "react";

export const UpgradeToProBanner = () => {
  const cardProps = useInteractiveCard<HTMLDivElement>({ glowColor: "rgba(139, 92, 246, 0.4)" });

  return (
    <div className="w-full max-w-4xl mt-8">
      <Card
        ref={cardProps.ref}
        {...cardProps}
        className={cn(
          cardProps.className,
          "bg-gradient-to-br from-blue-900/50 to-purple-900/50 border-blue-500/30 p-6 text-center"
        )}
      >
        <CardHeader className="p-0 mb-4">
          <BarChart2 className="mx-auto h-12 w-12 text-blue-300 mb-4" />
          <CardTitle className="text-2xl font-bold text-white">
            Desbloquea el Panel de ROI y Analíticas
          </CardTitle>
          <CardDescription className="text-blue-200 max-w-2xl mx-auto mt-2">
            Obtén una visión clara del valor que tus agentes están generando. Mide el tiempo ahorrado, los costos reducidos y la tasa de resolución autónoma para tomar decisiones basadas en datos.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Button asChild size="lg" className="bg-white text-blue-700 hover:bg-gray-200 font-bold">
            <Link to="/billing">
              Mejorar a Pro
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};