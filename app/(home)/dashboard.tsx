import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  Animated,
  PanResponder,
  ActivityIndicator,
  Modal,
  TextInput,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { Moon, Bell, Users, ShieldCheck, ClipboardList } from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useGroupStore } from "../../store/groupstore";

// Types matching what we store in Firestore
type Member = {
  uid: string;
  name: string;
  phone: string;
  isAdmin: boolean;
  status?: "paid" | "pending" | "missed";
};

type Group = {
  id: string;
  name: string;
  savingsGoal: number;
  totalSaved: number;
  frequency: string;
  nextDueDate: string;
  daysLeft: number;
  members: Member[];
  code: string;
  adminId: string;
  myContribution: number;
};

const CircularProgress = ({
  percentage, saved, goal,
}: {
  percentage: number; saved: number; goal: number;
}) => {
  const size = 220;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View className="items-center justify-center my-6">
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={radius} stroke="#d1fae5" strokeWidth={strokeWidth} fill="transparent" />
        <Circle
          cx={size / 2} cy={size / 2} r={radius}
          stroke="#0d5c45" strokeWidth={strokeWidth} fill="transparent"
          strokeDasharray={circumference} strokeDashoffset={strokeDashoffset}
          strokeLinecap="round" rotation="-90" origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={size / 2 + radius * Math.cos(((percentage / 100) * 360 - 90) * (Math.PI / 180))}
          cy={size / 2 + radius * Math.sin(((percentage / 100) * 360 - 90) * (Math.PI / 180))}
          r={8} fill="#F5A623"
        />
      </Svg>
      <View className="absolute items-center">
        <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 42 }} className="text-gray-800">{percentage}%</Text>
        <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-gray-500">of goal reached</Text>
        <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }} className="text-[#0d5c45] mt-1">GHS {saved.toLocaleString()}</Text>
        <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-gray-400">/ GHS {goal.toLocaleString()}</Text>
      </View>
    </View>
  );
};

const statusColor = (status: string) => {
  if (status === "paid") return "#22c55e";
  if (status === "pending") return "#F5A623";
  return "#ef4444";
};

