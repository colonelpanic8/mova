import React, { useState } from "react";
import { View, TextInput, Button, Alert, StyleSheet } from "react-native";
import { useAuth } from "@/context/authContext";
import { ThemedText } from "@/components/ThemedText";
import { ThemedView } from "@/components/ThemedView";

const CaptureScreen: React.FC = () => {
	// Pull URL, username, and password from context
	const { url, username, password } = useAuth();

	// Local state for the input title
	const [title, setTitle] = useState("");

	const handleCreateTodo = async () => {
		// If no URL, username, or password is configured, let the user know
		if (!url || !username || !password) {
			Alert.alert(
				"Error",
				"No URL or username/password configured in settings.",
			);
			return;
		}

		try {
			// Encode username/password into Base64 for Basic Auth
			const token = btoa(`${username}:${password}`);

			// POST request to your "create-todo" route, with Basic Auth
			const response = await fetch(`${url}/create-todo`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${token}`,
				},
				body: JSON.stringify({
					title: title,
				}),
			});

			if (!response.ok) {
				throw new Error(`Request failed with status ${response.status}`);
			}

			const data = await response.json();
			Alert.alert("Success", "Todo created successfully!");
			setTitle("");
		} catch (error: any) {
			Alert.alert("Error", error.message);
		}
	};

	return (
		<ThemedView style={styles.container}>
			<TextInput
				style={styles.input}
				placeholder="Heading"
				value={title}
				onChangeText={setTitle}
			/>
			<Button title="Create Todo" onPress={handleCreateTodo} />
		</ThemedView>
	);
};

export default CaptureScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
		justifyContent: "center",
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
