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
  Alert,
  Switch,
  Dimensions,
  Pressable,
  Easing,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import {
  Moon,
  Sun,
  Bell,
  Users,
  ShieldCheck,
  ClipboardList,
  UserPlus,
  LogOut,
} from "lucide-react-native";
import Svg, { Circle } from "react-native-svg";
import { useRouter } from "expo-router";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useGroupStore } from "../../store/groupstore";
import { useColorScheme } from "nativewind";
import { usePaystack } from "react-native-paystack-webview";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type Member = {
  uid: string;
  name: string;
  phone: string;
  isAdmin: boolean;
  status?: "paid" | "pending" | "missed";
};

type Subscription = {
  status: string; // 'active' | 'overdue'
  nextBillingDate: string; // human-readable via toLocaleDateString
  nextBillingDateRaw: Date;
  lastPaidAt: string | null;
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
  subscription?: Subscription;
};

// ─────────────────────────────────────────────────────────────────────────────
// CircularProgress
// ─────────────────────────────────────────────────────────────────────────────

const CircularProgress = ({
  percentage,
  saved,
  goal,
}: {
  percentage: number;
  saved: number;
  goal: number;
}) => {
  const { colorScheme } = useColorScheme();
  const size = 220;
  const strokeWidth = 16;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <View className="items-center justify-center my-6">
      <Svg width={size} height={size}>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorScheme === "dark" ? "#1b2e27" : "#d1fae5"}
          strokeWidth={strokeWidth}
          fill="transparent"
        />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={colorScheme === "dark" ? "#10b981" : "#0d5c45"}
          strokeWidth={strokeWidth}
          fill="transparent"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          strokeLinecap="round"
          rotation="-90"
          origin={`${size / 2}, ${size / 2}`}
        />
        <Circle
          cx={
            size / 2 +
            radius * Math.cos(((percentage / 100) * 360 - 90) * (Math.PI / 180))
          }
          cy={
            size / 2 +
            radius * Math.sin(((percentage / 100) * 360 - 90) * (Math.PI / 180))
          }
          r={8}
          fill="#F5A623"
        />
      </Svg>
      <View className="absolute items-center">
        <Text
          style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 42 }}
          className="text-gray-800 dark:text-brand-darkTextHigh"
        >
          {percentage}%
        </Text>
        <Text
          style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
          className="text-gray-500 dark:text-brand-darkTextLow"
        >
          of goal reached
        </Text>
        <Text
          style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }}
          className="text-[#0d5c45] dark:text-emerald-400 mt-1"
        >
          GHS {saved.toLocaleString()}
        </Text>
        <Text
          style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
          className="text-gray-400 dark:text-brand-darkTextLow"
        >
          / GHS {goal.toLocaleString()}
        </Text>
      </View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Status helpers
// ─────────────────────────────────────────────────────────────────────────────

const statusColor = (status: string, colorScheme?: string) => {
  const isDark = colorScheme === "dark";
  if (status === "paid") return isDark ? "#4ade80" : "#22c55e";
  if (status === "pending") return "#F5A623";
  return isDark ? "#fca5a5" : "#ef4444";
};

// ─────────────────────────────────────────────────────────────────────────────
// FlipCard
// ─────────────────────────────────────────────────────────────────────────────

