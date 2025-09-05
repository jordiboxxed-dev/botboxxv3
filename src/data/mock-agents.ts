export interface Agent {
  id: string;
  name: string;
  description: string;
  avatar: string;
}

export const mockAgents: Agent[] = [
  {
    id: "1",
    name: "Asistente de Ventas",
    description: "Experto en cierres y seguimiento",
    avatar: "briefcase",
  },
  {
    id: "2",
    name: "Soporte Técnico",
    description: "Resolución de problemas técnicos",
    avatar: "wrench",
  },
  {
    id: "3",
    name: "Guía Turístico",
    description: "Recomendaciones de viajes y cultura",
    avatar: "map",
  },
  {
    id: "4",
    name: "Entrenador Personal",
    description: "Rutinas de ejercicio y nutrición",
    avatar: "heart-pulse",
  },
];