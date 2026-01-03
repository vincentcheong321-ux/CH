import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

interface GlobalStateContextType {
  currentDate: Date;
  setCurrentDate: (date: Date) => void;
}

const GlobalStateContext = createContext<GlobalStateContextType | undefined>(undefined);

export const GlobalStateProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize with today's date
  const [currentDate, setCurrentDate] = useState<Date>(() => {
      const now = new Date();
      // Ensure we start with a clean date (no time) to avoid mismatches
      return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  });

  return (
    <GlobalStateContext.Provider value={{ currentDate, setCurrentDate }}>
      {children}
    </GlobalStateContext.Provider>
  );
};

export const useGlobalState = () => {
  const context = useContext(GlobalStateContext);
  if (!context) {
    throw new Error('useGlobalState must be used within a GlobalStateProvider');
  }
  return context;
};
