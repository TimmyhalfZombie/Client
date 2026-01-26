import React from 'react';

type Ctx = {
  activityHasNew: boolean;
  markActivityNew: () => void;
  clearActivityNew: () => void;
};

const ActivityBadgeContext = React.createContext<Ctx | null>(null);

export function ActivityBadgeProvider({ children }: { children: React.ReactNode }) {
  const [activityHasNew, setActivityHasNew] = React.useState(false);
  const markActivityNew = () => setActivityHasNew(true);
  const clearActivityNew = () => setActivityHasNew(false);

  return (
    <ActivityBadgeContext.Provider value={{ activityHasNew, markActivityNew, clearActivityNew }}>
      {children}
    </ActivityBadgeContext.Provider>
  );
}

export function useActivityBadge() {
  const ctx = React.useContext(ActivityBadgeContext);
  if (!ctx) throw new Error('useActivityBadge must be used within ActivityBadgeProvider');
  return ctx;
}
