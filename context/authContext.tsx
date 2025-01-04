import React, { createContext, useState, useContext } from "react";
import type { Dispatch, SetStateAction } from "react";

interface AuthContextType {
  authToken: string | undefined;
  setAuthToken: Dispatch<SetStateAction<string | undefined>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [authToken, setAuthToken] = useState<string | undefined>(undefined);

  return (
    <AuthContext.Provider value={{ authToken, setAuthToken }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
