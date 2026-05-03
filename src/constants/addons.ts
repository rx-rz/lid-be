export type AddOnType =
  | "recalls"
  | "super_likes"
  | "takeoff"
  | "love_letters"
  | "cruise_calls"
  | "cruise_pass";

export type AddOnPack = {
  id: string;
  type: AddOnType;
  name: string;
  quantity: number | "unlimited";
  unitLabel: string;
  amount: number;
  currency: "usd";
  interval?: "month";
};

export const ADD_ON_PACKS: AddOnPack[] = [
  {
    id: "recall_5",
    type: "recalls",
    name: "Recall x5",
    quantity: 5,
    unitLabel: "recalls",
    amount: 1.99,
    currency: "usd",
  },
  {
    id: "recall_15",
    type: "recalls",
    name: "Recall x15",
    quantity: 15,
    unitLabel: "recalls",
    amount: 4.99,
    currency: "usd",
  },
  {
    id: "recall_30",
    type: "recalls",
    name: "Recall x30",
    quantity: 30,
    unitLabel: "recalls",
    amount: 7.99,
    currency: "usd",
  },
  {
    id: "super_likes_5",
    type: "super_likes",
    name: "Super Likes x5",
    quantity: 5,
    unitLabel: "super likes",
    amount: 4.99,
    currency: "usd",
  },
  {
    id: "super_likes_15",
    type: "super_likes",
    name: "Super Likes x15",
    quantity: 15,
    unitLabel: "super likes",
    amount: 12.99,
    currency: "usd",
  },
  {
    id: "super_likes_30",
    type: "super_likes",
    name: "Super Likes x30",
    quantity: 30,
    unitLabel: "super likes",
    amount: 21.99,
    currency: "usd",
  },
  {
    id: "takeoff_1",
    type: "takeoff",
    name: "Takeoff x1",
    quantity: 1,
    unitLabel: "boosts",
    amount: 3.99,
    currency: "usd",
  },
  {
    id: "takeoff_5",
    type: "takeoff",
    name: "Takeoff x5",
    quantity: 5,
    unitLabel: "boosts",
    amount: 16.99,
    currency: "usd",
  },
  {
    id: "takeoff_10",
    type: "takeoff",
    name: "Takeoff x10",
    quantity: 10,
    unitLabel: "boosts",
    amount: 29.99,
    currency: "usd",
  },
  {
    id: "love_letters_3",
    type: "love_letters",
    name: "Love Letters x3",
    quantity: 3,
    unitLabel: "love letters",
    amount: 4.99,
    currency: "usd",
  },
  {
    id: "love_letters_10",
    type: "love_letters",
    name: "Love Letters x10",
    quantity: 10,
    unitLabel: "love letters",
    amount: 12.99,
    currency: "usd",
  },
  {
    id: "love_letters_25",
    type: "love_letters",
    name: "Love Letters x25",
    quantity: 25,
    unitLabel: "love letters",
    amount: 24.99,
    currency: "usd",
  },
  {
    id: "cruise_calls_10",
    type: "cruise_calls",
    name: "Cruise Calls x10",
    quantity: 10,
    unitLabel: "calls",
    amount: 5.99,
    currency: "usd",
  },
  {
    id: "cruise_calls_30",
    type: "cruise_calls",
    name: "Cruise Calls x30",
    quantity: 30,
    unitLabel: "calls",
    amount: 14.99,
    currency: "usd",
  },
  {
    id: "cruise_pass_monthly",
    type: "cruise_pass",
    name: "Cruise Pass",
    quantity: "unlimited",
    unitLabel: "calls",
    amount: 17.99,
    currency: "usd",
    interval: "month",
  },
];

export const getAddOnPack = (packId: string) =>
  ADD_ON_PACKS.find((pack) => pack.id === packId);
