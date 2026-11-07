export const PROJECT_STATUSES = ['incubated', 'graduated'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];
