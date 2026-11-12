/** What kind of service it is (a column of the one-stop window). Stored in `news.extra.kind` of the SERVICE rows. */
export const SERVICE_KINDS = ['membership', 'renewal', 'consulting', 'commercial', 'certificate', 'attestation', 'eservices', 'origin', 'other'] as const;
export type ServiceKind = (typeof SERVICE_KINDS)[number];
