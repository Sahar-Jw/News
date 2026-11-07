export const COURSE_KINDS = ['course', 'workshop', 'seminar', 'diploma'] as const;
export type CourseKind = (typeof COURSE_KINDS)[number];
