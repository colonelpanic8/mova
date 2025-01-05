import React from "react";
import { View, Text, TextInput, StyleSheet, Button } from "react-native";
import { useAuth } from "@/context/authContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

const SettingsScreen: React.FC = () => {
	const { url, setUrl, username, setUsername, password, setPassword } =
		useAuth();

	return (
		<ThemedView style={styles.container}>
			<ThemedText style={styles.label}>URL</ThemedText>
			<TextInput
				style={styles.input}
				placeholder="Enter URL"
				value={url}
				onChangeText={setUrl}
				autoCapitalize="none"
			/>

			<ThemedText style={styles.label}>Username</ThemedText>
			<TextInput
				style={styles.input}
				placeholder="Enter username"
				value={username}
				onChangeText={setUsername}
				autoCapitalize="none"
			/>

			<ThemedText style={styles.label}>Password</ThemedText>
			<TextInput
				style={styles.input}
				placeholder="Enter password"
				value={password}
				onChangeText={setPassword}
				secureTextEntry
			/>
		</ThemedView>
	);
};

export default SettingsScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
		justifyContent: "flex-start",
	},
	label: {
		fontSize: 16,
		fontWeight: "600",
		marginVertical: 8,
	},
	input: {
		borderWidth: 1,
		borderColor: "#ccc",
		borderRadius: 4,
		paddingHorizontal: 8,
		paddingVertical: 6,
		marginBottom: 16,
		backgroundColor: "#ffffff",
	},
});
