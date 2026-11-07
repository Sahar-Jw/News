/** Hierarchy order of the public page: president first. Stored in `news.extra.position` of the BOARD_MEMBER rows. */
export const BOARD_POSITIONS = ['president', 'vice_president', 'secretary', 'treasurer', 'member'] as const;
export type BoardPosition = (typeof BOARD_POSITIONS)[number];
