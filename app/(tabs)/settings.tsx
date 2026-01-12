import React from 'react';
import { View, StyleSheet, ScrollView } from 'react-native';
import { Text, Button, List, Divider, useTheme } from 'react-native-paper';
import { useAuth } from '@/context/AuthContext';

export default function SettingsScreen() {
  const { apiUrl, username, logout } = useAuth();
  const theme = useTheme();

  return (
    <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <List.Section>
        <List.Subheader>Connection</List.Subheader>
        <List.Item
          title="Server URL"
          description={apiUrl || 'Not connected'}
          left={props => <List.Icon {...props} icon="server" />}
        />
        <List.Item
          title="Username"
          description={username || 'Not logged in'}
          left={props => <List.Icon {...props} icon="account" />}
        />
      </List.Section>

      <Divider />

      <View style={styles.buttonContainer}>
        <Button
          mode="outlined"
          onPress={logout}
          icon="logout"
          textColor={theme.colors.error}
          style={styles.logoutButton}
        >
          Disconnect
        </Button>
      </View>

      <List.Section>
        <List.Subheader>About</List.Subheader>
        <List.Item
          title="Mova"
          description="Mobile client for org-agenda-api"
          left={props => <List.Icon {...props} icon="information" />}
        />
      </List.Section>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  buttonContainer: {
    padding: 16,
  },
  logoutButton: {
    borderColor: 'transparent',
  },
});
