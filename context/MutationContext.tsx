import React, {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useState,
} from "react";

interface MutationContextType {
  mutationVersion: number;
  triggerRefresh: () => void;
}

const MutationContext = createContext<MutationContextType | undefined>(
  undefined,
);

export function MutationProvider({ children }: { children: ReactNode }) {
  const [mutationVersion, setMutationVersion] = useState(0);

  const triggerRefresh = useCallback(() => {
    setMutationVersion((v) => v + 1);
  }, []);

  return (
    <MutationContext.Provider value={{ mutationVersion, triggerRefresh }}>
      {children}
    </MutationContext.Provider>
  );
}

export function useMutation(): MutationContextType {
  const context = useContext(MutationContext);
  if (context === undefined) {
    throw new Error("useMutation must be used within a MutationProvider");
  }
  return context;
}
