import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Linking,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Moon, Sun, Phone } from "lucide-react-native";
import auth from "@react-native-firebase/auth";
import { useAuthStore } from "../../store/authstore";
import { useColorScheme } from "nativewind";

const PhoneScreen = () => {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [phone, setPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const setConfirmation = useAuthStore((state) => state.setConfirmation);

  const formatPhone = (text: string) => {
    // strip non-numeric
    const cleaned = text.replace(/[^0-9]/g, "");
    setPhone(cleaned);
    setError("");
  };

  const getFullNumber = () =>
    `+233${phone.startsWith("0") ? phone.slice(1) : phone}`;

  const handleSendOTP = async () => {
    if (phone.length < 9) {
      setError("Enter a valid Ghana phone number");
      return;
    }

    setLoading(true);

    try {
      const confirmation = await auth().signInWithPhoneNumber(getFullNumber());
      setConfirmation(confirmation, getFullNumber());
      router.push({
        pathname: "/(auth)/verify",
        params: { phone: getFullNumber() },
      });
    } catch (err) {
      console.error(err);
      setError("Failed to send code. Try again.");
    } finally {
      setLoading(false);
    }
  };

  const isValid = phone.length >= 9;

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f0f7f4] dark:bg-brand-darkBg"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-12 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-12">
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-white dark:bg-brand-darkCard items-center justify-center"
            onPress={() => router.back()}
          >
            <ArrowLeft color={colorScheme === "dark" ? "#a3bdae" : "#0d5c45"} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-white dark:bg-brand-darkCard items-center justify-center"
            onPress={toggleColorScheme}
          >
            {colorScheme === "dark" ? (
              <Sun color="#F5A623" size={20} />
            ) : (
              <Moon color="#0d5c45" size={20} />
            )}
          </TouchableOpacity>
        </View>

        {/* Icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950/40 items-center justify-center">
            <View className="w-16 h-16 rounded-full bg-[#0d5c45] dark:bg-brand-greenLight items-center justify-center">
              <Phone color="white" size={28} />
            </View>
          </View>
        </View>

        {/* Heading */}
        <View className="items-center mb-10">
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
            className="text-gray-800 dark:text-brand-darkTextHigh text-center"
          >
            What's your number?
          </Text>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
            className="text-emerald-600 dark:text-brand-darkTextMed text-center mt-2 w-72"
          >
            We'll send a one-time code to verify it's really you.
          </Text>
        </View>

        {/* Phone input */}
        <View className="mb-2">
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
            className="text-gray-700 dark:text-brand-darkTextMed mb-2"
          >
            Phone number
          </Text>
          <View
            className={`bg-white dark:bg-brand-darkInput rounded-2xl flex-row items-center px-4 border-2 
              ${error ? "border-red-400" : "border-transparent dark:border-brand-darkBorder"}
            `}
          >
            {/* Ghana flag + code */}
            <View className="flex-row items-center gap-2 pr-3 border-r border-gray-200 dark:border-brand-darkBorder py-4">
              <Text className="text-xl">🇬🇭</Text>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
                className="text-gray-700 dark:text-brand-darkTextHigh"
              >
                +233
              </Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={formatPhone}
              placeholder="24 123 4567"
              placeholderTextColor={colorScheme === "dark" ? "#7ba08d" : "#9CA3AF"}
              keyboardType="phone-pad"
              maxLength={10}
              style={{
                fontFamily: "Nunito_400Regular",
                fontSize: 16,
                flex: 1,
                paddingLeft: 12,
                paddingVertical: 16,
              }}
              className="text-gray-800 dark:text-brand-darkTextHigh"
            />
          </View>
          {error ? (
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
              className="text-red-400 mt-2 ml-1"
            >
              {error}
            </Text>
          ) : null}
        </View>

        <Text
          style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
          className="text-gray-400 dark:text-brand-darkTextLow mb-10 ml-1"
        >
          Format: 024 123 4567 or 054 123 4567
        </Text>

        {/* Send OTP button */}
        <TouchableOpacity
          onPress={handleSendOTP}
          disabled={!isValid || loading}
          className={`rounded-full py-4 items-center justify-center
            ${isValid && !loading ? "bg-[#0d5c45] dark:bg-brand-greenLight" : "bg-[#0d5c45]/40 dark:bg-brand-greenLight/30"}
          `}
        >
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
            className="text-white"
          >
            {loading ? "Sending..." : "Send code"}
          </Text>
        </TouchableOpacity>

        {/* Terms & Privacy — placeholder links */}
        <Text
          style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
          className="text-gray-400 dark:text-brand-darkTextLow text-center mt-6"
        >
          By continuing, you agree to our{" "}
          <Text
            onPress={() => Linking.openURL("https://doc-hosting.flycricket.io/poolup-terms-of-use/400d4e97-5f84-43bf-a077-63c00a446aa3/terms")}
            className="text-[#0d5c45] dark:text-[#34d399]"
          >
            Terms of Service
          </Text>
          {" "}and{" "}
          <Text
            onPress={() => Linking.openURL("https://doc-hosting.flycricket.io/poolup-privacy-policy/151ebb89-948f-4af2-ae6c-a7d72560b677/privacy")}
            className="text-[#0d5c45] dark:text-[#34d399]"
          >
            Privacy Policy
          </Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

export default PhoneScreen;
