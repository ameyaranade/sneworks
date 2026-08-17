import { httpsCallable } from 'firebase/functions';
import { functions } from './config';

interface DailySummaryResult {
  text: string;
  limited?: boolean;
}

const callGenerateDailySummary = httpsCallable<void, DailySummaryResult>(
  functions,
  'generateDailySummary',
);

export async function generateDailySummary(): Promise<DailySummaryResult> {
  const result = await callGenerateDailySummary();
  return result.data;
}
