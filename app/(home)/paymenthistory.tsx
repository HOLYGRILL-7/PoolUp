import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Animated,
  ActivityIndicator,
  Alert,
} from "react-native";
import React, { useEffect, useRef, useState } from "react";
import { useRouter } from "expo-router";
import {
  Moon,
  Sun,
  CheckCircle,
  Clock,
  XCircle,
  Receipt,
  ChevronLeft,
  FileDown,
} from "lucide-react-native";
import firestore from "@react-native-firebase/firestore";
import auth from "@react-native-firebase/auth";
import { useGroupStore } from "../../store/groupstore";
import { useColorScheme } from "nativewind";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";

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
const statusConfig = (status: string, colorScheme?: string) => {
  const isDark = colorScheme === "dark";
  if (status === "paid")
    return {
      label: "Paid",
      color: isDark ? "#4ade80" : "#22c55e",
      bg: isDark ? "#064e3b" : "#f0fdf4",
      border: isDark ? "#065f46" : "#bbf7d0",
      icon: <CheckCircle color={isDark ? "#4ade80" : "#22c55e"} size={14} />,
    };
  if (status === "pending")
    return {
      label: "Pending",
      color: isDark ? "#fbbf24" : "#F5A623",
      bg: isDark ? "#78350f" : "#fffbeb",
      border: isDark ? "#92400e" : "#fde68a",
      icon: <Clock color={isDark ? "#fbbf24" : "#F5A623"} size={14} />,
    };
  return {
    label: "Missed",
    color: isDark ? "#fca5a5" : "#ef4444",
    bg: isDark ? "#7f1d1d" : "#fef2f2",
    border: isDark ? "#991b1b" : "#fecaca",
    icon: <XCircle color={isDark ? "#fca5a5" : "#ef4444"} size={14} />,
  };
};

// Each payment row is tappable — if it has a receipt it expands
// to show transaction details. Animated height goes from 0 to 130.
const PaymentRow = ({ payment }: { payment: Payment }) => {
  const { colorScheme } = useColorScheme();
  const [expanded, setExpanded] = useState(false);
  const expandAnim = useRef(new Animated.Value(0)).current;
  const config = statusConfig(payment.status, colorScheme);

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
        style={{ backgroundColor: colorScheme === "dark" ? "#1b2e27" : "white", padding: 16 }}
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
                className="text-gray-700 dark:text-brand-darkTextHigh"
              >
                {payment.name.charAt(0).toUpperCase()}
              </Text>
            </View>

            {/* Name + date */}
            <View className="flex-1">
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 15 }}
                className="text-gray-800 dark:text-brand-darkTextHigh"
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
              className="text-gray-800 dark:text-brand-darkTextHigh"
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
            backgroundColor: colorScheme === "dark" ? "#142720" : "#f0fdf4",
            borderTopWidth: 1,
            borderTopColor: colorScheme === "dark" ? "#1f3c31" : "#bbf7d0",
          }}
        >
          <View className="px-4 py-3 gap-2">
            <View className="flex-row items-center gap-2 mb-1">
              <Receipt color={colorScheme === "dark" ? "#34d399" : "#0d5c45"} size={14} />
              <Text
                style={{ fontFamily: "Nunito_700Bold", fontSize: 13 }}
                className="text-[#0d5c45] dark:text-emerald-400"
              >
                Receipt #{payment.receipt.receiptNo}
              </Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-emerald-500 dark:text-[#7ba08d]">Method</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-700 dark:text-brand-darkTextHigh">{payment.receipt.method}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-emerald-500 dark:text-[#7ba08d]">Reference</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-700 dark:text-brand-darkTextHigh">{payment.receipt.reference}</Text>
            </View>
            <View className="flex-row justify-between">
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-emerald-500 dark:text-[#7ba08d]">Timestamp</Text>
              <Text style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }} className="text-gray-700 dark:text-brand-darkTextHigh">{payment.receipt.timestamp}</Text>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

// ─────────────────────────────────────────────────────────────────────────────
// buildPdfHtml — produces a fully-styled HTML string for expo-print.
// All styles are inlined because WebKit's PDF renderer ignores external sheets.
// ─────────────────────────────────────────────────────────────────────────────

