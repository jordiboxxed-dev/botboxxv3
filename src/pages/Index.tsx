import { AppLayout } from "@/components/layout/AppLayout";
import { SkeletonLoader } from "@/components/layout/SkeletonLoader";
import { useState, useEffect } from "react";

const Index = () => {
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simula la carga de datos
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 1500); // 1.5 segundos de carga simulada

    return () => clearTimeout(timer);
  }, []);

  return isLoading ? <SkeletonLoader /> : <AppLayout />;
};

export default Index;