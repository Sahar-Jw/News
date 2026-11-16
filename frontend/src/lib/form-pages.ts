/**
 * Who manages the requests of which form (the same table as backend/src/modules/forms/form-pages.ts).
 * The requests of a form are managed from the page that owns it, with that page's own permissions - the global "forms" permissions are not
 * needed (they still open every form). The server enforces it; this only decides what the screens show.
 */
export type SubAction = 'read' | 'update' | 'contact' | 'delete' | 'export';

const GLOBAL: Record<SubAction, string> = {
  read: 'forms.submissions.read', update: 'forms.submissions.update', contact: 'forms.submissions.contact', delete: 'forms.submissions.delete', export: 'forms.submissions.export',
};

export interface FormPage { key: string; slugs: string[]; perms: Record<SubAction, string[]> }

export const FORM_PAGES: FormPage[] = [
  { key: 'trainees', slugs: ['course-registration'], perms: { read: ['courses.read'], update: ['courses.update'], contact: ['courses.update'], delete: ['courses.delete'], export: ['courses.read'] } },
  { key: 'trainerApps', slugs: ['trainer-application'], perms: { read: ['courses.read'], update: ['courses.update'], contact: ['courses.update'], delete: ['courses.delete'], export: ['courses.read'] } },
  { key: 'membership', slugs: ['membership'], perms: { read: ['membership.read'], update: ['membership.update'], contact: ['membership.update'], delete: ['membership.delete'], export: ['membership.export'] } },
  { key: 'incubator', slugs: ['incubator-application'], perms: { read: ['incubator.applications.read'], update: ['incubator.applications.update'], contact: ['incubator.applications.update'], delete: ['incubator.applications.delete'], export: ['incubator.applications.export'] } },
  { key: 'get2trade', slugs: ['get2trade-booking', 'get2trade-inquiry'], perms: { read: ['get2trade.read'], update: ['get2trade.update'], contact: ['get2trade.update'], delete: ['get2trade.delete'], export: ['get2trade.export'] } },
  { key: 'expo', slugs: ['expo-exhibitor', 'expo-visitor', 'expo-info'], perms: { read: ['expo.applications.read'], update: ['expo.applications.update'], contact: ['expo.applications.update'], delete: ['expo.applications.delete'], export: ['expo.applications.export'] } },
  { key: 'contact', slugs: ['contact'], perms: { read: ['messages.read'], update: [], contact: [], delete: [], export: ['messages.export'] } },
];

/** every permission that opens the requests of some page for this action, the global one included */
export const permsFor = (action: SubAction): string[] => [...new Set([GLOBAL[action], ...FORM_PAGES.flatMap((p) => p.perms[action])])];

/** may this person do `action` on the requests of these forms (`undefined` = of any form)? Holding the page's own permission is enough. */
export function mayOnForms(can: (...codes: string[]) => boolean, slugs: string[] | null | undefined, action: SubAction): boolean {
  if (can(GLOBAL[action])) return true;
  return FORM_PAGES.filter((p) => !slugs?.length || p.slugs.some((s) => slugs.includes(s))).some((p) => p.perms[action].some((c) => can(c)));
}
