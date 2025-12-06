export const ExpenseCategory = {
  FOOD: 'FOOD',
  TRAVEL: 'TRAVEL',
  GROCERIES: 'GROCERIES',
  SHOPPING: 'SHOPPING',
  BILLS: 'BILLS',
  OTHER: 'OTHER',
} as const;

export type ExpenseCategory = (typeof ExpenseCategory)[keyof typeof ExpenseCategory];

export const ExpenseSource = {
  TEXT: 'TEXT',
  RECEIPT_IMAGE: 'RECEIPT_IMAGE',
  MANUAL: 'MANUAL',
} as const;

export type ExpenseSource = (typeof ExpenseSource)[keyof typeof ExpenseSource];

export const RelationshipType = {
  FRIEND: 'FRIEND',
  COLLEAGUE: 'COLLEAGUE',
  OTHER: 'OTHER',
} as const;

export type RelationshipType = (typeof RelationshipType)[keyof typeof RelationshipType];

export const SplitStatus = {
  PENDING: 'PENDING',
  ACCEPTED: 'ACCEPTED',
  DECLINED: 'DECLINED',
} as const;

export type SplitStatus = (typeof SplitStatus)[keyof typeof SplitStatus];

export const MessageDirection = {
  INBOUND: 'INBOUND',
  OUTBOUND: 'OUTBOUND',
} as const;

export type MessageDirection = (typeof MessageDirection)[keyof typeof MessageDirection];

export const MessageChannel = {
  WHATSAPP: 'WHATSAPP',
} as const;

export type MessageChannel = (typeof MessageChannel)[keyof typeof MessageChannel];
