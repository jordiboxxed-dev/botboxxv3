import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useInteractiveCard } from "@/hooks/useInteractiveCard";
import { cn } from "@/lib/utils";

interface ChartData {
  date: string;
  conversations: number;
  conversions: number;
}

interface AnalyticsChartProps {
  data: ChartData[];
}

export const AnalyticsChart = ({ data }: AnalyticsChartProps) => {
  const cardProps = useInteractiveCard<HTMLDivElement>({ glowColor: "rgba(59, 130, 246, 0.2)" });
  const formatDate = (tickItem: string) => {
    // Parse the date string as UTC to avoid timezone issues
    const date = new Date(tickItem + 'T00:00:00Z');
    return format(date, "d MMM", { locale: es });
  };

  return (
    <Card
      ref={cardProps.ref}
      {...cardProps}
      className={cn(cardProps.className, "bg-black/30 border-white/10 text-white mt-6")}
    >
      <CardHeader>
        <CardTitle>Actividad en los últimos 30 días</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255, 255, 255, 0.1)" />
              <XAxis dataKey="date" tickFormatter={formatDate} stroke="rgba(255, 255, 255, 0.5)" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis allowDecimals={false} stroke="rgba(255, 255, 255, 0.5)" fontSize={12} tickLine={false} axisLine={false} />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(20, 20, 20, 0.9)',
                  borderColor: 'rgba(255, 255, 255, 0.2)',
                  borderRadius: '0.5rem',
                }}
                labelStyle={{ color: '#fff', fontWeight: 'bold' }}
                itemStyle={{ fontWeight: 'normal' }}
                labelFormatter={(label) => formatDate(label)}
              />
              <Legend wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }} />
              <Line type="monotone" dataKey="conversations" name="Conversaciones" stroke="#3b82f6" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 6 }} />
              <Line type="monotone" dataKey="conversions" name="Conversiones" stroke="#10b981" strokeWidth={2} dot={{ r: 2 }} activeDot={{ r: 6 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
};