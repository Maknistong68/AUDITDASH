import { redirect } from 'next/navigation';
import { toSearchParams, type SP } from '@/lib/details';

/** The audits list lives in the Log (one place per thing): /audits keeps old links working. */
export default async function AuditsRedirect({ searchParams }: { searchParams: Promise<SP> }) {
  const sp = toSearchParams(await searchParams);
  const keep = new URLSearchParams([...sp].filter(([k]) => k === 'q' || k === 'r' || k === 't'));
  keep.set('view', 'audits');
  redirect(`/log?${keep.toString()}`);
}
