import { Text, TouchableOpacity, View, Animated, Easing } from "react-native";
import React, { useEffect, useRef } from "react";
import { Image } from "react-native";
import { Moon, Users, Hash } from "lucide-react-native";
import { useRouter } from "expo-router";

const GetStarted = () => {
  const router = useRouter();
  // animate each text in the text block
  const anim1 = useRef(new Animated.Value(0)).current;
  const anim2 = useRef(new Animated.Value(0)).current;
  const anim3 = useRef(new Animated.Value(0)).current;
  const anim4 = useRef(new Animated.Value(0)).current;
  const anim5 = useRef(new Animated.Value(0)).current;
  const anim6 = useRef(new Animated.Value(0)).current;

  // animates each text in the text block
  const makeAnim = (val: Animated.Value) =>
    Animated.timing(val, {
      toValue: 1,
      duration: 500,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });

  // animates each text in the text block
  useEffect(() => {
    Animated.stagger(150, [
      makeAnim(anim1),
      makeAnim(anim2),
      makeAnim(anim3),
      makeAnim(anim4),
      makeAnim(anim5),
      makeAnim(anim6),
    ]).start();
  }, []);

  const animStyle = (val: Animated.Value) => ({
    opacity: val,
    transform: [
      {
        translateY: val.interpolate({
          inputRange: [0, 1],
          outputRange: [30, 0],
        }),
      },
    ],
  });

  return (
    <View className="flex-1 bg-white p-4">
      <View className="flex-row items-center justify-between px-4 mt-4">
        {/* logo-area */}
        <View className="flex-row items-center gap-2">
          <Image
            source={require("../../assets/adaptive-icon.png")}
            className="w-16 h-16"
            resizeMode="contain"
          />
          <Text
            className="text-2xl font-bold text-emerald-600"
            style={{ fontFamily: "Nunito_800ExtraBold" }}
          >
            PoolUp
          </Text>
        </View>
        <TouchableOpacity
          className="bg-green-50 w-14 h-14 rounded-full items-center justify-center"
          onPress={() => {
            // TODO: implement dark mode
          }}
        >
          <Moon color="green" size={20} />
        </TouchableOpacity>
      </View>

      {/* image above the text */}
      <Image
        source={require("../../assets/vector.png")}
        resizeMode="cover"
        style={{ width: 400, height: 400 }}
      />

      <View className="items-center justify-center w-54">
        <Animated.Text
          className="font-bold"
          style={[
            { fontFamily: "Nunito_800ExtraBold", fontSize: 30 },
            animStyle(anim1),
          ]}
        >
          Save together,
        </Animated.Text>

        <Animated.Text
          className="text-emerald-700 font-bold"
          style={[
            { fontFamily: "Nunito_800ExtraBold", fontSize: 30 },
            animStyle(anim2),
          ]}
        >
          grow together.
        </Animated.Text>

        <Animated.Text
          className="text-center mt-4 w-96 text-emerald-600"
          style={[
            { fontFamily: "Nunito_400Regular", fontSize: 18 },
            animStyle(anim3),
          ]}
        >
          Start or join a family savings pool. It's easy, fun and drama-free.
        </Animated.Text>
      </View>

      <View className="w-full px-6 gap-4 mt-10">
        {/* Create a group button */}
        <Animated.View style={animStyle(anim4)}>
          <TouchableOpacity className="bg-[#2e8b71] rounded-full py-4 flex-row items-center justify-center gap-3">
            <Users color="white" size={20} />
            <Text
              style={{ fontFamily: "Nunito_700Bold" }}
              className="text-white text-base"
            >
              Create a group
            </Text>
          </TouchableOpacity>
        </Animated.View>

        {/* Join with a code button */}
        <Animated.View style={animStyle(anim5)}>
          <TouchableOpacity
            className="border-2 border-[#0d5c45] rounded-full py-4 flex-row items-center justify-center gap-3"
            onPress={() => router.push("/join")}
          >
            <Hash color="#0d5c45" size={20} />
            <Text
              style={{ fontFamily: "Nunito_700Bold" }}
              className="text-[#0d5c45] text-base"
            >
              Join with a code
            </Text>
          </TouchableOpacity>
        </Animated.View>

        <Animated.View
          style={animStyle(anim6)}
          className="flex-row items-center justify-center gap-1 mt-4"
        >
          <Text
            style={{ fontFamily: "Nunito_400Regular" }}
            className="text-[#0d5c45]"
          >
            Already have an account?
          </Text>
          <TouchableOpacity>
            <Text
              style={{ fontFamily: "Nunito_700Bold" }}
              className="text-[#084937] font-bold"
            >
              Log in
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </View>
    </View>
  );
};

export default GetStarted;
