import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  Share,
  Clipboard,
  ToastAndroid,
  Platform,
  Animated,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { ArrowLeft, Moon, Sun, Share2, UserPlus, Crown } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";
import { useGroupStore } from "../../store/groupstore";
import { useColorScheme } from "nativewind";

type Member = {
  uid: string;
  name: string;
  phone: string;
  isAdmin: boolean;
};

const InviteMembers = () => {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [members, setMembers] = useState<Member[]>([]);
  const [copied, setCopied] = useState(false);
  const copyAnim = useRef(new Animated.Value(0)).current;

  // Pull group data from Zustand — set by creategroup.tsx
  const groupId = useGroupStore((state) => state.groupId);
  const groupCode = useGroupStore((state) => state.groupCode);
  const groupName = useGroupStore((state) => state.groupName);

  useEffect(() => {
    // Safety check — if somehow we got here without a group being created
    if (!groupId) return;

    // onSnapshot is a real-time listener on this group's Firestore document.
    // Every time a new member joins and updates the members array in Firestore,
    // this fires automatically and updates our local members state.
    // This is how the "Waiting for member..." slots fill up live.
    const unsubscribe = firestore()
      .collection('groups')
      .doc(groupId)
      .onSnapshot((snap) => {
        const data = snap.data();
        if (data?.members) {
          setMembers(data.members);
        }
      });

    // Clean up the listener when the screen unmounts
    // Without this, the listener keeps running in the background wasting resources
    return () => unsubscribe();
  }, [groupId]);

  const handleCopy = () => {
    if (!groupCode) return;
    Clipboard.setString(groupCode);

    if (Platform.OS === "android") {
      ToastAndroid.show("Code copied!", ToastAndroid.SHORT);
    }

    setCopied(true);
    Animated.sequence([
      Animated.timing(copyAnim, { toValue: 1, duration: 200, useNativeDriver: true }),
      Animated.delay(1500),
      Animated.timing(copyAnim, { toValue: 0, duration: 200, useNativeDriver: true }),
    ]).start(() => setCopied(false));
  };

  const handleShare = async () => {
    await Share.share({
      message:
        `Hey! I'm inviting you to join our savings pool "${groupName}" on PoolUp. 🎉\n\n` +
        `Use this 6-digit code to join: *${groupCode}*\n\n` +
        `Download PoolUp and enter the code to get started!`,
    });
  };

  const handleDone = () => {
    // Navigate to dashboard — the group is already created in Firestore
    // We use replace instead of push so the user can't go back
    // to the invite screen from the dashboard
    router.replace("/(home)/dashboard");
  };

  // Show loading state if group hasn't been created yet
  if (!groupId || !groupCode) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f0f7f4] dark:bg-brand-darkBg">
        <ActivityIndicator color={colorScheme === "dark" ? "#10b981" : "#0d5c45"} size="large" />
      </View>
    );
  }

  const WAITING_SLOTS = Math.max(0, 2 - (members.length - 1));

  return (
    <ScrollView
      className="flex-1 bg-[#f0f7f4] dark:bg-brand-darkBg"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View className="px-6 pt-12 pb-10">
        <View className="flex-row items-center justify-between mb-8">
          <View className="flex-row items-center gap-3">
            <TouchableOpacity
              className="w-12 h-12 rounded-full bg-white dark:bg-brand-darkCard items-center justify-center"
              onPress={() => router.back()}
            >
              <ArrowLeft color={colorScheme === "dark" ? "#a3bdae" : "#0d5c45"} size={20} />
            </TouchableOpacity>
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 22 }}
              className="text-gray-800 dark:text-brand-darkTextHigh"
            >
              Invite Members
            </Text>
          </View>
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

        <View className="items-center mb-8">
          <View className="flex-row gap-2 mb-2">
            <View className="w-8 h-2 rounded-full bg-emerald-200 dark:bg-emerald-950" />
            <View className="w-8 h-2 rounded-full bg-[#0d5c45] dark:bg-brand-greenLight" />
          </View>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-emerald-600 dark:text-brand-darkTextMed"
          >
            Step 2 of 2 — Invite your people
          </Text>
        </View>

        {/* Invite code card */}
        <View className="bg-[#0d5c45] dark:bg-brand-darkCard rounded-3xl px-6 py-8 mb-6 items-center border border-transparent dark:border-brand-darkBorder">
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-white/70 dark:text-[#a3bdae] mb-6"
          >
            Group invite code
          </Text>

          <View className="flex-row gap-3 mb-6">
            {groupCode.split("").map((digit, i) => (
              <View
                key={i}
                className="w-14 h-14 rounded-full bg-white/20 dark:bg-brand-darkInput items-center justify-center"
              >
                <Text
                  style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 24 }}
                  className="text-white dark:text-brand-darkTextHigh"
                >
                  {digit}
                </Text>
              </View>
            ))}
          </View>

          <TouchableOpacity
            onPress={handleCopy}
            className="bg-white/20 dark:bg-brand-greenLight/60 rounded-full px-10 py-3"
          >
            <Animated.Text
              style={{
                fontFamily: "Nunito_700Bold",
                fontSize: 14,
                color: "white",
                opacity: copyAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 0.6],
                }),
              }}
            >
              {copied ? "Copied! ✓" : "Copy code"}
            </Animated.Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          onPress={handleShare}
          className="bg-emerald-100 dark:bg-brand-darkInput rounded-2xl px-4 py-4 flex-row items-center justify-center gap-3 mb-8 border border-transparent dark:border-brand-darkBorder"
        >
          <Share2 color={colorScheme === "dark" ? "#34d399" : "#0d5c45"} size={20} />
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
            className="text-[#0d5c45] dark:text-emerald-400"
          >
            Share invite link
          </Text>
        </TouchableOpacity>

        <Text
          style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
          className="text-gray-800 dark:text-brand-darkTextHigh mb-4"
        >
          Members so far ({members.length})
        </Text>

        <View className="gap-3">
          {members.map((member) => (
            <View
              key={member.uid}
              className="bg-white dark:bg-brand-darkCard rounded-2xl px-4 py-4 flex-row items-center justify-between border border-transparent dark:border-brand-darkBorder"
            >
              <View className="flex-row items-center gap-3">
                <View className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-950/40 items-center justify-center">
                  <Text
                    style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
                    className="text-[#0d5c45] dark:text-emerald-400"
                  >
                    {(member.name || member.phone || "?").charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View>
                  <Text
                    style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
                    className="text-gray-800 dark:text-brand-darkTextHigh"
                  >
                    {member.name || member.phone}
                  </Text>
                  <Text
                    style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
                    className="text-emerald-500 dark:text-brand-darkTextMed"
                  >
                    {member.isAdmin ? "Group admin" : "Member"}
                  </Text>
                </View>
              </View>
              {member.isAdmin && (
                <View className="w-9 h-9 rounded-full bg-[#F5A623] items-center justify-center">
                  <Crown color="white" size={20} />
                </View>
              )}
            </View>
          ))}

          {Array.from({ length: WAITING_SLOTS }).map((_, i) => (
            <View
              key={`waiting-${i}`}
              className="border-2 border-dashed border-emerald-200 dark:border-brand-darkBorder rounded-2xl px-4 py-4 flex-row items-center gap-3"
            >
              <View className="w-12 h-12 rounded-full bg-emerald-50 dark:bg-[#121e1a] items-center justify-center">
                <UserPlus color={colorScheme === "dark" ? "#34d399" : "#0d5c45"} size={20} />
              </View>
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 15 }}
                className="text-emerald-400 dark:text-brand-darkTextLow"
              >
                Waiting for member...
              </Text>
            </View>
          ))}
        </View>

        <TouchableOpacity
          className="bg-[#F5A623] rounded-full py-4 items-center justify-center mt-10"
          onPress={handleDone}
        >
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
            className="text-white"
          >
            Done, go to my group
          </Text>
        </TouchableOpacity>
      </View>
    </ScrollView>
  );
};

export default InviteMembers;