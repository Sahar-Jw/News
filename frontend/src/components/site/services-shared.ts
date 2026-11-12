/** Shape of a public service (GET /public/services) and its type keys, shared by the One-Stop page and the service page. */
export interface PublicService {
  id: number; kind: string; name: string; description: string; audience: string; department: string; departmentUrl: string; duration: string; fee: string;
  location: string; formUrl: string; formIsFile: boolean; imageUrl: string | null; documents: string[]; steps: string[];
}
export const SERVICE_KINDS = ['membership', 'renewal', 'consulting', 'commercial', 'certificate', 'attestation', 'eservices', 'origin', 'other'] as const;
/** the icon of each kind, on the Services page and in the One-Stop window */
export const KIND_ICON: Record<string, string> = { membership: '🪪', renewal: '🔄', consulting: '💡', commercial: '🏪', certificate: '📄', attestation: '✅', eservices: '💻', origin: '🌍', other: '📌' };