const buildPdfHtml = (
  groupName: string,
  month: string,
  payments: Payment[],
  totalCollected: number,
  remaining: number,
  savingsGoal: number,
) => {
  const exportedAt = new Date().toLocaleString("en-GH", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const statusBadge = (status: string) => {
    const map: Record<string, { bg: string; color: string; label: string }> = {
      paid:    { bg: "#d1fae5", color: "#065f46", label: "Paid" },
      pending: { bg: "#fef3c7", color: "#92400e", label: "Pending" },
      missed:  { bg: "#fee2e2", color: "#991b1b", label: "Missed" },
    };
    const s = map[status] ?? map.pending;
    return `<span style="background:${s.bg};color:${s.color};padding:3px 10px;border-radius:12px;font-size:11px;font-weight:700;">${s.label}</span>`;
  };

  const rows = payments.map((p, i) => {
    const ref = p.receipt?.reference ?? "—";
    const bg = i % 2 === 0 ? "#ffffff" : "#f8fdf9";
    return `
      <tr style="background:${bg};">
        <td style="padding:10px 14px;font-size:13px;color:#1f2937;">${p.name}</td>
        <td style="padding:10px 14px;font-size:13px;color:#1f2937;font-weight:700;">GHS ${p.amount.toLocaleString()}</td>
        <td style="padding:10px 14px;text-align:center;">${statusBadge(p.status)}</td>
        <td style="padding:10px 14px;font-size:12px;color:#374151;">${p.date}</td>
        <td style="padding:10px 14px;font-size:11px;color:#6b7280;font-family:monospace;">${ref}</td>
      </tr>
    `;
  }).join("");

  const progressPct = savingsGoal > 0
    ? Math.min(100, Math.round((totalCollected / savingsGoal) * 100))
    : 0;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PoolUp — ${groupName} Payment Report</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, Arial, sans-serif; background: #f0f7f4; color: #1f2937; }
    .page { max-width: 720px; margin: 0 auto; background: #ffffff; }

    /* ── Header ── */
    .header {
      background: linear-gradient(135deg, #0d5c45 0%, #1a7a60 100%);
      padding: 36px 40px 28px;
      color: white;
    }
    .header-top { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; }
    .logo-mark {
      width: 44px; height: 44px; background: rgba(255,255,255,0.15);
      border-radius: 12px; display: flex; align-items: center; justify-content: center;
      font-size: 22px;
    }
    .brand { font-size: 13px; font-weight: 700; letter-spacing: 2px; opacity: 0.8; text-transform: uppercase; }
    .group-title { font-size: 28px; font-weight: 800; margin-bottom: 6px; }
    .report-sub {
      font-size: 13px; opacity: 0.75;
      display: flex; gap: 16px; flex-wrap: wrap;
    }
    .report-sub span::before { content: "•"; margin-right: 6px; opacity: 0.5; }
    .report-sub span:first-child::before { content: ""; margin-right: 0; }

    /* ── Summary cards ── */
    .summary { display: flex; gap: 16px; padding: 24px 40px; background: #f0f7f4; }
    .card {
      flex: 1; background: white; border-radius: 12px;
      padding: 16px 20px; border: 1px solid #d1fae5;
    }
    .card-value { font-size: 20px; font-weight: 800; }
    .card-label { font-size: 12px; color: #6b7280; margin-top: 3px; font-weight: 500; }
    .card.green .card-value { color: #065f46; }
    .card.amber .card-value { color: #D97706; }
    .card.teal  .card-value { color: #0d5c45; }

    /* ── Progress bar ── */
    .progress-wrap { padding: 0 40px 20px; background: #f0f7f4; }
    .progress-label { font-size: 12px; color: #374151; margin-bottom: 6px; font-weight: 600; }
    .progress-track { background: #d1fae5; border-radius: 999px; height: 10px; overflow: hidden; }
    .progress-fill  { height: 10px; background: linear-gradient(90deg,#0d5c45,#34d399); border-radius: 999px; }

    /* ── Table ── */
    .table-wrap { padding: 24px 40px 0; }
    .section-title {
      font-size: 13px; font-weight: 700; letter-spacing: 1px;
      color: #0d5c45; text-transform: uppercase; margin-bottom: 12px;
    }
    table { width: 100%; border-collapse: collapse; border-radius: 12px; overflow: hidden; border: 1px solid #e5e7eb; }
    thead tr { background: #0d5c45; }
    thead th {
      padding: 11px 14px; text-align: left; font-size: 11px;
      font-weight: 700; letter-spacing: 0.5px; color: rgba(255,255,255,0.9);
      text-transform: uppercase;
    }
    tbody tr { border-bottom: 1px solid #f3f4f6; }
    tbody tr:last-child { border-bottom: none; }

    /* ── Footer summary ── */
    .totals { padding: 20px 40px; background: #f8fdf9; border-top: 2px solid #d1fae5; display: flex; justify-content: flex-end; gap: 40px; }
    .total-item { text-align: right; }
    .total-label { font-size: 11px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.5px; }
    .total-value { font-size: 18px; font-weight: 800; margin-top: 2px; }
    .total-value.green { color: #065f46; }
    .total-value.amber { color: #D97706; }

    /* ── Footer ── */
    .footer { padding: 20px 40px 28px; text-align: center; }
    .footer p { font-size: 11px; color: #9ca3af; }
    .footer strong { color: #0d5c45; }
    .divider { height: 1px; background: #e5e7eb; margin: 16px 0; }
  </style>
</head>
<body>
<div class="page">

  <!-- Header -->
  <div class="header">
    <div class="header-top">
      <div class="logo-mark">💰</div>
      <span class="brand">PoolUp</span>
    </div>
    <div class="group-title">${groupName}</div>
    <div class="report-sub">
      <span>${month} Payment Report</span>
      <span>Exported ${exportedAt}</span>
    </div>
  </div>

  <!-- Summary cards -->
  <div class="summary">
    <div class="card green">
      <div class="card-value">GHS ${totalCollected.toLocaleString()}</div>
      <div class="card-label">Total Collected</div>
    </div>
    <div class="card amber">
      <div class="card-value">GHS ${remaining.toLocaleString()}</div>
      <div class="card-label">Remaining</div>
    </div>
    <div class="card teal">
      <div class="card-value">GHS ${savingsGoal.toLocaleString()}</div>
      <div class="card-label">Savings Goal</div>
    </div>
  </div>

  <!-- Progress bar -->
  <div class="progress-wrap">
    <div class="progress-label">${progressPct}% of goal reached</div>
    <div class="progress-track">
      <div class="progress-fill" style="width:${progressPct}%;"></div>
    </div>
  </div>

  <!-- Payment table -->
  <div class="table-wrap">
    <div class="section-title">Payment Records — ${payments.length} member${payments.length !== 1 ? "s" : ""}</div>
    <table>
      <thead>
        <tr>
          <th>Member</th>
          <th>Amount</th>
          <th style="text-align:center;">Status</th>
          <th>Date</th>
          <th>Transaction Ref</th>
        </tr>
      </thead>
      <tbody>
        ${rows || '<tr><td colspan="5" style="text-align:center;padding:20px;color:#9ca3af;">No payments recorded yet</td></tr>'}
      </tbody>
    </table>
  </div>

  <!-- Totals row -->
  <div class="totals">
    <div class="total-item">
      <div class="total-label">Collected</div>
      <div class="total-value green">GHS ${totalCollected.toLocaleString()}</div>
    </div>
    <div class="total-item">
      <div class="total-label">Outstanding</div>
      <div class="total-value amber">GHS ${remaining.toLocaleString()}</div>
    </div>
  </div>

  <!-- Footer -->
  <div class="footer">
    <div class="divider"></div>
    <p>Generated by <strong>PoolUp</strong> · Secure group savings for Ghana</p>
    <p style="margin-top:4px;">This document is for record-keeping purposes only.</p>
  </div>

</div>
</body>
</html>`;
};

const PaymentHistory = () => {
  const router = useRouter();
  const { colorScheme, toggleColorScheme } = useColorScheme();
  const [filter, setFilter] = useState<FilterType>("All");
  const [payments, setPayments] = useState<Payment[]>([]);
  const [groupName, setGroupName] = useState("");
  const [savingsGoal, setSavingsGoal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  const groupId = useGroupStore((state) => state.groupId);

  // Reactive auth — resolves the user after Firebase restores the session
  const [currentUser, setCurrentUser] = useState(() => auth().currentUser);
  useEffect(() => {
    const unsub = auth().onAuthStateChanged((u) => setCurrentUser(u));
    return unsub;
  }, []);

  useEffect(() => {
    // If groupId is not yet in the store (cold-start), fall back to a
    // Firestore lookup using the current user's UID.
    if (!groupId) {
      if (!currentUser) {
        setLoading(false);
        return;
      }
      firestore()
        .collection("groups")
        .where("memberIds", "array-contains", currentUser.uid)
        .limit(1)
        .get()
        .then((snapshot) => {
          if (!snapshot.empty) {
            const doc = snapshot.docs[0];
            const data = doc.data();
            useGroupStore.getState().setGroup(doc.id, data.code, data.name);
            // groupId change re-triggers this effect with the real id
          } else {
            setLoading(false);
          }
        })
        .catch(() => setLoading(false));
      return;
    }

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
  }, [groupId, currentUser]);

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

  // ── Export PDF ─────────────────────────────────────────────────────────────
  // Generates a branded HTML document, converts it to a PDF with expo-print,
  // then opens the share sheet with expo-sharing.
  // The PDF always exports ALL payments (not just the filtered view) so the
  // report is a complete record of the month.
  const handleExport = async () => {
    if (exporting) return;
    setExporting(true);

    try {
      const isAvailable = await Sharing.isAvailableAsync();
      if (!isAvailable) {
        Alert.alert("Sharing not available", "Your device does not support file sharing.");
        return;
      }

      const html = buildPdfHtml(
        groupName,
        currentMonth,
        payments,          // export all, not just filtered
        totalCollected,
        remaining,
        savingsGoal,
      );

      const { uri } = await Print.printToFileAsync({
        html,
        base64: false,
      });

      const fileName = `PoolUp_${groupName.replace(/\s+/g, "_")}_${new Date().toISOString().slice(0, 7)}.pdf`;

      await Sharing.shareAsync(uri, {
        mimeType: "application/pdf",
        dialogTitle: `Share ${fileName}`,
        UTI: "com.adobe.pdf",
      });
    } catch (err) {
      console.error("PDF export failed:", err);
      Alert.alert("Export failed", "Could not generate the PDF. Please try again.");
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <View className="flex-1 items-center justify-center bg-[#f0f7f4] dark:bg-brand-darkBg">
        <ActivityIndicator color={colorScheme === "dark" ? "#10b981" : "#0d5c45"} size="large" />
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-[#f0f7f4] dark:bg-brand-darkBg" showsVerticalScrollIndicator={false}>
      <View className="px-6 pt-12 pb-10">
        {/* Top nav row: back button + export button */}
        <View className="flex-row items-center justify-between mb-4">
          <TouchableOpacity
            onPress={() => router.back()}
            className="w-12 h-12 rounded-full bg-white dark:bg-brand-darkCard items-center justify-center border border-transparent dark:border-brand-darkBorder shadow-sm"
          >
            <ChevronLeft color={colorScheme === "dark" ? "#34d399" : "#0d5c45"} size={24} />
          </TouchableOpacity>

          {/* Export PDF button */}
          <TouchableOpacity
            onPress={handleExport}
            disabled={exporting || payments.length === 0}
            style={{
              flexDirection: "row",
              alignItems: "center",
              gap: 6,
              paddingHorizontal: 16,
              paddingVertical: 10,
              borderRadius: 24,
              backgroundColor:
                exporting || payments.length === 0
                  ? colorScheme === "dark" ? "#1b2e27" : "#e5e7eb"
                  : "#0d5c45",
            }}
          >
            {exporting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <FileDown
                size={16}
                color={
                  payments.length === 0
                    ? colorScheme === "dark" ? "#4b5563" : "#9ca3af"
                    : "#fff"
                }
              />
            )}
            <Text
              style={{
                fontFamily: "Nunito_700Bold",
                fontSize: 14,
                color:
                  exporting || payments.length === 0
                    ? colorScheme === "dark" ? "#4b5563" : "#9ca3af"
                    : "#fff",
              }}
            >
              {exporting ? "Exporting…" : "Export PDF"}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Header */}
        <View className="flex-row items-start justify-between mb-1">
          <View>
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 28 }}
              className="text-gray-800 dark:text-brand-darkTextHigh"
            >
              Payment History
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 14 }}
              className="text-emerald-600 dark:text-brand-darkTextMed mt-1"
            >
              {groupName} · {currentMonth}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleColorScheme}
            className="w-12 h-12 rounded-full bg-white dark:bg-brand-darkCard items-center justify-center border border-transparent dark:border-brand-darkBorder"
          >
            {colorScheme === "dark" ? (
              <Sun color="#F5A623" size={20} />
            ) : (
              <Moon color="#0d5c45" size={20} />
            )}
          </TouchableOpacity>
        </View>

        {/* Summary cards */}
        <View className="flex-row gap-3 mt-6 mb-6">
          <View className="flex-1 bg-emerald-100 dark:bg-brand-darkCard rounded-2xl px-4 py-4 border border-transparent dark:border-brand-darkBorder">
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }}
              className="text-[#0d5c45] dark:text-emerald-400"
            >
              GHS {totalCollected.toLocaleString()}
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
              className="text-emerald-600 dark:text-brand-darkTextMed mt-1"
            >
              Total collected
            </Text>
          </View>
          <View className="flex-1 bg-amber-50 dark:bg-brand-darkCard rounded-2xl px-4 py-4 border border-transparent dark:border-brand-darkBorder">
            <Text
              style={{ fontFamily: "Nunito_800ExtraBold", fontSize: 20 }}
              className="text-[#F5A623]"
            >
              GHS {remaining.toLocaleString()}
            </Text>
            <Text
              style={{ fontFamily: "Nunito_400Regular", fontSize: 13 }}
              className="text-amber-500 dark:text-brand-darkTextMed mt-1"
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
                backgroundColor: filter === f
                  ? (colorScheme === "dark" ? "#2e8b71" : "#0d5c45")
                  : (colorScheme === "dark" ? "#1b2e27" : "white"),
                borderWidth: colorScheme === "dark" ? 1 : 0,
                borderColor: "#2c473d",
              }}
            >
              <Text
                style={{
                  fontFamily: "Nunito_600SemiBold",
                  fontSize: 14,
                  color: filter === f ? "white" : (colorScheme === "dark" ? "#a3bdae" : "#6b7280"),
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
              className="text-gray-400 dark:text-brand-darkTextLow"
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