import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Moon, User } from "lucide-react-native";
import auth from "@react-native-firebase/auth";
import { useAuthStore } from "../../store/authstore";

const RESEND_COUNTDOWN = 30;

const VerifyScreen = () => {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [countdown, setCountdown] = useState(RESEND_COUNTDOWN);
  const [canResend, setCanResend] = useState(false);

  // After OTP succeeds for a NEW user, we slide into a name-capture step
  // instead of routing immediately — so members always have real names in Firestore
  const [showNameStep, setShowNameStep] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [nameLoading, setNameLoading] = useState(false);
  const [nameError, setNameError] = useState("");

  const inputs = useRef<TextInput[]>([]);
  const shakeAnim = useRef(new Animated.Value(0)).current;

  const confirmation = useAuthStore((state) => state.confirmation);
  const clearConfirmation = useAuthStore((state) => state.clearConfirmation);
  const phone = useAuthStore((state) => state.phone);
  const setConfirmation = useAuthStore((state) => state.setConfirmation);

  // countdown timer — counts down from 30s then enables resend
  useEffect(() => {
    if (countdown === 0) {
      setCanResend(true);
      return;
    }
    const timer = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [countdown]);

  const shakeError = () => {
    Animated.sequence([
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: -10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 10, duration: 80, useNativeDriver: true }),
      Animated.timing(shakeAnim, { toValue: 0, duration: 80, useNativeDriver: true }),
    ]).start();
  };

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    setError("");

    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }

    // auto-verify when last digit is entered
    if (digit && index === 5) {
      const fullCode = [...newCode].join("");
      if (fullCode.length === 6) handleVerify(fullCode);
    }
  };

  const handleBackspace = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (fullCode?: string) => {
    const codeToVerify = fullCode || code.join("");
    if (codeToVerify.length < 6) return;

    if (!confirmation) {
      setError("Session expired. Please go back and try again.");
      return;
    }

    setLoading(true);
    setError("");

    try {
      const result = await confirmation.confirm(codeToVerify);
      clearConfirmation();

      const isNewUser = result?.additionalUserInfo?.isNewUser;

      if (isNewUser) {
        // New user — show the name step instead of routing immediately
        // This runs before any navigation so the user has a name
        // before their member doc gets written to Firestore
        setShowNameStep(true);
      } else {
        router.replace("/(home)/dashboard");
      }
    } catch (err) {
      console.error(err);
      setError("Wrong code. Try again.");
      shakeError();
      setCode(["", "", "", "", "", ""]);
      inputs.current[0]?.focus();
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (!canResend || !phone) return;

    setLoading(true);
    try {
      const newConfirmation = await auth().signInWithPhoneNumber(phone);
      setConfirmation(newConfirmation, phone);
      setCountdown(RESEND_COUNTDOWN);
      setCanResend(false);
      setCode(["", "", "", "", "", ""]);
      setError("");
      inputs.current[0]?.focus();
    } catch (err) {
      setError("Failed to resend. Try again.");
    } finally {
      setLoading(false);
    }
  };

  // Called after the user types their name and taps "Let's go"
  // updateProfile writes the name to the Firebase user object permanently
  // From this point on auth().currentUser.displayName will be their real name
  const handleSaveName = async () => {
    if (!displayName.trim()) {
      setNameError("Please enter your name");
      return;
    }

    setNameLoading(true);
    setNameError("");

    try {
      await auth().currentUser?.updateProfile({
        displayName: displayName.trim(),
      });
      // Now route them into the onboarding flow to create or join a group
      router.replace("/(onboarding)/getstarted");
    } catch (err) {
      console.error(err);
      setNameError("Could not save your name. Try again.");
    } finally {
      setNameLoading(false);
    }
  };

  const isComplete = code.every((d) => d !== "");

  // ── Name step ─────────────────────────────────────────────────────────────
  if (showNameStep) {
    return (
      <KeyboardAvoidingView
        className="flex-1 bg-[#f0f7f4]"
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View className="flex-1 px-6 pt-12 pb-10">
          {/* Header */}
          <View className="flex-row items-center justify-between mb-12">
            <View className="w-12 h-12" />
            <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center">
              <Moon color="#0d5c45" size={20} />
            </TouchableOpacity>
          </View>

          {/* Icon */}
          <View className="items-center mb-8">
            <View className="w-24 h-24 rounded-full bg-emerald-100 items-center justify-center">
              <View className="w-16 h-16 rounded-full bg-[#0d5c45] items-center justify-center">
                <User color="white" size={28} />
              </View>
            </View>
          </View>

          {/* Heading */}
          <View className="items-center mb-10">
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
              className="text-gray-800 text-center"
            >
              What should we call you?
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
              className="text-emerald-600 text-center mt-2 w-72"
            >
              Your group members will see this name.
            </Text>
          </View>

          {/* Name input */}
          <View className="mb-2">
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
              className="text-gray-700 mb-2"
            >
              Your name
            </Text>
            <TextInput
              value={displayName}
              onChangeText={(t) => { setDisplayName(t); setNameError(""); }}
              placeholder="e.g. Akosua Mensah"
              placeholderTextColor="#9CA3AF"
              autoFocus
              style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
              className={`bg-white rounded-2xl px-4 py-4 text-gray-800
                ${nameError ? "border-2 border-red-400" : "border-2 border-transparent"}
              `}
            />
            {nameError ? (
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
                className="text-red-400 mt-2 ml-1"
              >
                {nameError}
              </Text>
            ) : null}
          </View>

          <View className="flex-1" />

          {/* Continue button */}
          <TouchableOpacity
            onPress={handleSaveName}
            disabled={!displayName.trim() || nameLoading}
            className={`rounded-full py-4 items-center justify-center
              ${displayName.trim() && !nameLoading ? "bg-[#0d5c45]" : "bg-[#0d5c45]/40"}
            `}
          >
            {nameLoading ? (
              <ActivityIndicator color="white" />
            ) : (
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
                className="text-white"
              >
                Let's go 🚀
              </Text>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    );
  }

  // ── OTP step (default) ────────────────────────────────────────────────────
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
          <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center">
            <Moon color="#0d5c45" size={20} />
          </TouchableOpacity>
        </View>

        {/* Heading */}
        <View className="items-center mb-10">
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
            className="text-gray-800 text-center"
          >
            Enter the code
          </Text>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
            className="text-emerald-600 text-center mt-2 w-72"
          >
            We sent a 6-digit code to your number. It expires in 10 minutes.
          </Text>
        </View>

        {/* 6 digit boxes */}
        <Animated.View
          style={{ transform: [{ translateX: shakeAnim }] }}
          className="flex-row justify-between mb-4"
        >
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { if (ref) inputs.current[index] = ref; }}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) => handleBackspace(nativeEvent.key, index)}
              keyboardType="number-pad"
              maxLength={1}
              editable={!loading}
              style={{
                fontFamily: "Nunito_800ExtraBold",
                fontSize: 24,
                width: 52,
                height: 60,
                borderRadius: 16,
                textAlign: "center",
                backgroundColor: error ? "#fef2f2" : digit ? "white" : "#ecfdf5",
                borderWidth: 2,
                borderColor: error ? "#f87171" : digit ? "#0d5c45" : "#d1fae5",
                color: "#1f2937",
              }}
            />
          ))}
        </Animated.View>

        {/* Error message */}
        {error ? (
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-red-400 text-center mb-4"
          >
            {error}
          </Text>
        ) : (
          <View className="mb-4" />
        )}

        {/* Loading indicator */}
        {loading && (
          <View className="items-center mb-6">
            <ActivityIndicator color="#0d5c45" size="large" />
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-emerald-600 mt-2"
            >
              Verifying...
            </Text>
          </View>
        )}

        {/* Verify button */}
        {!loading && (
          <TouchableOpacity
            onPress={() => handleVerify()}
            disabled={!isComplete}
            className={`rounded-full py-4 items-center justify-center mb-8
              ${isComplete ? "bg-[#0d5c45]" : "bg-[#0d5c45]/40"}
            `}
          >
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
              className="text-white"
            >
              Verify
            </Text>
          </TouchableOpacity>
        )}

        {/* Resend */}
        <View className="items-center">
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
                className="text-[#0d5c45]"
              >
                Resend code
              </Text>
            </TouchableOpacity>
          ) : (
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-gray-400"
            >
              Resend code in{" "}
              <Text style={{ fontFamily: "Nunito_700Bold" }} className="text-[#0d5c45]">
                {countdown}s
              </Text>
            </Text>
          )}
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};

export default VerifyScreen;