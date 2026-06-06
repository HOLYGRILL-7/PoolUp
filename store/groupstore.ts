// store/groupStore.ts
// This store temporarily holds the group data between
// creategroup.tsx and invitemembers.tsx — since we can't
// pass complex objects through router.push params safely

import { create } from 'zustand';

type GroupStore = {
  groupId: string | null;
  groupCode: string | null;
  groupName: string | null;
  setGroup: (id: string, code: string, name: string) => void;
  clearGroup: () => void;
};

export const useGroupStore = create<GroupStore>((set) => ({
  groupId: null,
  groupCode: null,
  groupName: null,
  setGroup: (id, code, name) => set({ groupId: id, groupCode: code, groupName: name }),
  clearGroup: () => set({ groupId: null, groupCode: null, groupName: null }),
}));