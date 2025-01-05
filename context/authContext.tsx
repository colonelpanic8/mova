import React, { createContext, useState, useContext, useEffect } from "react";
import type { Dispatch, SetStateAction } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

interface AuthContextType {
  url: string | undefined;
  setUrl: Dispatch<SetStateAction<string | undefined>>;
  username: string | undefined;
  setUsername: Dispatch<SetStateAction<string | undefined>>;
  password: string | undefined;
  setPassword: Dispatch<SetStateAction<string | undefined>>;
}

export const AuthContext = createContext<AuthContextType | undefined>(
  undefined,
);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [url, setUrl] = useState<string | undefined>(undefined);
  const [username, setUsername] = useState<string | undefined>(undefined);
  const [password, setPassword] = useState<string | undefined>(undefined);

  // Load saved credentials from AsyncStorage on component mount
  useEffect(() => {
    const loadData = async () => {
      try {
        const savedUrl = await AsyncStorage.getItem("@myApp:url");
        const savedUsername = await AsyncStorage.getItem("@myApp:username");
        const savedPassword = await AsyncStorage.getItem("@myApp:password");

        if (savedUrl) setUrl(savedUrl);
        if (savedUsername) setUsername(savedUsername);
        if (savedPassword) setPassword(savedPassword);
      } catch (error) {
        console.log("Error loading data from AsyncStorage:", error);
      }
    };

    loadData();
  }, []);

  // Whenever url, username, or password change, save to AsyncStorage
  useEffect(() => {
    const saveData = async () => {
      try {
        if (url !== undefined) {
          await AsyncStorage.setItem("@myApp:url", url);
        }
        if (username !== undefined) {
          await AsyncStorage.setItem("@myApp:username", username);
        }
        if (password !== undefined) {
          await AsyncStorage.setItem("@myApp:password", password);
        }
      } catch (error) {
        console.log("Error saving data to AsyncStorage:", error);
      }
    };

    saveData();
  }, [url, username, password]);

  return (
    <AuthContext.Provider
      value={{
        url,
        setUrl,
        username,
        setUsername,
        password,
        setPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the AuthContext
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
