import { Skeleton } from "@/components/ui/skeleton";
import { motion } from "framer-motion";

export const SkeletonLoader = () => {
  return (
    <motion.div
      initial={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.5 }}
      className="flex w-full min-h-screen"
    >
      {/* Skeleton Sidebar */}
      <div className="w-80 h-screen p-4 flex flex-col bg-black/30 border-r border-white/10">
        <div className="flex items-center gap-3 mb-8">
          <Skeleton className="w-8 h-8 rounded-md" />
          <Skeleton className="h-8 w-40" />
        </div>
        <div className="flex-1 flex flex-col gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="w-12 h-12 rounded-md" />
              <div className="space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-4 w-48" />
              </div>
            </div>
          ))}
        </div>
        <div className="mt-auto flex items-center gap-3">
          <Skeleton className="w-6 h-6 rounded-full" />
          <Skeleton className="h-6 w-32" />
        </div>
      </div>

      {/* Skeleton Main Content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <Skeleton className="w-24 h-24 rounded-full mb-4" />
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-80" />
      </div>
    </motion.div>
  );
};