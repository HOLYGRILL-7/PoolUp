import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import axios from "axios";

admin.initializeApp();
const db = admin.firestore();

// ─────────────────────────────────────────────────────────────────────────────
// Config
// Set these via: firebase functions:config:set poolup.arkesel_key="YOUR_KEY"
// Then access with functions.config().poolup.arkesel_key
// ─────────────────────────────────────────────────────────────────────────────

const getArkeselKey = (): string =>
  (functions.config().poolup?.arkesel_key as string) || "";

// ─────────────────────────────────────────────────────────────────────────────
// sendArkeselSMS — calls the Arkesel V2 API
// Docs: https://developers.arkesel.com
// ─────────────────────────────────────────────────────────────────────────────

async function sendArkeselSMS(
  phone: string,   // Ghana format e.g. +233241234567
  message: string
): Promise<void> {
  const apiKey = getArkeselKey();
  if (!apiKey) {
    functions.logger.warn("Arkesel API key not set — skipping SMS");
    return;
  }

  try {
    // Normalise phone: strip +233 prefix, keep local digits (for Arkesel's sender)
    const normalised = phone.replace(/^\+/, "");

    const response = await axios.post(
      "https://sms.arkesel.com/api/v2/sms/send",
      {
        sender: "PoolUp",
        message,
        recipients: [normalised],
      },
      {
        headers: {
          "api-key": apiKey,
          "Content-Type": "application/json",
        },
      }
    );

    functions.logger.info("Arkesel SMS sent", {
      phone: normalised,
      status: response.data?.status,
    });
  } catch (err: any) {
    functions.logger.error("Arkesel SMS failed", {
      phone,
      error: err.response?.data || err.message,
    });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// sendFCMNotification — sends a push via FCM to a single token
// ─────────────────────────────────────────────────────────────────────────────

async function sendFCMNotification(
  fcmToken: string,
  title: string,
  body: string,
  data: Record<string, string> = {}
): Promise<void> {
  if (!fcmToken) return;

  try {
    await admin.messaging().send({
      token: fcmToken,
      notification: { title, body },
      data,
      android: {
        priority: "high",
        notification: { channelId: "poolup_reminders" },
      },
      apns: {
        payload: {
          aps: { alert: { title, body }, sound: "default" },
        },
      },
    });
    functions.logger.info("FCM notification sent", { fcmToken: fcmToken.slice(0, 20) });
  } catch (err: any) {
    functions.logger.error("FCM send failed", { error: err.message });
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// scheduledSubscriptionReminder
//
// Runs every day at 09:00 Africa/Accra.
// Finds groups whose subscription.nextBillingDate is exactly 7 days from today,
// then sends an FCM push + Arkesel SMS to the admin.
//
// Deploy: firebase deploy --only functions
// ─────────────────────────────────────────────────────────────────────────────

export const scheduledSubscriptionReminder = functions
  .region("us-central1")
  .pubsub.schedule("0 9 * * *")           // 09:00 every day
  .timeZone("Africa/Accra")
  .onRun(async () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Target window: billing date is between 7 days and 8 days from today
    const windowStart = new Date(today);
    windowStart.setDate(today.getDate() + 7);

    const windowEnd = new Date(today);
    windowEnd.setDate(today.getDate() + 8);

    functions.logger.info("Running subscription reminder check", {
      windowStart: windowStart.toISOString(),
      windowEnd: windowEnd.toISOString(),
    });

    const snapshot = await db
      .collection("groups")
      .where("subscription.nextBillingDate", ">=", admin.firestore.Timestamp.fromDate(windowStart))
      .where("subscription.nextBillingDate", "<", admin.firestore.Timestamp.fromDate(windowEnd))
      .get();

    if (snapshot.empty) {
      functions.logger.info("No groups due for reminder today");
      return null;
    }

    functions.logger.info(`Found ${snapshot.size} group(s) to remind`);

    const tasks: Promise<void>[] = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      const adminId: string = data.adminId;
      const groupName: string = data.name;

      // Skip already-overdue groups
      if (data.subscription?.status === "overdue") return;

      tasks.push(
        (async () => {
          // Fetch admin user record to get phone number and FCM token
          let adminPhone = "";
          let adminName = "there";
          let fcmToken = "";

          try {
            const userRecord = await admin.auth().getUser(adminId);
            adminPhone = userRecord.phoneNumber || "";
            adminName = userRecord.displayName || "there";
          } catch (e) {
            functions.logger.warn("Could not fetch admin user record", { adminId });
          }

          // Try to get FCM token from users collection (stored by the app on login)
          try {
            const userDoc = await db.collection("users").doc(adminId).get();
            if (userDoc.exists) {
              fcmToken = userDoc.data()?.fcmToken || "";
            }
          } catch (e) {
            functions.logger.warn("Could not fetch FCM token", { adminId });
          }

          const smsMessage =
            `Hi ${adminName}, your PoolUp subscription is due in 7 days. ` +
            `Pay GHS 20 to keep your group "${groupName}" active.`;

          const fcmTitle = "💳 Subscription due in 7 days";
          const fcmBody =
            `Your PoolUp group "${groupName}" subscription is due in 7 days. Tap to pay GHS 20.`;

          // Fire both in parallel
          await Promise.all([
            adminPhone ? sendArkeselSMS(adminPhone, smsMessage) : Promise.resolve(),
            fcmToken
              ? sendFCMNotification(fcmToken, fcmTitle, fcmBody, {
                  groupId: doc.id,
                  type: "subscription_reminder",
                })
              : Promise.resolve(),
          ]);

          functions.logger.info("Reminders sent for group", {
            groupId: doc.id,
            groupName,
            adminId,
          });
        })()
      );
    });

    await Promise.all(tasks);
    return null;
  });

// ─────────────────────────────────────────────────────────────────────────────
// onSubscriptionOverdue (Firestore trigger — optional belt-and-suspenders)
//
// Watches for groups where subscription.status flips to 'overdue'
// and immediately notifies the admin.
// This fires if you manually set status='overdue' via a separate job.
// ─────────────────────────────────────────────────────────────────────────────

export const onSubscriptionOverdue = functions
  .region("us-central1")
  .firestore.document("groups/{groupId}")
  .onUpdate(async (change, context) => {
    const before = change.before.data();
    const after = change.after.data();

    const wasActive = before.subscription?.status === "active";
    const isNowOverdue = after.subscription?.status === "overdue";

    if (!wasActive || !isNowOverdue) return null;

    const adminId: string = after.adminId;
    const groupName: string = after.name;

    let adminPhone = "";
    let adminName = "there";
    let fcmToken = "";

    try {
      const userRecord = await admin.auth().getUser(adminId);
      adminPhone = userRecord.phoneNumber || "";
      adminName = userRecord.displayName || "there";
    } catch (e) {
      functions.logger.warn("Could not fetch admin for overdue notification", { adminId });
    }

    try {
      const userDoc = await db.collection("users").doc(adminId).get();
      if (userDoc.exists) {
        fcmToken = userDoc.data()?.fcmToken || "";
      }
    } catch (e) {
      // ignore
    }

    const smsMessage =
      `Hi ${adminName}, your PoolUp group "${groupName}" is locked. ` +
      `Pay GHS 20 to restore access: https://poolup.app`;

    await Promise.all([
      adminPhone
        ? sendArkeselSMS(adminPhone, smsMessage)
        : Promise.resolve(),
      fcmToken
        ? sendFCMNotification(
            fcmToken,
            "🔒 Group locked",
            `Your group "${groupName}" is locked. Tap to pay GHS 20 and restore access.`,
            { groupId: context.params.groupId, type: "subscription_overdue" }
          )
        : Promise.resolve(),
    ]);

    return null;
  });
