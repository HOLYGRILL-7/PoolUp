import { create } from "zustand";
import { FirebaseAuthTypes } from "@react-native-firebase/auth";

type AuthStore = {
  confirmation: FirebaseAuthTypes.ConfirmationResult | null;
  phone: string | null;
  setConfirmation: (
    confirmation: FirebaseAuthTypes.ConfirmationResult,
    phone: string,
  ) => void;
  clearConfirmation: () => void;
};

export const useAuthStore = create<AuthStore>((set) => ({
  confirmation: null,
  phone: null,
  setConfirmation: (confirmation, phone) => set({ confirmation, phone }),
  clearConfirmation: () => set({ confirmation: null, phone: null }),
}));
