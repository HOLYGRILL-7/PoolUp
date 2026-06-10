import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import React, { useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Hash, Moon, Sun } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useGroupStore } from "../../store/groupstore";
import { useColorScheme } from "nativewind";

const Join = () => {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [code, setCode] = useState(["", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const setGroup = useGroupStore((state) => state.setGroup);
  const inputs = useRef<TextInput[]>([]);

  const handleChange = (text: string, index: number) => {
    const digit = text.replace(/[^0-9]/g, "").slice(-1);
    const newCode = [...code];
    newCode[index] = digit;
    setCode(newCode);
    if (digit && index < 5) {
      inputs.current[index + 1]?.focus();
    }
  };

  const handleBackspace = (key: string, index: number) => {
    if (key === "Backspace" && !code[index] && index > 0) {
      inputs.current[index - 1]?.focus();
    }
  };

  const handleJoin = async () => {
    const fullCode = code.join("");
    if (fullCode.length < 6) return;

    setLoading(true);
    setError("");

    try {
      const user = auth().currentUser;
      if (!user) throw new Error("Not logged in");

      const snapshot = await firestore()
        .collection("groups")
        .where("code", "==", fullCode)
        .limit(1)
        .get();

      if (snapshot.empty) {
        setError("Invalid code. Check with your admin and try again.");
        setLoading(false);
        return;
      }

      const groupDoc = snapshot.docs[0];
      const groupData = groupDoc.data();

      const alreadyMember = groupData.members?.some(
        (m: any) => m.uid === user.uid
      );

      if (alreadyMember) {
        setGroup(groupDoc.id, groupData.code, groupData.name);
        router.replace("/(home)/dashboard");
        return;
      }

      const db = firestore();
      const batch = db.batch();
      const groupRef = db.collection("groups").doc(groupDoc.id);
      
      const existingMembersCount = groupData.members?.length || 0;
      const newSplitAmount = Math.round(groupData.savingsGoal / (existingMembersCount + 1));
      
      batch.update(groupRef, {
        memberIds: firestore.FieldValue.arrayUnion(user.uid),
        members: firestore.FieldValue.arrayUnion({
          uid: user.uid,
          phone: user.phoneNumber || "",
          name: user.displayName || user.phoneNumber || "Unknown",
          isAdmin: false,
          joinedAt: firestore.Timestamp.now(),
          status: "pending",
        }),
      });

      const nextDueDate = groupData.nextDueDate || firestore.Timestamp.fromDate(new Date());

      // Seed the new member's payment doc
      const newMemberPaymentRef = groupRef.collection("payments").doc(user.uid);
      batch.set(newMemberPaymentRef, {
        memberUid: user.uid,
        memberPhone: user.phoneNumber || "",
        memberName: user.displayName || user.phoneNumber || "Unknown",
        amount: newSplitAmount,
        status: "pending",
        dueDate: nextDueDate,
        paidAt: null,
        transactionId: null,
        createdAt: firestore.Timestamp.now(),
      });

      // Update amount for other members' pending payments
      if (groupData.members) {
        groupData.members.forEach((m: any) => {
          if (m.status === "pending" || !m.status) {
            const memberPaymentRef = groupRef.collection("payments").doc(m.uid);
            batch.update(memberPaymentRef, {
              amount: newSplitAmount,
            });
          }
        });
      }

      await batch.commit();

      setGroup(groupDoc.id, groupData.code, groupData.name);
      router.replace("/(home)/dashboard");

    } catch (err) {
      console.error(err);
      setError("Something went wrong. Try again.");
      setLoading(false);
    }
  };

  const isComplete = code.every((d) => d !== "");

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#f0f7f4] dark:bg-brand-darkBg"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <View className="flex-1 px-6 pt-14">

        {/* Header — back button and dark mode toggle only */}
        <View className="flex-row items-center justify-between mb-12">
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-white dark:bg-brand-darkCard items-center justify-center"
            onPress={() => router.back()}
          >
            <ArrowLeft color={colorScheme === "dark" ? "#a3bdae" : "#0d5c45"} size={20} />
          </TouchableOpacity>
          <TouchableOpacity
            className="w-12 h-12 rounded-full bg-green-50 dark:bg-brand-darkCard items-center justify-center"
            onPress={toggleColorScheme}
          >
            {colorScheme === "dark" ? (
              <Sun color="#F5A623" size={20} />
            ) : (
              <Moon color="green" size={20} />
            )}
          </TouchableOpacity>
        </View>

        {/* Hash icon */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-emerald-100 dark:bg-emerald-950/40 items-center justify-center">
            <View className="w-16 h-16 rounded-full bg-[#0d5c45] dark:bg-brand-greenLight items-center justify-center">
              <Hash color="white" size={28} />
            </View>
          </View>
        </View>

        {/* Heading */}
        <View className="items-center mb-8">
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
            className="text-gray-800 dark:text-brand-darkTextHigh text-center"
          >
            What's your group code?
          </Text>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
            className="text-emerald-600 dark:text-brand-darkTextMed text-center mt-2 w-64"
          >
            Ask your group admin for the 6-digit code.
          </Text>
        </View>

        {/* 6 digit input boxes */}
        <View className="flex-row justify-between mb-6">
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={(ref) => { if (ref) inputs.current[index] = ref; }}
              value={digit}
              onChangeText={(text) => handleChange(text, index)}
              onKeyPress={({ nativeEvent }) =>
                handleBackspace(nativeEvent.key, index)
              }
              keyboardType="number-pad"
              maxLength={1}
              editable={!loading}
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 24 }}
              className={`w-14 h-14 rounded-2xl text-center text-[#0d5c45] dark:text-[#34d399]
                ${digit
                  ? "bg-white dark:bg-brand-darkInput border-2 border-[#0d5c45] dark:border-brand-darkBorder"
                  : "bg-emerald-50 dark:bg-brand-darkCard border-2 border-emerald-100 dark:border-brand-darkBorder"
                }
              `}
            />
          ))}
        </View>

        {/* Error message — sits between inputs and button */}
        {error ? (
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-red-400 dark:text-red-300 text-center mb-4"
          >
            {error}
          </Text>
        ) : (
          <View className="mb-4" />
        )}

        {/* Join button */}
        <TouchableOpacity
          onPress={handleJoin}
          disabled={!isComplete || loading}
          className={`rounded-full py-4 items-center justify-center mb-6
            ${isComplete && !loading ? "bg-[#F5A623]" : "bg-[#F5A623]/40"}
          `}
        >
          {loading ? (
            <ActivityIndicator color="white" />
          ) : (
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
              className="text-white"
            >
              Join group
            </Text>
          )}
        </TouchableOpacity>

        {/* Bottom link */}
        <View className="flex-row items-center justify-center gap-1">
          <Text
            style={{ fontFamily: "Nunito_400Regular" }}
            className="text-emerald-600 dark:text-brand-darkTextMed"
          >
            Don't have a code?
          </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text
              style={{ fontFamily: "Nunito_700Bold" }}
              className="text-[#0d5c45] dark:text-emerald-400"
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