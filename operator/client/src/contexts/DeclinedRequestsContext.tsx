import React, { createContext, ReactNode, useContext, useState } from 'react';

interface DeclinedRequestsContextType {
  declinedIds: Set<string>;
  markAsDeclined: (id: string) => void;
}

const DeclinedRequestsContext = createContext<DeclinedRequestsContextType | undefined>(undefined);

export function DeclinedRequestsProvider({ children }: { children: ReactNode }) {
  const [declinedIds, setDeclinedIds] = useState<Set<string>>(new Set());

  const markAsDeclined = (id: string) => {
    setDeclinedIds(prev => new Set([...prev, id]));
  };

  return (
    <DeclinedRequestsContext.Provider value={{ declinedIds, markAsDeclined }}>
      {children}
    </DeclinedRequestsContext.Provider>
  );
}

export function useDeclinedRequests() {
  const context = useContext(DeclinedRequestsContext);
  if (context === undefined) {
    throw new Error('useDeclinedRequests must be used within a DeclinedRequestsProvider');
  }
  return context;
}
