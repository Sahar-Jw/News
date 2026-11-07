export const EXPO_KINDS = ['exhibitor', 'sponsor', 'session'] as const;
export type ExpoKind = (typeof EXPO_KINDS)[number];
export const SPONSOR_TIERS = ['strategic', 'gold', 'silver', 'partner'] as const;
export const SESSION_TYPES = ['seminar', 'workshop', 'b2b', 'keynote', 'other'] as const;
