import { Navigate } from 'react-router-dom';
import { SkeletonLoader } from '@/components/layout/SkeletonLoader';
import { useUsage } from '@/hooks/useUsage';

interface AgencyProtectedRouteProps {
  children: React.ReactNode;
}

const AgencyProtectedRoute = ({ children }: AgencyProtectedRouteProps) => {
  const { usageInfo, isLoading } = useUsage();

  if (isLoading) {
    return <SkeletonLoader />;
  }

  if (!usageInfo || (usageInfo.role !== 'agency_owner' && usageInfo.role !== 'admin')) {
    return <Navigate to="/dashboard" />;
  }

  return <>{children}</>;
};

export default AgencyProtectedRoute;