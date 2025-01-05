import React, { useState, useContext } from "react";
import { View, Text, TextInput, Button, Alert, StyleSheet } from "react-native";
import { AuthContext, useAuth } from "../context/authContext";
import { NativeStackScreenProps } from "@react-navigation/native-stack";

const encodeCredentials = (username: string, password: string): string => {
	return btoa(`${username}:${password}`);
};

export const LoginScreen: React.FC = ({ navigation }) => {
	const [url, setUrl] = useState<string>("");
	const [username, setUsername] = useState<string>("");
	const [password, setPassword] = useState<string>("");

	const { setAuthToken } = useAuth();

	const handleLogin = async () => {
		if (!url || !username || !password) {
			Alert.alert("Error", "All fields are required.");
			return;
		}

		try {
			const token = encodeCredentials(username, password);

			const response = await fetch(url, {
				method: "GET", // or 'POST' or whatever your endpoint requires
				headers: {
					"Content-Type": "application/json",
					Authorization: `Basic ${token}`,
				},
			});

			console.log(`Got response ${response}`);

			if (response.ok) {
				// Store token in context
				setAuthToken(token);

				// Navigate to the 'Home' screen (defined in RootStackParamList)
				navigation.navigate("Home");
			} else {
				Alert.alert("Error", "Invalid credentials or URL.");
			}
		} catch (error) {
			Alert.alert("Error", "Something went wrong. Please try again.");
			console.error(error);
		}
	};

	return (
		<View style={styles.container}>
			<Text style={styles.title}>Basic Auth Login</Text>
			<TextInput
				style={styles.input}
				placeholder="Server URL"
				autoCapitalize="none"
				onChangeText={setUrl}
				value={url}
			/>
			<TextInput
				style={styles.input}
				placeholder="Username"
				autoCapitalize="none"
				onChangeText={setUsername}
				value={username}
			/>
			<TextInput
				style={styles.input}
				placeholder="Password"
				secureTextEntry
				onChangeText={setPassword}
				value={password}
			/>
			<Button title="Login" onPress={handleLogin} />
		</View>
	);
};

export default LoginScreen;

const styles = StyleSheet.create({
	container: {
		flex: 1,
		padding: 16,
		justifyContent: "center",
	},
	title: {
		fontSize: 24,
		alignSelf: "center",
		marginBottom: 16,
	},
	input: {
		borderWidth: 1,
		borderColor: "#ccc",
		marginBottom: 12,
		padding: 10,
		borderRadius: 4,
	},
});
