/** Shape of a public service (GET /public/services) and its type keys, shared by the One-Stop page and the service page. */
export interface PublicService {
  id: number; kind: string; name: string; description: string; audience: string; department: string; duration: string; fee: string;
  location: string; formUrl: string; imageUrl: string | null; documents: string[]; steps: string[];
}
export const SERVICE_KINDS = ['membership', 'certificate', 'attestation', 'origin', 'consulting', 'other'] as const;
