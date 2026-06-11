import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  useFonts,
  Nunito_700Bold,
  Nunito_400Regular,
  Nunito_600SemiBold,
  Nunito_800ExtraBold,
} from "@expo-google-fonts/nunito";
import { PaystackProvider } from "react-native-paystack-webview";

// Live public key from environment variables
const PAYSTACK_PUBLIC_KEY = process.env.EXPO_PUBLIC_PAYSTACK_PUBLIC_KEY || "";

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Nunito_700Bold,
    Nunito_400Regular,
    Nunito_600SemiBold,
    Nunito_800ExtraBold,
  });

  if (!fontsLoaded) return null;

  return (
    <PaystackProvider publicKey={PAYSTACK_PUBLIC_KEY} currency="GHS" defaultChannels={["mobile_money"]}>
      <StatusBar hidden />
      <Stack screenOptions={{ headerShown: false }} />
    </PaystackProvider>
  );
}
