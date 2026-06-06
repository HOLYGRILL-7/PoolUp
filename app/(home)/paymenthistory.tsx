import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import { Moon, CheckCircle, Clock, XCircle, Receipt } from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";
import { useGroupStore } from "../../store/groupstore";

type FilterType = "All" | "Paid" | "Pending" | "Missed";

type Payment = {
  id: string;
  name: string;
  amount: number;
  status: "paid" | "pending" | "missed";
  date: string;
  receipt: {
    method: string;
    reference: string;
    timestamp: string;
    receiptNo: string;
  } | null;
};

// Maps status string to colors, backgrounds, borders, and icons
// Used in both the row badge and the expandable receipt border
const statusConfig = (status: string) => {
  if (status === "paid")
    return {
      label: "Paid",
      color: "#22c55e",
      bg: "#f0fdf4",
      border: "#bbf7d0",
      icon: <CheckCircle color="#22c55e" size={14} />,
    };
  if (status === "pending")
    return {
      label: "Pending",
      color: "#F5A623",
      bg: "#fffbeb",
      border: "#fde68a",
      icon: <Clock color="#F5A623" size={14} />,
    };
  return {
    label: "Missed",
    color: "#ef4444",
    bg: "#fef2f2",
    border: "#fecaca",
    icon: <XCircle color="#ef4444" size={14} />,
  };
};

