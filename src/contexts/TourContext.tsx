import { createContext, useContext, useState, ReactNode } from 'react';

interface TourContextType {
  isTourOpen: boolean;
  startTour: () => void;
  stopTour: () => void;
}

const TourContext = createContext<TourContextType | undefined>(undefined);

export const TourProvider = ({ children }: { children: ReactNode }) => {
  const [isTourOpen, setIsTourOpen] = useState(false);

  const startTour = () => {
    localStorage.removeItem('tourCompleted');
    setIsTourOpen(true);
  };

  const stopTour = () => {
    localStorage.setItem('tourCompleted', 'true');
    setIsTourOpen(false);
  };

  return (
    <TourContext.Provider value={{ isTourOpen, startTour, stopTour }}>
      {children}
    </TourContext.Provider>
  );
};

export const useTour = () => {
  const context = useContext(TourContext);
  if (context === undefined) {
    throw new Error('useTour must be used within a TourProvider');
  }
  return context;
};