import { useState } from "react";
import { Sidebar } from "./Sidebar";
import { MainContent } from "./MainContent";
import { Agent } from "@/data/mock-agents";

export const AppLayout = () => {
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);

  return (
    <div className="flex w-full min-h-screen">
      <Sidebar onAgentSelect={setSelectedAgent} />
      <MainContent selectedAgent={selectedAgent} />
    </div>
  );
};