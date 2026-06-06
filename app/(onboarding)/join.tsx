import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import React, { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Hash, Moon } from "lucide-react-native";

const Join = () => {
  const router = useRouter();
  const [code, setCode] = useState(["", "", "", "", "", ""]);

  // one ref per input box for auto-jumping
  const inputs = useRef<TextInput[]>([]);

  const handleChange = (text: string, index: number) => {
    // only allow one digit per box
    const digit = text.replace(/[^0-9]/g, "").slice(-1);

    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);

    // auto jump to next box
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (key: string, index: number) => {
    // jump back to previous box on backspace
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleJoin = () => {
    const fullCode = code.join("");
    if (fullCode.length < 6) return;

    // TODO: verify code against Firestore
    // TODO: add user to group
    // TODO: navigate to home
    console.log("Code entered:", fullCode);
  };

  const isComplete = code.every((d) => d !== "");

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f0f7f4]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-14">

        {/* Header */}
        <View className="flex-row items-center justify-between mb-12">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              className="w-12 h-12 rounded-full bg-white items-center justify-center"
              onPress={() => router.back()}
            >
              <ArrowLeft color="#0d5c45" size={20} />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 22 }}
              className="text-gray-800"
            >
              Join a Group
            </Text>
          </View>

          {/* TODO: wire up dark mode */}
          <TouchableOpacity className="w-12 h-12 rounded-full bg-green-50 items-center justify-center">
            <Moon color="green" size={20} />
          </TouchableOpacity>
        </View>

        {/* Hash icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-emerald-100 items-center justify-center">
            <View className="w-16 h-16 rounded-full bg-[#0d5c45] items-center justify-center">
              <Hash color="white" size={28} />
            </View>
          </View>
        </View>

        {/* Heading */}
        <View className="items-center mb-8">
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
            className="text-gray-800 text-center"
          >
            What's your group code?
          </Text>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
            className="text-emerald-600 text-center mt-2 w-64"
          >
            Ask your group admin for the 6-digit code.
          </Text>
        </View>

        {/* 6 digit input boxes */}
        <View className="flex-row justify-between mb-10">
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => {
                if (ref) inputs.current[index] = ref;
              }}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleBackspace(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={1}
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 24 }}
              className={`w-14 h-14 rounded-2xl text-center text-[#0d5c45]
                ${digit ? "bg-white border-2 border-[#0d5c45]" : "bg-emerald-50 border-2 border-emerald-100"}
              `}
            />
          ))}
        </View>

        {/* Join button */}
        <TouchableOpacity
          onPress={handleJoin}
          disabled={!isComplete}
          className={`rounded-full py-4 items-center justify-center mb-6
            ${isComplete ? "bg-[#F5A623]" : "bg-[#F5A623]/40"}
          `}
        >
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
            className="text-white"
          >
            Join group
          </Text>
        </TouchableOpacity>

        {/* Bottom link */}
        <View className="flex-row items-center justify-center gap-1">
          <Text
            style={{ fontFamily: "Nunito_400Regular" }}
            className="text-emerald-600"
          >
            Don't have a code?
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text
              style={{ fontFamily: "Nunito_700Bold" }}
              className="text-[#0d5c45]"
            >
              Create a group instead
            </Text>
          </TouchableOpacity>
        </View>

      </View>
    </KeyboardAvoidingView>
  );
};

export default Join;