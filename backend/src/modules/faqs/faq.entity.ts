/** Which part of the site a question belongs to (the public page filters by it). Stored in `news.extra.scope` of the FAQ rows. */
export const FAQ_SCOPES = ['general', 'one_stop', 'membership', 'training', 'expo'] as const;
export type FaqScope = (typeof FAQ_SCOPES)[number];
