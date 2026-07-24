import { Todo } from "@/services/api";
import { Button, Dialog, Portal, Text, useTheme } from "react-native-paper";

export interface DeleteConfirmDialogProps {
  /** The todo pending deletion; the dialog is hidden when null. */
  todo: Todo | null;
  onDismiss: () => void;
  onConfirm: (todo: Todo) => void;
}

export function DeleteConfirmDialog({
  todo,
  onDismiss,
  onConfirm,
}: DeleteConfirmDialogProps) {
  const theme = useTheme();

  return (
    <Portal>
      <Dialog visible={!!todo} onDismiss={onDismiss}>
        <Dialog.Title>Delete Todo?</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">{todo?.title}</Text>
        </Dialog.Content>
        <Dialog.Actions>
          <Button onPress={onDismiss}>Cancel</Button>
          <Button
            onPress={() => todo && onConfirm(todo)}
            textColor={theme.colors.error}
          >
            Delete
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}