// Each payment row is tappable — if it has a receipt it expands
// to show transaction details. Animated height goes from 0 to 130.
const PaymentRow = ({ payment }: { payment: Payment }) => {
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const config = statusConfig(payment.status);

  const toggleExpand = () => {
    if (!payment.receipt) return;
    const toValue = expanded ? 0 : 1;
    setExpanded(!expanded);
    Animated.timing(expandAnim, {
      toValue,
      duration: 300,
      useNativeDriver: false,
    }).start();
  };

  const receiptHeight = expandAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 130],
  });

  return (
    <View
      style={{
        borderWidth: 1.5,
        borderColor: config.border,
        borderRadius: 16,
        overflow: "hidden",
        marginBottom: 12,
      }}
    >
      {/* Main row */}
      <TouchableOpacity
        onPress={toggleExpand}
        activeOpacity={payment.receipt ? 0.7 : 1}
        style={{ backgroundColor: "white", padding: 16 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-3 flex-1">
            {/* Avatar */}
            <View
              className="w-12 h-12 rounded-full items-center justify-center"
              style={{ backgroundColor: config.bg }}
            >
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 16 }}
                className="text-gray-700"
              >
                {payment.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Name + date */}
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
                className="text-gray-800"
              >
                {payment.name}
              </Text>
              <Text
                style={{ fontFamily: "Nunito_400Regular", fontSize: 13, color: config.color }}
              >
                {payment.date}
              </Text>
            </View>
          </View>

          {/* Amount + status badge */}
          <View className="items-end gap-2">
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 16 }}
              className="text-gray-800"
            >
              GHS {payment.amount}
            </Text>
            <View
              style={{
                backgroundColor: config.bg,
                borderWidth: 1,
                borderColor: config.border,
                borderRadius: 20,
                paddingHorizontal: 10,
                paddingVertical: 4,
                flexDirection: "row",
                alignItems: "center",
                gap: 4,
              }}
            >
              {config.icon}
              <Text
                style={{ fontFamily: "Nunito_600SemiBold", fontSize: 13, color: config.color }}
              >
                {config.label}
              </Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>

      {/* Expandable receipt — only renders if payment has a receipt */}
      {payment.receipt && (
        <Animated.View
          style={{
            height: receiptHeight,
            overflow: "hidden",
            backgroundColor: "#f0fdf4",
            borderTopWidth: 1,
            borderTopColor: "#bbf7d0",
          }}
        >
          <View className="px-4 py-3 gap-2">
            <View className="flex-row items-center gap-2 mb-1">
              <Receipt color="#0d5c45" size={14} />
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }}
                className="text-[#0d5c45]"
              >
                Receipt #{payment.receipt.receiptNo}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-emerald-500">Method</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-700">{payment.receipt.method}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-emerald-500">Reference</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-700">{payment.receipt.reference}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-emerald-500">Timestamp</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-700">{payment.receipt.timestamp}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const PaymentHistory = () => {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterType>("All");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [groupName, setGroupName] = useState("");
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [loading, setLoading] = useState(true);

  const groupId = useGroupStore((state) => state.groupId);

  useEffect(() => {
    if (!groupId) return;

    // Listen to group document for name and savings goal
    const unsubGroup = firestore()
      .collection("groups")
      .doc(groupId)
      .onSnapshot((snap) => {
        if (!snap.exists) return;
        const data = snap.data()!;
        setGroupName(data.name);
        setSavingsGoal(data.savingsGoal);
      });

    // Listen to payments subcollection in real time
    // Structure: groups/{groupId}/payments/{paymentId}
    // Ordered newest first so most recent payments show at top
    const unsubPayments = firestore()
      .collection("groups")
      .doc(groupId)
      .collection("payments")
      .orderBy("createdAt", "desc")
      .onSnapshot((snap) => {
        const data = snap.docs.map((doc) => {
          const d = doc.data();

          // Format the date depending on whether payment is done or pending
          const date = d.paidAt
            ? d.paidAt.toDate().toLocaleDateString("en-GH", {
                month: "short", day: "numeric", year: "numeric",
              })
            : d.dueDate
            ? `Due ${d.dueDate.toDate().toLocaleDateString("en-GH", {
                month: "short", day: "numeric",
              })}`
            : "—";

          // Build receipt object only if a transaction ID was provided
          // transactionId is entered by the member when they mark as paid
          const receipt = d.transactionId
            ? {
                method: `Mobile Money · ${d.memberPhone?.slice(-4).padStart(d.memberPhone?.length, "•")}`,
                reference: d.transactionId,
                timestamp: d.paidAt?.toDate().toLocaleString("en-GH") || "—",
                receiptNo: `MP-${doc.id.slice(0, 8).toUpperCase()}`,
              }
            : null;

          return {
            id: doc.id,
            name: d.memberName || d.memberPhone || "Unknown",
            amount: d.amount,
            status: d.status,
            date,
            receipt,
          } as Payment;
        });

        setPayments(data);
        setLoading(false);
      });

    return () => {
      unsubGroup();
      unsubPayments();
    };
  }, [groupId]);

  const totalCollected = payments
    .filter((p) => p.status === "paid")
    .reduce((sum, p) => sum + p.amount, 0);

  const remaining = Math.max(0, savingsGoal - totalCollected);

  const filtered = payments.filter((p) => {
    if (filter === "All") return true;
    return p.status === filter.toLowerCase();
  });

  const filters: FilterType[] = ["All", "Paid", "Pending", "Missed"];

  const currentMonth = new Date().toLocaleDateString("en-GH", {
    month: "long", year: "numeric",
  });

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f0f7f4]">
        <ActivityIndicator color="#0d5c45" size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#f0f7f4]" showsVerticalScrollIndicator={false}>
      <View className="px-6 pt-12 pb-10">

        {/* Header */}
        <View className="flex-row items-start justify-between mb-1">
          <View>
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }}
              className="text-gray-800"
            >
              Payment History
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-emerald-600 mt-1"
            >
              {groupName} · {currentMonth}
            </Text>
          </View>
          <TouchableOpacity className="w-12 h-12 rounded-full bg-white items-center justify-center">
            <Moon color="#0d5c45" size={20} />
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View className="flex-row gap-3 mt-6 mb-6">
          <View className="flex-1 bg-emerald-100 rounded-2xl px-4 py-4">
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }}
              className="text-[#0d5c45]"
            >
              GHS {totalCollected.toLocaleString()}
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
              className="text-emerald-600 mt-1"
            >
              Total collected
            </Text>
          </View>
          <View className="flex-1 bg-amber-50 rounded-2xl px-4 py-4">
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }}
              className="text-[#F5A623]"
            >
              GHS {remaining.toLocaleString()}
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
              className="text-amber-500 mt-1"
            >
              Remaining
            </Text>
          </View>
        </View>

        {/* Filter tabs */}
        <View className="flex-row gap-2 mb-6">
          {filters.map((f) => (
            <TouchableOpacity
              key={f}
              onPress={() => setFilter(f)}
              style={{
                paddingHorizontal: 16,
                paddingVertical: 8,
                borderRadius: 20,
                backgroundColor: filter === f ? "#0d5c45" : "white",
              }}
            >
              <Text
                style={{
                  fontFamily: "Nunito_600SemiBold",
                  fontSize: 14,
                  color: filter === f ? "white" : "#6b7280",
                }}
              >
                {f}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Payment list */}
        {filtered.length === 0 ? (
          <View className="items-center py-10">
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 15 }}
              className="text-gray-400"
            >
              No {filter.toLowerCase()} payments yet
            </Text>
          </View>
        ) : (
          filtered.map((payment) => (
            <PaymentRow key={payment.id} payment={payment} />
          ))
        )}

      </View>
    </ScrollView>
  );
};

export default PaymentHistory;