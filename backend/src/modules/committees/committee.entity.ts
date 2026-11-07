/** sector = the committees list; women = the businesswomen committee page. Each kind is its own main category (COMMITTEE / WOMEN_COMMITTEE). */
export const COMMITTEE_KINDS = ['sector', 'women'] as const;
export type CommitteeKind = (typeof COMMITTEE_KINDS)[number];
export const MEMBER_ROLES = ['chair', 'vice', 'member'] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];
/** each activity kind is its own main category: COMMITTEE_MEETING, COMMITTEE_VISIT, COMMITTEE_RECOMMENDATION, COMMITTEE_INITIATIVE */
export const ACTIVITY_KINDS = ['meeting', 'visit', 'recommendation', 'initiative'] as const;
export type ActivityKind = (typeof ACTIVITY_KINDS)[number];
