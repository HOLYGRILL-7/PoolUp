import React, { useEffect, useState } from "react";
import { Redirect } from "expo-router";
import auth from "@react-native-firebase/auth";
import firestore from "@react-native-firebase/firestore";
import { View, ActivityIndicator } from "react-native";
import { useGroupStore } from "../store/groupstore";
import "../global.css";

const Index = () => {
  const [loading, setLoading] = useState(true);
  const [targetRoute, setTargetRoute] = useState<string | null>(null);
  const setGroup = useGroupStore((state) => state.setGroup);

  useEffect(() => {
    // onAuthStateChanged is a Firebase listener that fires every time
    // the auth state changes — on app open, on login, on logout.
    const unsubscribe = auth().onAuthStateChanged(async (firebaseUser) => {
      if (firebaseUser) {
        try {
          // Check if this user is a member of any group
          const snapshot = await firestore()
            .collection("groups")
            .where("memberIds", "array-contains", firebaseUser.uid)
            .limit(1)
            .get();

          if (!snapshot.empty) {
            const groupDoc = snapshot.docs[0];
            const data = groupDoc.data();
            setGroup(groupDoc.id, data.code, data.name);
            setTargetRoute("/(home)/dashboard");
          } else {
            // User is logged in but hasn't joined or created a group yet
            setTargetRoute("/(onboarding)/getstarted");
          }
        } catch (err) {
          console.error("Error checking group membership on start:", err);
          setTargetRoute("/(onboarding)/getstarted");
        }
      } else {
        // Not logged in
        setTargetRoute("/(onboarding)/welcome");
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  // Still checking Firebase/Firestore — show a spinner
  if (loading || !targetRoute) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: "#f0f7f4" }}>
        <ActivityIndicator color="#0d5c45" size="large" />
      </View>
    );
  }

  return <Redirect href={targetRoute as any} />;
};

export default Index;