const FlipCard = ({
  group,
  isAdmin,
  hasPaid,
  onMarkAsPaid,
}: {
  group: Group;
  isAdmin: boolean;
  hasPaid: boolean;
  onMarkAsPaid: () => void;
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const swipeStartX = useRef(0);
  const isFlippedRef = useRef(false);

  const flipToBack = () => {
    isFlippedRef.current = true;
    setIsFlipped(true);
    Animated.spring(flipAnim, { toValue: 1, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const flipToFront = () => {
    isFlippedRef.current = false;
    setIsFlipped(false);
    Animated.spring(flipAnim, { toValue: 0, friction: 8, tension: 40, useNativeDriver: true }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => { swipeStartX.current = e.nativeEvent.pageX; },
      onPanResponderRelease: (e) => {
        const diff = e.nativeEvent.pageX - swipeStartX.current;
        if (!isFlippedRef.current && diff < -40) flipToBack();
        else if (isFlippedRef.current && diff > 40) flipToFront();
      },
    })
  ).current;

  const frontRotate = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["0deg", "90deg", "90deg"] });
  const backRotate = flipAnim.interpolate({ inputRange: [0, 0.5, 1], outputRange: ["-90deg", "-90deg", "0deg"] });
  const frontOpacity = flipAnim.interpolate({ inputRange: [0, 0.45, 0.5], outputRange: [1, 1, 0] });
  const backOpacity = flipAnim.interpolate({ inputRange: [0.5, 0.55, 1], outputRange: [0, 1, 1] });

  const paidCount = group.members.filter((m) => m.status === "paid").length;

  return (
    <View style={{ height: 200, marginBottom: 8 }} {...panResponder.panHandlers}>
      <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 12 }} className="text-gray-400 text-center mb-2">
        {isFlipped ? "swipe right to go back →" : "← swipe left for your card"}
      </Text>

      {/* FRONT — group overview */}
      <Animated.View style={{ position: "absolute", top: 24, width: "100%", transform: [{ rotateY: frontRotate }], opacity: frontOpacity }}>
        <View className="bg-[#0d5c45] rounded-3xl px-6 py-6">
          <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }} className="text-white/60 mb-3">Group Overview</Text>
          <View className="flex-row justify-between mb-3">
            <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/70">Goal</Text>
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }} className="text-white">GHS {group.savingsGoal.toLocaleString()}</Text>
          </View>
          <View className="h-px bg-white/20 mb-3" />
          <View className="flex-row justify-between mb-3">
            <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/70">Collected</Text>
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }} className="text-white">GHS {group.totalSaved.toLocaleString()}</Text>
          </View>
          <View className="h-px bg-white/20 mb-3" />
          <View className="flex-row justify-between">
            <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/70">This month</Text>
            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }} className="text-white">{paidCount}/{group.members.length} paid</Text>
          </View>
        </View>
      </Animated.View>

      {/* BACK — personal card */}
      <Animated.View style={{ position: "absolute", top: 24, width: "100%", transform: [{ rotateY: backRotate }], opacity: backOpacity }}>
        <View className="bg-[#F5A623] rounded-3xl px-6 py-6">
          <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/80">Your next contribution</Text>
          <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 36 }} className="text-white mt-1">GHS {group.myContribution}</Text>
          <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/80 mt-1">⏱ Due in {group.daysLeft} days</Text>
          <TouchableOpacity
            disabled={hasPaid}
            onPress={onMarkAsPaid}
            className={`rounded-full py-3 mt-4 flex-row items-center justify-center ${hasPaid ? "bg-emerald-600" : "bg-white"}`}
          >
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
              className={hasPaid ? "text-white" : "text-[#F5A623]"}
            >
              {hasPaid ? "✓ Paid" : "⚡ Mark as Paid"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const Dashboard = () => {
  const router = useRouter();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);

  // Get groupId from Zustand store set during create/join
  const groupId = useGroupStore((state) => state.groupId);
  const currentUser = auth().currentUser;

  // Determine if current user is the admin
  const isAdmin = group?.adminId === currentUser?.uid;

  const [isPaymentModalVisible, setIsPaymentModalVisible] = useState(false);
  const [momoRef, setMomoRef] = useState("");
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [paymentError, setPaymentError] = useState("");

  const handleMarkAsPaid = async () => {
    if (!momoRef.trim()) {
      setPaymentError("Please enter the Mobile Money transaction reference.");
      return;
    }

    setSubmittingPayment(true);
    setPaymentError("");

    try {
      const db = firestore();
      const groupRef = db.collection("groups").doc(groupId!);
      const paymentRef = groupRef.collection("payments").doc(currentUser?.uid);
      const now = firestore.Timestamp.now();

      await db.runTransaction(async (transaction) => {
        const groupDoc = await transaction.get(groupRef);
        if (!groupDoc.exists) throw new Error("Group does not exist");

        const data = groupDoc.data()!;
        const members = data.members || [];

        const updatedMembers = members.map((m: any) => {
          if (m.uid === currentUser?.uid) {
            return { ...m, status: "paid" };
          }
          return m;
        });

        const myContribution = Math.round(data.savingsGoal / (members.length || 1));

        transaction.update(groupRef, {
          members: updatedMembers,
          totalSaved: (data.totalSaved || 0) + myContribution,
        });

        transaction.set(paymentRef, {
          memberUid: currentUser?.uid,
          memberPhone: currentUser?.phoneNumber || "",
          memberName: currentUser?.displayName || currentUser?.phoneNumber || "Unknown",
          amount: myContribution,
          status: "paid",
          dueDate: data.nextDueDate || now,
          paidAt: now,
          transactionId: momoRef.trim(),
          createdAt: now,
        }, { merge: true });
      });

      setIsPaymentModalVisible(false);
      setMomoRef("");
    } catch (err) {
      console.error("Payment confirmation failed:", err);
      setPaymentError("Failed to record payment. Please check connection.");
    } finally {
      setSubmittingPayment(false);
    }
  };

  useEffect(() => {
    if (!groupId) return;

    // Real-time listener on the group document
    // Every time any field changes (member pays, new member joins)
    // this fires and updates the UI automatically
    const unsubscribe = firestore()
      .collection("groups")
      .doc(groupId)
      .onSnapshot((snap) => {
        if (!snap.exists) return;
        const data = snap.data()!;

        // Calculate days left until next due date
        // nextDueDate is stored as a Firestore Timestamp
        const dueDate = data.nextDueDate?.toDate?.() || new Date();
        const today = new Date();
        const daysLeft = Math.ceil(
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Find current user's contribution amount
        // For MVP this is savingsGoal divided equally among members
        const myContribution = Math.round(
          data.savingsGoal / (data.members?.length || 1)
        );

        setGroup({
          id: snap.id,
          name: data.name,
          savingsGoal: data.savingsGoal,
          totalSaved: data.totalSaved || 0,
          frequency: data.frequency,
          nextDueDate: dueDate.toLocaleDateString("en-GH", { month: "short", day: "numeric", year: "numeric" }),
          daysLeft: Math.max(0, daysLeft),
          members: data.members || [],
          code: data.code,
          adminId: data.adminId,
          myContribution,
        });

        setLoading(false);
      });

    return () => unsubscribe();
  }, [groupId]);

  // Admin nudge — opens WhatsApp for each unpaid member
  // For now uses WhatsApp deep link
  // Phase 3: replace with FCM push notification
  const handleNudge = () => {
    if (!group) return;
    const unpaid = group.members.filter(
      (m) => m.status === "pending" || m.status === "missed"
    );
    unpaid.forEach((member) => {
      Linking.openURL(
        `whatsapp://send?phone=${member.phone}&text=Hey ${member.name}! 👋 Just a reminder that your PoolUp contribution for ${group.name} is due. Please pay when you can! 🙏`
      );
    });
  };

  if (loading || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f0f7f4]">
        <ActivityIndicator color="#0d5c45" size="large" />
        <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-emerald-600 mt-3">
          Loading your group...
        </Text>
      </View>
    );
  }

  const percentage = group.savingsGoal > 0
    ? Math.min(100, Math.round((group.totalSaved / group.savingsGoal) * 100))
    : 0;

  const paidCount = group.members.filter((m) => m.status === "paid").length;
  const pendingCount = group.members.filter((m) => m.status === "pending").length;
  const missedCount = group.members.filter((m) => m.status === "missed").length;

  const myMemberObject = group.members.find((m) => m.uid === currentUser?.uid);
  const hasPaid = myMemberObject?.status === "paid";

  return (
    <View className="flex-1 bg-[#f0f7f4]">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-12 pb-10">

          {/* Header */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }} className="text-gray-800">
                {group.name}
              </Text>
              <View className="flex-row flex-wrap gap-2 mt-2">
                <View className="bg-emerald-100 rounded-full px-3 py-1 flex-row items-center gap-2">
                  <Users color="#0d5c45" size={13} />
                  <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13 }} className="text-[#0d5c45]">
                    {group.members.length} members
                  </Text>
                </View>
                {isAdmin && (
                  <View className="bg-emerald-100 rounded-full px-3 py-1 flex-row items-center gap-2">
                    <ShieldCheck color="#0d5c45" size={13} />
                    <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13 }} className="text-[#0d5c45]">Admin</Text>
                  </View>
                )}
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => router.push("/(home)/paymenthistory")}
                    className="bg-[#0d5c45] rounded-full px-3 py-1 flex-row items-center gap-2"
                  >
                    <ClipboardList color="white" size={13} />
                    <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13 }} className="text-white">Records</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
            <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center">
              <Moon color="#0d5c45" size={20} />
            </TouchableOpacity>
          </View>

          {/* Flip card — admin only */}
          {isAdmin && (
            <View className="mt-4 mb-2">
              <FlipCard
                group={group}
                isAdmin={isAdmin}
                hasPaid={hasPaid}
                onMarkAsPaid={() => setIsPaymentModalVisible(true)}
              />
            </View>
          )}

          {/* Member contribution card */}
          {!isAdmin && (
            <View className="bg-[#F5A623] rounded-3xl px-6 py-6 mt-4">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/80">Your next contribution</Text>
              <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 36 }} className="text-white mt-1">GHS {group.myContribution}</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }} className="text-white/80 mt-1">
                ⏱ Due in {group.daysLeft} days — {group.nextDueDate}
              </Text>
              <TouchableOpacity
                disabled={hasPaid}
                onPress={() => setIsPaymentModalVisible(true)}
                className={`rounded-full py-3 mt-4 flex-row items-center justify-center gap-2 ${hasPaid ? "bg-emerald-600" : "bg-white"}`}
              >
                <Text
                  style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
                  className={hasPaid ? "text-white" : "text-[#F5A623]"}
                >
                  {hasPaid ? "✓ Paid" : "⚡ Mark as Paid"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Circular progress */}
          <CircularProgress percentage={percentage} saved={group.totalSaved} goal={group.savingsGoal} />

          {/* Admin view */}
          {isAdmin && (
            <>
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18 }} className="text-gray-800">This month</Text>
                <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 14 }} className="text-[#0d5c45]">
                  {paidCount}/{group.members.length} paid
                </Text>
              </View>

              {/* Member avatar row */}
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                <View className="flex-row gap-4">
                  {group.members.map((member) => (
                    <View key={member.uid} className="items-center">
                      <View className="relative">
                        <View className="w-14 h-14 rounded-full bg-emerald-200 items-center justify-center">
                          <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }} className="text-[#0d5c45]">
                            {(member.name || member.phone || "?").charAt(0).toUpperCase()}
                          </Text>
                        </View>
                        <View style={{
                          position: "absolute", bottom: 0, right: 0,
                          width: 16, height: 16, borderRadius: 8,
                          backgroundColor: statusColor(member.status || "pending"),
                          borderWidth: 2, borderColor: "#f0f7f4",
                          alignItems: "center", justifyContent: "center",
                        }}>
                          {member.status === "paid" && <Text style={{ fontSize: 8, color: "white" }}>✓</Text>}
                          {member.status === "missed" && <Text style={{ fontSize: 8, color: "white" }}>✕</Text>}
                        </View>
                      </View>
                      <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 12 }} className="text-gray-600 mt-1">
                        {(member.name || member.phone || "?").split(" ")[0]}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Due date card */}
              <View className="bg-amber-50 rounded-2xl px-4 py-4 flex-row items-center justify-between mb-6">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-full bg-[#F5A623] items-center justify-center">
                    <Bell color="white" size={20} />
                  </View>
                  <View>
                    <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }} className="text-gray-800">Next due date</Text>
                    <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-[#0d5c45]">
                      {group.nextDueDate} — {group.daysLeft} days left
                    </Text>
                  </View>
                </View>
                <View className="w-10 h-10 rounded-full bg-[#F5A623] items-center justify-center">
                  <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }} className="text-white">{group.daysLeft}d</Text>
                </View>
              </View>

              {/* Paid / pending / missed summary */}
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1 bg-emerald-50 rounded-2xl py-4 items-center">
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }} className="text-emerald-500">{paidCount}</Text>
                  <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-500 mt-1">Paid</Text>
                </View>
                <View className="flex-1 bg-amber-50 rounded-2xl py-4 items-center">
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }} className="text-[#F5A623]">{pendingCount}</Text>
                  <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-500 mt-1">Pending</Text>
                </View>
                <View className="flex-1 bg-red-50 rounded-2xl py-4 items-center">
                  <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }} className="text-red-400">{missedCount}</Text>
                  <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-500 mt-1">Missed</Text>
                </View>
              </View>

              {/* Nudge button */}
              <TouchableOpacity
                onPress={handleNudge}
                className="bg-[#0d5c45] rounded-full py-4 flex-row items-center justify-center gap-3 mb-4"
              >
                <Bell color="white" size={20} />
                <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }} className="text-white">
                  Nudge unpaid members
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Member view */}
          {!isAdmin && (
            <>
              <View className="flex-row items-center justify-between mb-4">
                <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18 }} className="text-gray-800">Pool members</Text>
                <Text style={{ fontFamily: "Nunito_600SemiBold", fontSize: 14 }} className="text-[#0d5c45]">
                  {paidCount}/{group.members.length} paid
                </Text>
              </View>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
                <View className="flex-row gap-4">
                  {group.members.map((member) => (
                    <View key={member.uid} className="relative">
                      <View className="w-14 h-14 rounded-full bg-emerald-200 items-center justify-center">
                        <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }} className="text-[#0d5c45]">
                          {(member.name || member.phone || "?").charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{
                        position: "absolute", bottom: 0, right: 0,
                        width: 14, height: 14, borderRadius: 7,
                        backgroundColor: statusColor(member.status || "pending"),
                        borderWidth: 2, borderColor: "#f0f7f4",
                      }} />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}

        </View>
      </ScrollView>

      {/* MoMo Reference Entry Modal */}
      <Modal
        visible={isPaymentModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!submittingPayment) {
            setIsPaymentModalVisible(false);
            setMomoRef("");
            setPaymentError("");
          }
        }}
      >
        <View style={{ flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "rgba(0,0,0,0.6)" }} className="px-6">
          <View className="bg-white rounded-3xl w-full p-6 shadow-xl">
            <Text style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 22 }} className="text-gray-800 text-center mb-2">
              Confirm Contribution
            </Text>
            <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 15 }} className="text-gray-500 text-center mb-6">
              You are paying <Text style={{ fontFamily: "Nunito_700Bold" }} className="text-[#0d5c45]">GHS {group.myContribution}</Text>. Please input your Mobile Money transaction reference number to verify.
            </Text>

            <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }} className="text-gray-700 mb-2">
              Transaction ID / Ref
            </Text>
            <TextInput
              value={momoRef}
              onChangeText={(t) => { setMomoRef(t); setPaymentError(""); }}
              placeholder="e.g. 2938210382"
              placeholderTextColor="#9CA3AF"
              keyboardType="default"
              editable={!submittingPayment}
              style={{ fontFamily: "Nunito_400Regular", fontSize: 16 }}
              className={`bg-gray-50 rounded-2xl px-4 py-4 mb-4 text-gray-800 border ${paymentError ? "border-red-400" : "border-gray-100"}`}
            />

            {paymentError ? (
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-red-400 mb-4 ml-1">
                {paymentError}
              </Text>
            ) : null}

            <View className="flex-row gap-3">
              <TouchableOpacity
                disabled={submittingPayment}
                onPress={() => { setIsPaymentModalVisible(false); setMomoRef(""); setPaymentError(""); }}
                className="flex-1 bg-gray-100 rounded-full py-4 items-center"
              >
                <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }} className="text-gray-500">
                  Cancel
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                disabled={submittingPayment || !momoRef.trim()}
                onPress={handleMarkAsPaid}
                className={`flex-1 rounded-full py-4 items-center justify-center ${momoRef.trim() && !submittingPayment ? "bg-[#0d5c45]" : "bg-[#0d5c45]/40"}`}
              >
                {submittingPayment ? (
                  <ActivityIndicator color="white" size="small" />
                ) : (
                  <Text style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }} className="text-white">
                    Confirm
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default Dashboard;