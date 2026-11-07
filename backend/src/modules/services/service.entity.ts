/** What kind of service it is (a column of the one-stop window). Stored in `news.extra.kind` of the SERVICE rows. */
export const SERVICE_KINDS = ['membership', 'certificate', 'attestation', 'origin', 'consulting', 'other'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
