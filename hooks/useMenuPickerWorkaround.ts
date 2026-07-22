import { useCallback, useState } from "react";

/**
 * Visibility state for a react-native-paper Menu whose item selection updates
 * state that re-renders the anchor. `select` closes the menu first and defers
 * the action until after the close has been committed; without this, Android
 * menus won't reopen after a selection.
 */
export function useMenuPickerWorkaround() {
  const [visible, setVisible] = useState(false);
  const open = useCallback(() => setVisible(true), []);
  const close = useCallback(() => setVisible(false), []);
  const select = useCallback((action: () => void) => {
    setVisible(false);
    setTimeout(action, 0);
  }, []);
  return { visible, open, close, select };
}