const FlipCard = ({
  group,
  isAdmin,
  hasPaid,
  onMarkAsPaid,
  isLocked,
}: {
  group: Group;
  isAdmin: boolean;
  hasPaid: boolean;
  onMarkAsPaid: () => void;
  isLocked: boolean;
}) => {
  const { colorScheme } = useColorScheme();
  const [isFlipped, setIsFlipped] = useState(false);
  const flipAnim = useRef(new Animated.Value(0)).current;
  const swipeStartX = useRef(0);
  const isFlippedRef = useRef(false);

  const flipToBack = () => {
    isFlippedRef.current = true;
    setIsFlipped(true);
    Animated.spring(flipAnim, {
      toValue: 1,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const flipToFront = () => {
    isFlippedRef.current = false;
    setIsFlipped(false);
    Animated.spring(flipAnim, {
      toValue: 0,
      friction: 8,
      tension: 40,
      useNativeDriver: true,
    }).start();
  };

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (e) => {
        swipeStartX.current = e.nativeEvent.pageX;
      },
      onPanResponderRelease: (e) => {
        const diff = e.nativeEvent.pageX - swipeStartX.current;
        if (!isFlippedRef.current && diff < -40) flipToBack();
        else if (isFlippedRef.current && diff > 40) flipToFront();
      },
    }),
  ).current;

  const frontRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["0deg", "90deg", "90deg"],
  });
  const backRotate = flipAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: ["-90deg", "-90deg", "0deg"],
  });
  const frontOpacity = flipAnim.interpolate({
    inputRange: [0, 0.45, 0.5],
    outputRange: [1, 1, 0],
  });
  const backOpacity = flipAnim.interpolate({
    inputRange: [0.5, 0.55, 1],
    outputRange: [0, 1, 1],
  });

  const paidCount = group.members.filter((m) => m.status === "paid").length;

  return (
    <View
      style={{ height: 200, marginBottom: 8 }}
      {...panResponder.panHandlers}
    >
      <Text
        style={{ fontFamily: "Nunito_400Regular", fontSize: 12 }}
        className="text-gray-400 dark:text-brand-darkTextLow text-center mb-2"
      >
        {isFlipped ? "swipe right to go back →" : "← swipe left for your card"}
      </Text>

      {/* FRONT — group overview */}
      <Animated.View
        style={{
          position: "absolute",
          top: 24,
          width: "100%",
          transform: [{ rotateY: frontRotate }],
          opacity: frontOpacity,
        }}
      >
        <View className="bg-[#0d5c45] dark:bg-brand-darkCard rounded-3xl px-6 py-6 border border-transparent dark:border-brand-darkBorder">
          <Text
            style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }}
            className="text-white/60 dark:text-[#a3bdae] mb-3"
          >
            Group Overview
          </Text>
          <View className="flex-row justify-between mb-3">
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-white/70 dark:text-brand-darkTextMed"
            >
              Goal
            </Text>
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
              className="text-white dark:text-brand-darkTextHigh"
            >
              GHS {group.savingsGoal.toLocaleString()}
            </Text>
          </View>
          <View className="h-px bg-white/20 dark:bg-brand-darkBorder mb-3" />
          <View className="flex-row justify-between mb-3">
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-white/70 dark:text-brand-darkTextMed"
            >
              Collected
            </Text>
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
              className="text-white dark:text-brand-darkTextHigh"
            >
              GHS {group.totalSaved.toLocaleString()}
            </Text>
          </View>
          <View className="h-px bg-white/20 dark:bg-brand-darkBorder mb-3" />
          <View className="flex-row justify-between">
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-white/70 dark:text-brand-darkTextMed"
            >
              This month
            </Text>
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 14 }}
              className="text-white dark:text-brand-darkTextHigh"
            >
              {paidCount}/{group.members.length} paid
            </Text>
          </View>
        </View>
      </Animated.View>

      {/* BACK — personal card */}
      <Animated.View
        style={{
          position: "absolute",
          top: 24,
          width: "100%",
          transform: [{ rotateY: backRotate }],
          opacity: backOpacity,
        }}
      >
        <View className="bg-[#F5A623] rounded-3xl px-6 py-6">
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-white/80"
          >
            Your next contribution
          </Text>
          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 36 }}
            className="text-white mt-1"
          >
            GHS {group.myContribution}
          </Text>
          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
            className="text-white/80 mt-1"
          >
            ⏱ Due in {group.daysLeft} days
          </Text>
          <TouchableOpacity
            disabled={hasPaid || isLocked}
            onPress={onMarkAsPaid}
            className={`rounded-full py-3 mt-4 flex-row items-center justify-center ${hasPaid ? "bg-emerald-600" : isLocked ? "bg-white/40" : "bg-white"}`}
          >
            <Text
              style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
              className={
                hasPaid
                  ? "text-white"
                  : isLocked
                    ? "text-white/60"
                    : "text-[#F5A623]"
              }
            >
              {hasPaid ? "✓ Paid" : isLocked ? "🔒 Locked" : "Pay to Admin"}
            </Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// SubscriptionGateModal — blocks dashboard when admin payment is overdue
// ─────────────────────────────────────────────────────────────────────────────

