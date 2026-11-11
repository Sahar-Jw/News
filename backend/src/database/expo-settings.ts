/**
 * The "expo" settings added when DCC EXPO became a full separate site (like the Women Business Committee page): the introduction sections,
 * targeted sectors, key information, interactive floor plan, team, social links and footer rights. Used by the seed and by the migration
 * AddExpoSite, so both always agree. [key, type, default].
 */
export type ExpoSettingSeed = [key: string, type: 'text' | 'url' | 'file', value?: string];

const pair = (key: string): ExpoSettingSeed[] => [[`${key}_ar`, 'text'], [`${key}_en`, 'text']];

export const EXPO_NEW_SETTINGS: ExpoSettingSeed[] = [
  ...pair('idea'), ...pair('goals'), ...pair('target_sectors'), ...pair('participants'), ...pair('participation_nature'),
  ...pair('importance'), ...pair('why_expo'), ...pair('value_exhibitors'), ...pair('value_visitors'), ...pair('value_trade'),
  ...pair('sectors_intro'), ...pair('sectors_list'),
  ...pair('info_exhibitors'), ...pair('info_visitors'),
  ...pair('register_note'),
  ...pair('coverage_topic'), ...pair('interviews_topic'), ...pair('materials_topic'),
  ['floor_plan_image', 'file'],
  ...pair('contact_address'), ['contact_website', 'url'], ['contact_map_url', 'url'],
  ...pair('team'),
  ['social_facebook_url', 'url'], ['social_x_url', 'url'], ['social_instagram_url', 'url'], ['social_linkedin_url', 'url'],
  ['social_youtube_url', 'url'], ['social_whatsapp_url', 'url'], ['social_telegram_url', 'url'],
  ['rights_ar', 'text', '© جميع الحقوق محفوظة لمعرض DCC EXPO'], ['rights_en', 'text', '© All rights reserved to DCC EXPO'],
];
