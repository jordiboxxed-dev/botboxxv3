import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./integrations/supabase/client";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateAgent from "./pages/CreateAgent";
import EditAgent from "./pages/EditAgent";
import { AppLayout } from "./components/layout/AppLayout";
import Embed from "./pages/Embed";

const queryClient = new QueryClient();

const App = () => {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div className="min-h-screen w-full bg-gray-900" />;
  }

  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Publicly accessible embed route */}
            <Route path="/embed/agent/:agentId" element={<Embed />} />

            {!session ? (
              <Route path="*" element={<Login />} />
            ) : (
              <>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/create-agent" element={<CreateAgent />} />
                <Route path="/agent/:agentId" element={<AppLayout />} />
                <Route path="/agent/:agentId/edit" element={<EditAgent />} />
                <Route path="*" element={<NotFound />} />
              </>
            )}
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;