/**
 * Who manages the requests of which form.
 *
 * The requests of a form are managed from the page that owns it (Training, Membership, Incubator, Get2Trade, DCC EXPO, Contact). A person who
 * manages that page does it with the page's own permissions: the global "forms" permissions are NOT needed. The global permissions
 * (forms.submissions.*) still work and open every form (administrators).
 */
export type SubAction = 'read' | 'update' | 'contact' | 'delete' | 'export';

/** the global permission of each action: holders manage the requests of EVERY form */
export const GLOBAL_PERM: Record<SubAction, string> = {
  read: 'forms.submissions.read',
  update: 'forms.submissions.update',
  contact: 'forms.submissions.contact',
  delete: 'forms.submissions.delete',
  export: 'forms.submissions.export',
};

export interface FormPage {
  key: string;
  /** the forms whose requests land on the page */
  slugs: string[];
  /** the page's own permissions for each action (having ONE of them is enough); an empty list = only the global permission allows it */
  perms: Record<SubAction, string[]>;
}

export const FORM_PAGES: FormPage[] = [
  { key: 'trainees', slugs: ['course-registration'], perms: { read: ['courses.read'], update: ['courses.update'], contact: ['courses.update'], delete: ['courses.delete'], export: ['courses.read'] } },
  { key: 'trainerApps', slugs: ['trainer-application'], perms: { read: ['courses.read'], update: ['courses.update'], contact: ['courses.update'], delete: ['courses.delete'], export: ['courses.read'] } },
  { key: 'membership', slugs: ['membership'], perms: { read: ['membership.read'], update: ['membership.update'], contact: ['membership.update'], delete: ['membership.delete'], export: ['membership.export'] } },
  { key: 'incubator', slugs: ['incubator-application'], perms: { read: ['incubator.applications.read'], update: ['incubator.applications.update'], contact: ['incubator.applications.update'], delete: ['incubator.applications.delete'], export: ['incubator.applications.export'] } },
  { key: 'get2trade', slugs: ['get2trade-booking', 'get2trade-inquiry'], perms: { read: ['get2trade.read'], update: ['get2trade.update'], contact: ['get2trade.update'], delete: ['get2trade.delete'], export: ['get2trade.export'] } },
  { key: 'expo', slugs: ['expo-exhibitor', 'expo-visitor', 'expo-info'], perms: { read: ['expo.applications.read'], update: ['expo.applications.update'], contact: ['expo.applications.update'], delete: ['expo.applications.delete'], export: ['expo.applications.export'] } },
  { key: 'contactOneStop', slugs: ['contact-one-stop'], perms: { read: ['services.read'], update: ['services.update'], contact: ['services.update'], delete: ['services.delete'], export: ['services.read'] } },
  { key: 'contactWomen', slugs: ['contact-women'], perms: { read: ['committees.read'], update: ['committees.update'], contact: ['committees.update'], delete: ['committees.delete'], export: ['committees.read'] } },
  { key: 'contact', slugs: ['contact'], perms: { read: ['messages.read'], update: [], contact: [], delete: [], export: ['messages.export'] } },
];

/** every permission that opens SOME page's requests for this action (the global one included): what an endpoint asks for before it narrows by form */
export const permsFor = (action: SubAction): string[] => [...new Set([GLOBAL_PERM[action], ...FORM_PAGES.flatMap((p) => p.perms[action])])];

/** the forms (by slug) this person may use for the action: `null` = all of them (global permission), otherwise only the forms of the pages they manage */
export function allowedSlugs(user: { permissions: Set<string> }, action: SubAction): string[] | null {
  if (user.permissions.has(GLOBAL_PERM[action])) return null;
  return FORM_PAGES.filter((p) => p.perms[action].some((c) => user.permissions.has(c))).flatMap((p) => p.slugs);
}

/** the pages whose new requests this person is told about: the ones they manage (page permission), never another team's */
export const pagesOf = (user: { permissions: Set<string> }): FormPage[] => FORM_PAGES.filter((p) => p.perms.read.some((c) => user.permissions.has(c)));
