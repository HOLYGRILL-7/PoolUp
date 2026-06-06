import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Platform,
} from "react-native";
import React, { useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Moon, Calendar } from "lucide-react-native";
import DateTimePicker from "@react-native-community/datetimepicker";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useGroupStore } from "../../store/groupstore";

// Calculates the first due date based on the group's start date and frequency.
// For Monthly groups, the due date is the same day next month.
// For Weekly groups, it's 7 days from the start date.
// This is stored as nextDueDate on the group document and drives the
// countdown on the dashboard and the dueDate on each payment record.
const calcNextDueDate = (startDate: Date, frequency: "Weekly" | "Monthly"): Date => {
  const due = new Date(startDate);
  if (frequency === "Monthly") {
    due.setMonth(due.getMonth() + 1);
  } else {
    due.setDate(due.getDate() + 7);
  }
  return due;
};

// Generates a random 6-digit numeric code for group invites.
// Math.random gives 0-1, * 900000 gives 0-899999, + 100000 ensures 6 digits.
const generateCode = () =>
  Math.floor(100000 + Math.random() * 900000).toString();

const CreateGroup = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const setGroup = useGroupStore((state) => state.setGroup);

  const [groupName, setGroupName] = useState("");
  const [savingsGoal, setSavingsGoal] = useState("");
  const [frequency, setFrequency] = useState<"Weekly" | "Monthly">("Monthly");
  const [startDate, setStartDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);

  const formatDate = (date: Date) =>
    date.toLocaleDateString("en-GH", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const onDateChange = (_: any, selected?: Date) => {
    setShowDatePicker(Platform.OS === "ios");
    if (selected) setStartDate(selected);
  };

  const canProceed = groupName.trim() && savingsGoal.trim();

  const handleCreateGroup = async () => {
    if (!canProceed) return;
    setLoading(true);

    try {
      const user = auth().currentUser;
      if (!user) throw new Error("No user logged in");

      const code = generateCode();
      const now = firestore.Timestamp.now();
      const nextDueDate = calcNextDueDate(startDate, frequency);
      const goalAmount = parseFloat(savingsGoal.replace(/,/g, ""));

      // ── Create the group document ───────────────────────────────────────
      // memberIds is a flat array of UIDs alongside the richer members array.
      // Firestore can query array-contains on memberIds to find a user's group
      // quickly on app start — you can't do array-contains on nested objects.
      const groupRef = await firestore()
        .collection("groups")
        .add({
          name: groupName.trim(),
          savingsGoal: goalAmount,
          frequency,
          startDate: firestore.Timestamp.fromDate(startDate),
          nextDueDate: firestore.Timestamp.fromDate(nextDueDate),
          code,
          adminId: user.uid,
          memberIds: [user.uid],
          members: [
            {
              uid: user.uid,
              phone: user.phoneNumber,
              name: user.displayName || user.phoneNumber,
              isAdmin: true,
              status: "pending",   // ← all members start as pending each cycle
              joinedAt: now,
            },
          ],
          totalSaved: 0,
          createdAt: now,
        });

      // ── Seed the admin's first payment record ───────────────────────────
      // We pre-create a pending payment doc for the admin so it shows up
      // in Payment History immediately. When they pay, we update this doc.
      // Doc ID = uid so it's easy to update later without querying.
      await firestore()
        .collection("groups")
        .doc(groupRef.id)
        .collection("payments")
        .doc(user.uid)
        .set({
          memberUid: user.uid,
          memberPhone: user.phoneNumber,
          memberName: user.displayName || user.phoneNumber,
          amount: goalAmount,   // updated when more members join and we know the split
          status: "pending",
          dueDate: firestore.Timestamp.fromDate(nextDueDate),
          paidAt: null,
          transactionId: null,
          createdAt: now,
        });

      // Store groupId, code, name in Zustand so invitemembers can read them
      // without passing complex objects through router params
      setGroup(groupRef.id, code, groupName.trim());
      router.push("/(groups)/invitemembers");

    } catch (err) {
      console.error("Error creating group:", err);
      // TODO: show error toast
    } finally {
      setLoading(false);
    }
  };

  return (
    <ScrollView
      className="flex-1 bg-[#f0f7f4]"
      keyboardShouldPersistTaps="handled"
    >
      <View className="px-6 pt-12 pb-10">
        {/* Header */}
        <View className="flex-row items-center justify-between mb-8">
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
              Create a Group
            </Text>
          </View>
          {/* TODO: wire up dark mode */}
          <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center">
            <Moon color="#0d5c45" size={20} />
          </TouchableOpacity>
        </View>

        {/* Step indicator */}
        <View className="items-center mb-8">
          <View className="flex-row gap-2 mb-2">
            <View className="w-8 h-2 rounded-full bg-[#0d5c45]" />
            <View className="w-8 h-2 rounded-full bg-emerald-200" />
          </View>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-emerald-600"
          >
            Step 1 of 2 — Group Setup
          </Text>
        </View>

        {/* Group name */}
        <Text
          style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
          className="text-gray-800 mb-2"
        >
          Group name
        </Text>
        <TextInput
          value={groupName}
          onChangeText={setGroupName}
          placeholder="Jones Family Fund"
          placeholderTextColor="#9CA3AF"
          style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
          className="bg-white rounded-2xl px-4 py-4 mb-6 text-gray-800"
        />

        {/* Savings goal */}
        <Text
          style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
          className="text-gray-800 mb-2"
        >
          Savings goal
        </Text>
        <View className="bg-white rounded-2xl px-4 py-4 mb-6 flex-row items-center">
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
            className="text-emerald-500 mr-2"
          >
            GHS
          </Text>
          <TextInput
            value={savingsGoal}
            onChangeText={setSavingsGoal}
            placeholder="5,000"
            placeholderTextColor="#9CA3AF"
            keyboardType="numeric"
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16, flex: 1 }}
            className="text-gray-800"
          />
        </View>

        {/* Contribution frequency */}
        <Text
          style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
          className="text-gray-800 mb-2"
        >
          Contribution frequency
        </Text>
        <View className="bg-emerald-100 rounded-full flex-row p-1 mb-6">
          {(["Weekly", "Monthly"] as const).map((option) => (
            <TouchableOpacity
              key={option}
              onPress={() => setFrequency(option)}
              className={`flex-1 py-3 rounded-full items-center
                ${frequency === option ? "bg-[#0d5c45]" : ""}
              `}
            >
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
                className={
                  frequency === option ? "text-white" : "text-emerald-700"
                }
              >
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Start date */}
        <Text
          style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
          className="text-gray-800 mb-2"
        >
          Start date
        </Text>
        <TouchableOpacity
          onPress={() => setShowDatePicker(true)}
          className="bg-white rounded-2xl px-4 py-4 mb-6 flex-row items-center justify-between"
        >
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
            className="text-gray-800"
          >
            {formatDate(startDate)}
          </Text>
          <Calendar color="#0d5c45" size={20} />
        </TouchableOpacity>

        {showDatePicker && (
          <DateTimePicker
            value={startDate}
            mode="date"
            display={Platform.OS === "ios" ? "spinner" : "default"}
            onChange={onDateChange}
            minimumDate={new Date()}
          />
        )}

        {/* Live Preview */}
        <View className="rounded-2xl overflow-hidden mb-8">
          <View className="bg-[#0d5c45] px-4 py-4 flex-row items-center justify-between">
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
              className="text-white"
            >
              Live Preview
            </Text>
            <View className="w-6 h-6 rounded-full bg-white" />
          </View>

          <View className="bg-white px-4 py-4 gap-3">
            <View className="flex-row justify-between items-center">
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-emerald-500"
              >
                Group
              </Text>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
                className="text-gray-800"
              >
                {groupName || "—"}
              </Text>
            </View>

            <View className="h-px bg-gray-100" />

            <View className="flex-row justify-between items-center">
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-emerald-500"
              >
                Goal
              </Text>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
                className="text-gray-800"
              >
                {savingsGoal ? `GHS ${savingsGoal}` : "—"}
              </Text>
            </View>

            <View className="h-px bg-gray-100" />

            <View className="flex-row justify-between items-center">
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-emerald-500"
              >
                Frequency
              </Text>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
                className="text-gray-800"
              >
                {frequency}
              </Text>
            </View>

            <View className="h-px bg-gray-100" />

            <View className="flex-row justify-between items-center">
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-emerald-500"
              >
                First due date
              </Text>
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
                className="text-gray-800"
              >
                {formatDate(calcNextDueDate(startDate, frequency))}
              </Text>
            </View>
          </View>
        </View>

        {/* Next button */}
        <TouchableOpacity
          disabled={!canProceed || loading}
          onPress={handleCreateGroup}
          className={`rounded-full py-4 items-center justify-center
            ${canProceed && !loading ? "bg-[#F5A623]" : "bg-[#F5A623]/40"}
          `}
        >
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
            className="text-white"
          >
            {loading ? "Creating..." : "Next"}
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default CreateGroup;
