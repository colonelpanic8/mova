import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useMemo,
  useState,
} from "react";
import { Snackbar, useTheme } from "react-native-paper";

export interface SnackbarState {
  visible: boolean;
  message: string;
  isError: boolean;
}

interface SnackbarContextValue {
  snackbar: SnackbarState;
  showSnackbar: (message: string, options?: { isError?: boolean }) => void;
  dismissSnackbar: () => void;
}

const SnackbarContext = createContext<SnackbarContextValue | null>(null);

export function useSnackbar(): SnackbarContextValue {
  const context = useContext(SnackbarContext);
  if (!context) {
    throw new Error("useSnackbar must be used within a SnackbarProvider");
  }
  return context;
}

export function SnackbarProvider({ children }: { children: ReactNode }) {
  const [snackbar, setSnackbar] = useState<SnackbarState>({
    visible: false,
    message: "",
    isError: false,
  });

  const showSnackbar = useCallback(
    (message: string, options?: { isError?: boolean }) => {
      setSnackbar({
        visible: true,
        message,
        isError: options?.isError ?? false,
      });
    },
    [],
  );

  const dismissSnackbar = useCallback(() => {
    setSnackbar((prev) => ({ ...prev, visible: false }));
  }, []);

  const value = useMemo(
    () => ({ snackbar, showSnackbar, dismissSnackbar }),
    [snackbar, showSnackbar, dismissSnackbar],
  );

  return (
    <SnackbarContext.Provider value={value}>
      {children}
    </SnackbarContext.Provider>
  );
}

/**
 * Renders the app-wide snackbar. Place it near the bottom of a screen's tree
 * so it appears at the bottom of that screen (e.g. above the tab bar).
 */
export function AppSnackbar() {
  const theme = useTheme();
  const { snackbar, dismissSnackbar } = useSnackbar();

  return (
    <Snackbar
      visible={snackbar.visible}
      onDismiss={dismissSnackbar}
      duration={2000}
      style={
        snackbar.isError ? { backgroundColor: theme.colors.error } : undefined
      }
      testID={snackbar.isError ? "errorSnackbar" : "successSnackbar"}
    >
      {snackbar.message}
    </Snackbar>
  );
}