const SubscriptionGateModal = ({
  visible,
  daysOverdue,
  groupId,
  adminPhone,
  adminName,
  myContribution,
  onSuccess,
}: {
  visible: boolean;
  daysOverdue: number;
  groupId: string;
  adminPhone: string;
  adminName: string;
  myContribution: number;
  onSuccess: () => void;
}) => {
  const { colorScheme } = useColorScheme();
  const { popup } = usePaystack();
  const [paying, setPaying] = useState(false);

  // Derive copy based on how many days overdue
  const isHard = daysOverdue >= 4;
  const title = isHard ? "Your group is locked 🔒" : "Payment overdue";
  const body = isHard
    ? "Your group has been locked. Pay to restore access for all members."
    : `Your payment is ${daysOverdue} day${daysOverdue !== 1 ? "s" : ""} overdue. Keep your group running.`;

  // Strip leading zeros and country code for email slug
  const phoneSlug = adminPhone.replace(/^\+/, "").replace(/\s/g, "");
  const email = `${phoneSlug}@poolup.app`;
  const currentUser = auth().currentUser;

  const handlePay = () => {
    setPaying(true);

    // Generate a unique reference
    const reference = `POOLUP-${groupId.slice(0, 8)}-${Date.now()}`;

    popup.checkout({
      email,
      amount: 2000,
      reference,
      channels: ["mobile_money"],
      currency: "GHS",
      phone: currentUser?.phoneNumber?.replace('+233', '0') || '',
      onSuccess: async () => {
        try {
          const now = firestore.Timestamp.now();
          const nextBillingDate = new Date();
          nextBillingDate.setDate(nextBillingDate.getDate() + 30);

          await firestore()
            .collection("groups")
            .doc(groupId)
            .update({
              "subscription.status": "active",
              "subscription.lastPaidAt": now,
              "subscription.nextBillingDate":
                firestore.Timestamp.fromDate(nextBillingDate),
            });

          onSuccess();
        } catch (e) {
          console.error("Failed to update subscription after payment:", e);
        } finally {
          setPaying(false);
        }
      },
      onCancel: () => {
        setPaying(false);
      },
      onError: () => {
        setPaying(false);
      },
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View
        style={{ flex: 1, backgroundColor: "rgba(0,0,0,0.85)" }}
        className="items-center justify-center px-6"
      >
        <View className="bg-white dark:bg-brand-darkCard rounded-3xl w-full p-7 shadow-2xl border border-transparent dark:border-brand-darkBorder">
          {/* Icon */}
          <View className="w-16 h-16 rounded-full bg-red-100 dark:bg-red-900/30 items-center justify-center self-center mb-5">
            <Text style={{ fontSize: 32 }}>⚠️</Text>
          </View>

          <Text
            style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 22 }}
            className="text-gray-800 dark:text-brand-darkTextHigh text-center mb-3"
          >
            {title}
          </Text>

          <Text
            style={{
              fontFamily: "Nunito_400Regular",
              fontSize: 15,
              lineHeight: 22,
            }}
            className="text-gray-500 dark:text-brand-darkTextMed text-center mb-8"
          >
            {body}
          </Text>

          {/* Pay CTA */}
          <TouchableOpacity
            onPress={handlePay}
            disabled={paying}
            className="rounded-full py-4 items-center justify-center bg-[#F5A623]"
          >
            {paying ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
                className="text-white"
              >
                Pay GHS {myContribution} Now
              </Text>
            )}
          </TouchableOpacity>

          <Text
            style={{ fontFamily: "Nunito_400Regular", fontSize: 12 }}
            className="text-gray-400 dark:text-brand-darkTextLow text-center mt-4"
          >
            Secured by Paystack · One-time monthly fee
          </Text>
        </View>
      </View>
    </Modal>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// Dashboard
// ─────────────────────────────────────────────────────────────────────────────

const Dashboard = () => {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [group, setGroup] = useState<Group | null>(null);
  const [loading, setLoading] = useState(true);
  const [gateVisible, setGateVisible] = useState(false);
  const [daysOverdue, setDaysOverdue] = useState(0);

  const { popup } = usePaystack();

  // Get groupId from Zustand store set during create/join
  const groupId = useGroupStore((state) => state.groupId);
  const currentUser = auth().currentUser;

  // ── Pulsing Glow Ring Animation ───────────────────────────────────────────
  const pulseAnim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.loop(
      Animated.timing(pulseAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.out(Easing.ease),
        useNativeDriver: true,
      })
    ).start();
  }, [pulseAnim]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.4],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 0.8, 1],
    outputRange: [0.6, 0.4, 0],
  });

  // ── Sidebar Drawer Animation & State ───────────────────────────────────────
  const { width: screenWidth } = Dimensions.get("window");
  const drawerWidth = screenWidth * 0.75;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerAnim = useRef(new Animated.Value(0)).current;

  const openDrawer = () => {
    setDrawerOpen(true);
    Animated.timing(drawerAnim, {
      toValue: 1,
      duration: 300,
      easing: Easing.out(Easing.ease),
      useNativeDriver: true,
    }).start();
  };

  const closeDrawer = () => {
    Animated.timing(drawerAnim, {
      toValue: 0,
      duration: 250,
      easing: Easing.in(Easing.ease),
      useNativeDriver: true,
    }).start(() => {
      setDrawerOpen(false);
    });
  };

  const drawerTranslateX = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [drawerWidth, 0],
  });

  const overlayOpacity = drawerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 1],
  });

  const getInitials = () => {
    const name = currentUser?.displayName || currentUser?.phoneNumber || "";
    if (!name) return "?";
    if (name.startsWith("+233")) {
      const remaining = name.replace("+233", "");
      return remaining.charAt(0);
    }
    if (name.startsWith("+")) {
      return name.charAt(1);
    }
    const parts = name.split(" ").filter(Boolean);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.charAt(0).toUpperCase();
  };

  // Determine if current user is the admin
  const isAdmin = group?.adminId === currentUser?.uid;

  // ── Sign out ───────────────────────────────────────────────────────────────
  const handleSignOut = () => {
    Alert.alert("Sign out", "Are you sure you want to sign out?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          try {
            await auth().signOut();
            // auth gate in index.tsx will redirect automatically
          } catch (e) {
            console.error("Sign out error:", e);
          }
        },
      },
    ]);
  };

  const handleMemberPayment = () => {
    if (!group || !currentUser) return;

    // Prefill email format: phonenumber@poolup.app (strip leading zeros / + signs / spaces)
    const phone = currentUser.phoneNumber || "";
    const phoneSlug = phone.replace(/^\+/, "").replace(/\s/g, "");
    const email = phoneSlug ? `${phoneSlug}@poolup.app` : "member@poolup.app";

    const amount = group.myContribution;
    const reference = `MEMBER-${group.id.slice(0, 8)}-${currentUser.uid.slice(0, 6)}-${Date.now()}`;

    popup.checkout({
      email,
      amount,
      reference,
      channels: ["mobile_money"],
      currency: "GHS",
      phone: currentUser?.phoneNumber?.replace('+233', '0') || '',
      onSuccess: async () => {
        try {
          const db = firestore();
          const groupRef = db.collection("groups").doc(groupId!);
          const paymentRef = groupRef
            .collection("payments")
            .doc(currentUser.uid);
          const now = firestore.Timestamp.now();

          await db.runTransaction(async (transaction) => {
            const groupDoc = await transaction.get(groupRef);
            if (!groupDoc.exists) throw new Error("Group does not exist");

            const data = groupDoc.data()!;
            const members = data.members || [];

            const updatedMembers = members.map((m: any) => {
              if (m.uid === currentUser.uid) {
                return { ...m, status: "paid" };
              }
              return m;
            });

            const myContribution = Math.round(
              data.savingsGoal / (members.length || 1),
            );

            transaction.update(groupRef, {
              members: updatedMembers,
              totalSaved: (data.totalSaved || 0) + myContribution,
            });

            transaction.set(
              paymentRef,
              {
                memberUid: currentUser.uid,
                memberPhone: phone,
                memberName: currentUser.displayName || phone || "Unknown",
                amount: myContribution,
                status: "paid",
                dueDate: data.nextDueDate || now,
                paidAt: now,
                transactionId: reference, // Set reference as transaction ID
                createdAt: now,
              },
              { merge: true },
            );
          });
        } catch (e) {
          console.error(
            "Failed to record member payment after Paystack success:",
            e,
          );
          Alert.alert(
            "Error",
            "Failed to update payment status on Server. Please contact support.",
          );
        }
      },
      onCancel: () => {
        // Do nothing
      },
      onError: (err) => {
        console.error("Paystack payment error:", err);
        // Do nothing
      },
    });
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
          (dueDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24),
        );

        // Find current user's contribution amount
        // For MVP this is savingsGoal divided equally among members
        const myContribution = Math.round(
          data.savingsGoal / (data.members?.length || 1),
        );

        // ── Subscription check ────────────────────────────────────────────
        let subscription: Subscription | undefined;
        if (data.subscription) {
          const subRaw = data.subscription;
          const billingDate = subRaw.nextBillingDate?.toDate?.() || null;
          if (billingDate) {
            subscription = {
              status: subRaw.status,
              nextBillingDate: billingDate.toLocaleDateString("en-GH", {
                month: "short",
                day: "numeric",
                year: "numeric",
              }),
              nextBillingDateRaw: billingDate,
              lastPaidAt: subRaw.lastPaidAt
                ? subRaw.lastPaidAt.toDate().toLocaleDateString("en-GH")
                : null,
            };

            // Check if overdue — only admin sees the gate
            const msPerDay = 1000 * 60 * 60 * 24;
            const overdueDays = Math.ceil(
              (today.getTime() - billingDate.getTime()) / msPerDay,
            );

            // Show gate only for admin and only when billing date has passed
            const adminUid = data.adminId;
            const isCurrentAdmin = currentUser?.uid === adminUid;

            if (isCurrentAdmin && overdueDays > 0) {
              setDaysOverdue(overdueDays);
              setGateVisible(true);
            } else {
              setGateVisible(false);
            }
          }
        }

        setGroup({
          id: snap.id,
          name: data.name,
          savingsGoal: data.savingsGoal,
          totalSaved: data.totalSaved || 0,
          frequency: data.frequency,
          nextDueDate: dueDate.toLocaleDateString("en-GH", {
            month: "short",
            day: "numeric",
            year: "numeric",
          }),
          daysLeft: Math.max(0, daysLeft),
          members: data.members || [],
          code: data.code,
          adminId: data.adminId,
          myContribution,
          subscription,
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
      (m) => m.status === "pending" || m.status === "missed",
    );
    unpaid.forEach((member) => {
      Linking.openURL(
        `whatsapp://send?phone=${member.phone}&text=Hey ${member.name}! 👋 Just a reminder that your PoolUp contribution for ${group.name} is due. Please pay when you can! 🙏`,
      );
    });
  };

  if (loading || !group) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f0f7f4] dark:bg-brand-darkBg">
        <ActivityIndicator
          color={colorScheme === "dark" ? "#10b981" : "#0d5c45"}
          size="large"
        />
        <Text
          style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
          className="text-emerald-600 dark:text-brand-darkTextMed mt-3"
        >
          Loading your group...
        </Text>
      </View>
    );
  }

  const percentage =
    group.savingsGoal > 0
      ? Math.min(100, Math.round((group.totalSaved / group.savingsGoal) * 100))
      : 0;

  const paidCount = group.members.filter((m) => m.status === "paid").length;
  const pendingCount = group.members.filter(
    (m) => m.status === "pending",
  ).length;
  const missedCount = group.members.filter((m) => m.status === "missed").length;

  const myMemberObject = group.members.find((m) => m.uid === currentUser?.uid);
  const hasPaid = myMemberObject?.status === "paid";

  // Read-only: subscription is overdue for members too (they can view but not pay)
  const subscriptionOverdue = group.subscription?.nextBillingDateRaw
    ? new Date() > group.subscription.nextBillingDateRaw
    : false;

  // Members see a read-only banner; admin sees the blocking modal
  const isReadOnly = !isAdmin && subscriptionOverdue;

  const adminPhone = currentUser?.phoneNumber || "";
  const adminName = currentUser?.displayName || adminPhone;

  return (
    <View className="flex-1 bg-[#f0f7f4] dark:bg-brand-darkBg">
      {/* ── Subscription gate modal (admin only, no close button) ───────── */}
      <SubscriptionGateModal
        visible={gateVisible}
        daysOverdue={daysOverdue}
        groupId={group.id}
        adminPhone={adminPhone}
        adminName={adminName}
        myContribution={group.myContribution}
        onSuccess={() => setGateVisible(false)}
      />

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="px-6 pt-12 pb-10">
          {/* Header */}
          <View className="flex-row items-start justify-between mb-2">
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 26 }}
                className="text-gray-800 dark:text-brand-darkTextHigh"
              >
                {group.name}
              </Text>
              <View className="flex-row flex-wrap gap-2 mt-2">
                <View className="bg-emerald-100 dark:bg-brand-darkCard rounded-full px-3 py-1 flex-row items-center gap-2 border border-transparent dark:border-brand-darkBorder">
                  <Users
                    color={colorScheme === "dark" ? "#34d399" : "#0d5c45"}
                    size={13}
                  />
                  <Text
                    style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13 }}
                    className="text-[#0d5c45] dark:text-emerald-400"
                  >
                    {group.members.length} members
                  </Text>
                </View>
                {isAdmin && (
                  <View className="bg-emerald-100 dark:bg-brand-darkCard rounded-full px-3 py-1 flex-row items-center gap-2 border border-transparent dark:border-brand-darkBorder">
                    <ShieldCheck
                      color={colorScheme === "dark" ? "#34d399" : "#0d5c45"}
                      size={13}
                    />
                    <Text
                      style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13 }}
                      className="text-[#0d5c45] dark:text-emerald-400"
                    >
                      Admin
                    </Text>
                  </View>
                )}
                {/* Invite Members button — admin can reshare the code at any time */}
                {isAdmin && (
                  <TouchableOpacity
                    onPress={() => router.push("/(groups)/invitemembers")}
                    className="bg-emerald-100 dark:bg-brand-darkCard rounded-full px-3 py-1 flex-row items-center gap-2 border border-transparent dark:border-brand-darkBorder"
                  >
                    <UserPlus
                      color={colorScheme === "dark" ? "#34d399" : "#0d5c45"}
                      size={13}
                    />
                    <Text
                      style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13 }}
                      className="text-[#0d5c45] dark:text-emerald-400"
                    >
                      Invite
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Top-right: Avatar with pulsing glow ring */}
            <View className="items-center justify-center relative w-12 h-12">
              <Animated.View
                style={{
                  position: "absolute",
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: "#0F6E56",
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                }}
              />
              <TouchableOpacity
                onPress={openDrawer}
                activeOpacity={0.8}
                className="w-11 h-11 rounded-full bg-[#0F6E56] items-center justify-center shadow-md border-2 border-white dark:border-brand-darkBorder"
              >
                <Text
                  style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16 }}
                  className="text-white"
                >
                  {getInitials()}
                </Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Read-only banner — shown to members when subscription is overdue */}
          {isReadOnly && (
            <View className="bg-red-50 dark:bg-red-900/20 rounded-2xl px-4 py-3 mt-4 flex-row items-center gap-3 border border-red-200 dark:border-red-800">
              <Text style={{ fontSize: 18 }}>🔒</Text>
              <Text
                style={{
                  fontFamily: "Nunito_600SemiBold",
                  fontSize: 13,
                  flex: 1,
                }}
                className="text-red-600 dark:text-red-300"
              >
                Payments paused — the admin needs to renew the group
                subscription.
              </Text>
            </View>
          )}

          {/* Flip card — admin only */}
          {isAdmin && (
            <View className="mt-4 mb-2">
              <FlipCard
                group={group}
                isAdmin={isAdmin}
                hasPaid={hasPaid}
                onMarkAsPaid={handleMemberPayment}
                isLocked={false}
              />
            </View>
          )}

          {/* Member contribution card */}
          {!isAdmin && (
            <View className="bg-[#F5A623] rounded-3xl px-6 py-6 mt-4">
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-white/80"
              >
                Your next contribution
              </Text>
              <Text
                style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 36 }}
                className="text-white mt-1"
              >
                GHS {group.myContribution}
              </Text>
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-white/80 mt-1"
              >
                ⏱ Due in {group.daysLeft} days — {group.nextDueDate}
              </Text>
              <TouchableOpacity
                disabled={hasPaid || isReadOnly}
                onPress={handleMemberPayment}
                className={`rounded-full py-3 mt-4 flex-row items-center justify-center gap-2 ${hasPaid ? "bg-emerald-600" : isReadOnly ? "bg-white/40" : "bg-white"}`}
              >
                <Text
                  style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
                  className={
                    hasPaid
                      ? "text-white"
                      : isReadOnly
                        ? "text-white/60"
                        : "text-[#F5A623]"
                  }
                >
                  {hasPaid
                    ? "✓ Paid"
                    : isReadOnly
                      ? "🔒 Locked"
                      : "Pay to Admin"}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Circular progress */}
          <CircularProgress
            percentage={percentage}
            saved={group.totalSaved}
            goal={group.savingsGoal}
          />

          {/* Admin view */}
          {isAdmin && (
            <>
              <View className="flex-row items-center justify-between mb-4">
                <Text
                  style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18 }}
                  className="text-gray-800 dark:text-brand-darkTextHigh"
                >
                  This month
                </Text>
                <Text
                  style={{ fontFamily: "Nunito_600SemiBold", fontSize: 14 }}
                  className="text-[#0d5c45] dark:text-emerald-400"
                >
                  {paidCount}/{group.members.length} paid
                </Text>
              </View>

              {/* Member avatar row */}
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-6"
              >
                <View className="flex-row gap-4">
                  {group.members.map((member) => (
                    <View key={member.uid} className="items-center">
                      <View className="relative">
                        <View className="w-14 h-14 rounded-full bg-emerald-200 dark:bg-emerald-950/40 items-center justify-center">
                          <Text
                            style={{
                              fontFamily: "Nunito_700Bold",
                              fontSize: 18,
                            }}
                            className="text-[#0d5c45] dark:text-emerald-400"
                          >
                            {(member.name || member.phone || "?")
                              .charAt(0)
                              .toUpperCase()}
                          </Text>
                        </View>
                        <View
                          style={{
                            position: "absolute",
                            bottom: 0,
                            right: 0,
                            width: 16,
                            height: 16,
                            borderRadius: 8,
                            backgroundColor: statusColor(
                              member.status || "pending",
                              colorScheme,
                            ),
                            borderWidth: 2,
                            borderColor:
                              colorScheme === "dark" ? "#121e1a" : "#f0f7f4",
                            alignItems: "center",
                            justifyContent: "center",
                          }}
                        >
                          {member.status === "paid" && (
                            <Text style={{ fontSize: 8, color: "white" }}>
                              ✓
                            </Text>
                          )}
                          {member.status === "missed" && (
                            <Text style={{ fontSize: 8, color: "white" }}>
                              ✕
                            </Text>
                          )}
                        </View>
                      </View>
                      <Text
                        style={{
                          fontFamily: "Nunito_400Regular",
                          fontSize: 12,
                        }}
                        className="text-gray-600 dark:text-brand-darkTextMed mt-1"
                      >
                        {(member.name || member.phone || "?").split(" ")[0]}
                      </Text>
                    </View>
                  ))}
                </View>
              </ScrollView>

              {/* Due date card */}
              <View className="bg-amber-50 dark:bg-brand-darkCard rounded-2xl px-4 py-4 flex-row items-center justify-between mb-6 border border-transparent dark:border-brand-darkBorder">
                <View className="flex-row items-center gap-3">
                  <View className="w-12 h-12 rounded-full bg-[#F5A623] items-center justify-center">
                    <Bell color="white" size={20} />
                  </View>
                  <View>
                    <Text
                      style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
                      className="text-gray-800 dark:text-brand-darkTextHigh"
                    >
                      Next due date
                    </Text>
                    <Text
                      style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
                      className="text-[#0d5c45] dark:text-emerald-400"
                    >
                      {group.nextDueDate} — {group.daysLeft} days left
                    </Text>
                  </View>
                </View>
                <View className="w-10 h-10 rounded-full bg-[#F5A623] items-center justify-center">
                  <Text
                    style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }}
                    className="text-white"
                  >
                    {group.daysLeft}d
                  </Text>
                </View>
              </View>

              {/* Paid / pending / missed summary */}
              <View className="flex-row gap-3 mb-6">
                <View className="flex-1 bg-emerald-50 dark:bg-brand-darkCard rounded-2xl py-4 items-center border border-transparent dark:border-brand-darkBorder">
                  <Text
                    style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }}
                    className="text-emerald-500 dark:text-emerald-400"
                  >
                    {paidCount}
                  </Text>
                  <Text
                    style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
                    className="text-gray-500 dark:text-brand-darkTextLow mt-1"
                  >
                    Paid
                  </Text>
                </View>
                <View className="flex-1 bg-amber-50 dark:bg-brand-darkCard rounded-2xl py-4 items-center border border-transparent dark:border-brand-darkBorder">
                  <Text
                    style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }}
                    className="text-[#F5A623]"
                  >
                    {pendingCount}
                  </Text>
                  <Text
                    style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
                    className="text-gray-500 dark:text-brand-darkTextLow mt-1"
                  >
                    Pending
                  </Text>
                </View>
                <View className="flex-1 bg-red-50 dark:bg-brand-darkCard rounded-2xl py-4 items-center border border-transparent dark:border-brand-darkBorder">
                  <Text
                    style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }}
                    className="text-red-400 dark:text-red-300"
                  >
                    {missedCount}
                  </Text>
                  <Text
                    style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
                    className="text-gray-500 dark:text-brand-darkTextLow mt-1"
                  >
                    Missed
                  </Text>
                </View>
              </View>

              {/* Nudge button */}
              <TouchableOpacity
                onPress={handleNudge}
                className="bg-[#0d5c45] dark:bg-brand-greenLight rounded-full py-4 flex-row items-center justify-center gap-3 mb-4"
              >
                <Bell color="white" size={20} />
                <Text
                  style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
                  className="text-white"
                >
                  Nudge unpaid members
                </Text>
              </TouchableOpacity>
            </>
          )}

          {/* Member view */}
          {!isAdmin && (
            <>
              <View className="flex-row items-center justify-between mb-4">
                <Text
                  style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 18 }}
                  className="text-gray-800 dark:text-brand-darkTextHigh"
                >
                  Pool members
                </Text>
                <Text
                  style={{ fontFamily: "Nunito_600SemiBold", fontSize: 14 }}
                  className="text-[#0d5c45] dark:text-emerald-400"
                >
                  {paidCount}/{group.members.length} paid
                </Text>
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                className="mb-6"
              >
                <View className="flex-row gap-4">
                  {group.members.map((member) => (
                    <View key={member.uid} className="relative">
                      <View className="w-14 h-14 rounded-full bg-emerald-200 dark:bg-emerald-950/40 items-center justify-center">
                        <Text
                          style={{ fontFamily: "Nunito_700Bold", fontSize: 18 }}
                          className="text-[#0d5c45] dark:text-emerald-400"
                        >
                          {(member.name || member.phone || "?")
                            .charAt(0)
                            .toUpperCase()}
                        </Text>
                      </View>
                      <View
                        style={{
                          position: "absolute",
                          bottom: 0,
                          right: 0,
                          width: 14,
                          height: 14,
                          borderRadius: 7,
                          backgroundColor: statusColor(
                            member.status || "pending",
                            colorScheme,
                          ),
                          borderWidth: 2,
                          borderColor:
                            colorScheme === "dark" ? "#121e1a" : "#f0f7f4",
                        }}
                      />
                    </View>
                  ))}
                </View>
              </ScrollView>
            </>
          )}
        </View>
      </ScrollView>

      {/* ── Sidebar Drawer ───────── */}
      {drawerOpen && (
        <View style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 9999 }}>
          {/* Overlay */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0,0,0,0.5)",
              opacity: overlayOpacity,
            }}
          >
            <Pressable style={{ flex: 1 }} onPress={closeDrawer} />
          </Animated.View>

          {/* Drawer Panel */}
          <Animated.View
            style={{
              position: "absolute",
              top: 0,
              right: 0,
              bottom: 0,
              width: drawerWidth,
              transform: [{ translateX: drawerTranslateX }],
            }}
            className="bg-white dark:bg-brand-darkCard border-l border-gray-100 dark:border-brand-darkBorder pt-16"
          >
            {/* Header / Profile */}
            <View className="items-center mb-6 px-6">
              <View className="w-16 h-16 rounded-full bg-[#0F6E56] items-center justify-center mb-3">
                <Text
                  style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 24 }}
                  className="text-white"
                >
                  {getInitials()}
                </Text>
              </View>
              <Text
                style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }}
                className="text-gray-800 dark:text-brand-darkTextHigh text-center"
              >
                {currentUser?.displayName || "User"}
              </Text>
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
                className="text-gray-500 dark:text-brand-darkTextLow mt-1 text-center"
              >
                {currentUser?.phoneNumber || "No phone number"}
              </Text>
            </View>

            {/* Divider */}
            <View className="h-px bg-gray-100 dark:bg-brand-darkBorder mb-4 mx-6" />

            {/* Dark Mode Toggle */}
            <View className="flex-row items-center justify-between h-[56px] px-6">
              <View className="flex-row items-center gap-3">
                {colorScheme === "dark" ? (
                  <Sun color="#F5A623" size={20} />
                ) : (
                  <Moon color="#0d5c45" size={20} />
                )}
                <Text
                  style={{ fontFamily: "Nunito_600SemiBold", fontSize: 16 }}
                  className="text-gray-700 dark:text-brand-darkTextHigh"
                >
                  {colorScheme === "dark" ? "Light Mode" : "Dark Mode"}
                </Text>
              </View>
              <Switch
                value={colorScheme === "dark"}
                onValueChange={toggleColorScheme}
                trackColor={{ false: "#d1fae5", true: "#0d5c45" }}
                thumbColor={colorScheme === "dark" ? "#34d399" : "#ffffff"}
              />
            </View>

            {/* Payment Records (Admin Only) */}
            {isAdmin && (
              <TouchableOpacity
                onPress={() => {
                  closeDrawer();
                  router.push("/(home)/paymenthistory");
                }}
                className="flex-row items-center gap-3 h-[56px] px-6"
              >
                <ClipboardList
                  color={colorScheme === "dark" ? "#34d399" : "#0d5c45"}
                  size={20}
                />
                <Text
                  style={{ fontFamily: "Nunito_600SemiBold", fontSize: 16 }}
                  className="text-gray-700 dark:text-brand-darkTextHigh"
                >
                  Payment Records
                </Text>
              </TouchableOpacity>
            )}

            {/* Subscription Info (Admin Only) */}
            {isAdmin && group.subscription?.nextBillingDate && (
              <View className="flex-row items-center gap-3 h-[56px] px-6">
                <Bell
                  color={colorScheme === "dark" ? "#34d399" : "#0d5c45"}
                  size={20}
                />
                <View>
                  <Text
                    style={{ fontFamily: "Nunito_600SemiBold", fontSize: 14 }}
                    className="text-gray-700 dark:text-brand-darkTextHigh"
                  >
                    Subscription
                  </Text>
                  <Text
                    style={{ fontFamily: "Nunito_400Regular", fontSize: 12 }}
                    className="text-gray-400 dark:text-brand-darkTextLow"
                  >
                    Next billing: {group.subscription.nextBillingDate}
                  </Text>
                </View>
              </View>
            )}

            {/* Sign Out (At the bottom) */}
            <TouchableOpacity
              onPress={() => {
                closeDrawer();
                handleSignOut();
              }}
              className="flex-row items-center gap-3 h-[56px] px-6 mt-auto mb-8"
            >
              <LogOut color="#ef4444" size={20} />
              <Text
                style={{ fontFamily: "Nunito_600SemiBold", fontSize: 16 }}
                className="text-red-500 dark:text-red-400"
              >
                Sign out
              </Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      )}
    </View>
  );
};

export default Dashboard;
