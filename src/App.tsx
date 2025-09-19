import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Session } from "@supabase/supabase-js";
import { supabase } from "./integrations/supabase/client";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import CreateAgent from "./pages/CreateAgent";
import EditAgent from "./pages/EditAgent";
import { AppLayout } from "./components/layout/AppLayout";
import Embed from "./pages/Embed";
import AdminDashboard from "./pages/AdminDashboard";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import Templates from "./pages/Templates";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import Account from "./pages/Account";
import PublicAgentPage from "./pages/PublicAgentPage";
import Billing from "./pages/Billing";
import ScrollToTop from "./components/layout/ScrollToTop";
import AgencyDashboard from "./pages/AgencyDashboard";
import AgencyProtectedRoute from "./components/auth/AgencyProtectedRoute";
import AgencyClientDetail from "./pages/AgencyClientDetail";

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
          <ScrollToTop />
          <Routes>
            {/* Rutas públicas */}
            <Route path="/login" element={<Login />} />
            <Route path="/auth/callback" element={<AuthCallback />} />
            <Route path="/embed/agent/:agentId" element={<Embed />} />
            <Route path="/chat/:agentId" element={<PublicAgentPage />} />

            {!session ? (
              <>
                <Route path="/" element={<Navigate to="/login" />} />
                <Route path="*" element={<Login />} />
              </>
            ) : (
              <>
                <Route path="/" element={<Navigate to="/dashboard" />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/account" element={<Account />} />
                <Route path="/billing" element={<Billing />} />
                <Route path="/templates" element={<Templates />} />
                <Route path="/create-agent" element={<CreateAgent />} />
                <Route path="/agent/:agentId" element={<AppLayout />} />
                <Route path="/agent/:agentId/edit" element={<EditAgent />} />
                <Route 
                  path="/admin" 
                  element={
                    <ProtectedRoute>
                      <AdminDashboard />
                    </ProtectedRoute>
                  } 
                />
                <Route 
                  path="/agency" 
                  element={
                    <AgencyProtectedRoute>
                      <AgencyDashboard />
                    </AgencyProtectedRoute>
                  } 
                />
                <Route 
                  path="/agency/client/:clientId" 
                  element={
                    <AgencyProtectedRoute>
                      <AgencyClientDetail />
                    </AgencyProtectedRoute>
                  } 
                />
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