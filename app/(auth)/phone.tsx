import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Moon, Phone } from "lucide-react-native";
import auth from "@react-native-firebase/auth";
import { useAuthStore } from "../../store/authstore";

const PhoneScreen = () => {
  const router = useRouter();
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
      className="flex-1 bg-[#f0f7f4]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-12 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-12">
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-white items-center justify-center"
            onPress={() => router.back()}
          >
            <ArrowLeft color="#0d5c45" size={20} />
          </TouchableOpacity>
          {/* TODO: wire up dark mode */}
          <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center">
            <Moon color="#0d5c45" size={20} />
          </TouchableOpacity>
        </View>

        {/* Icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-emerald-100 items-center justify-center">
            <View className="w-16 h-16 rounded-full bg-[#0d5c45] items-center justify-center">
              <Phone color="white" size={28} />
            </View>
          </View>
        </View>

        {/* Heading */}
        <View className="items-center mb-10">
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
            className="text-gray-800 text-center"
          >
            What's your number?
          </Text>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
            className="text-emerald-600 text-center mt-2 w-72"
          >
            We'll send a one-time code to verify it's really you.
          </Text>
        </View>

        {/* Phone input */}
        <View className="mb-2">
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
            className="text-gray-700 mb-2"
          >
            Phone number
          </Text>
          <View
            className={`bg-white rounded-2xl flex-row items-center px-4 
              ${error ? "border-2 border-red-400" : "border-2 border-transparent"}
            `}
          >
            {/* Ghana flag + code */}
            <View className="flex-row items-center gap-2 pr-3 border-r border-gray-200 py-4">
              <Text className="text-xl">🇬🇭</Text>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
                className="text-gray-700"
              >
                +233
              </Text>
            </View>
            <TextInput
              value={phone}
              onChangeText={formatPhone}
              placeholder="24 123 4567"
              placeholderTextColor="#9CA3AF"
              keyboardType="phone-pad"
              maxLength={10}
              style={{
                fontFamily: "Nunito_400Regular",
                fontSize: 16,
                flex: 1,
                paddingLeft: 12,
                paddingVertical: 16,
              }}
              className="text-gray-800"
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
          className="text-gray-400 mb-10 ml-1"
        >
          Format: 024 123 4567 or 054 123 4567
        </Text>

        {/* Send OTP button */}
        <TouchableOpacity
          onPress={handleSendOTP}
          disabled={!isValid || loading}
          className={`rounded-full py-4 items-center justify-center
            ${isValid && !loading ? "bg-[#0d5c45]" : "bg-[#0d5c45]/40"}
          `}
        >
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
            className="text-white"
          >
            {loading ? "Sending..." : "Send code"}
          </Text>
        </TouchableOpacity>

        {/* Terms */}
        <Text
          style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
          className="text-gray-400 text-center mt-6"
        >
          By continuing you agree to our{" "}
          <Text className="text-[#0d5c45]">Terms of Service</Text> and{" "}
          <Text className="text-[#0d5c45]">Privacy Policy</Text>
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
};

export default PhoneScreen;
