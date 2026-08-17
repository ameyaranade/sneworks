// resumeAgent.ts — the second half of the Phase 2 approval gate.
//
// The client flips a proposedAction's `status` to 'approved' or 'rejected' (a plain
// owner write). This trigger reacts: on approval it runs the real destructive
// executor (executeProposedAction) and posts a confirmation; on rejection it posts
// a brief acknowledgement. Either way it never re-enters the model — the proposal
// already carries the exact tool + args, so execution is deterministic and can't be
// re-steered by intervening content. The session returns to 'idle' once no pending
// proposals remain.
import * as admin from 'firebase-admin';
import { onDocumentUpdated } from 'firebase-functions/v2/firestore';
import { executeProposedAction } from './agentTools';

interface ProposedActionDoc {
  tool?: string;
  summary?: string;
  args?: Record<string, unknown>;
  status?: 'pending' | 'approved' | 'rejected';
  executedAt?: admin.firestore.Timestamp;
}

export const resumeAgent = onDocumentUpdated(
  'users/{uid}/chatSessions/{sid}/proposedActions/{aid}',
  async (event) => {
    const before = event.data?.before.data() as ProposedActionDoc | undefined;
    const after = event.data?.after.data() as ProposedActionDoc | undefined;
    if (!after) return;

    // Only act on a fresh pending → approved/rejected transition, once.
    if (after.executedAt) return;                                  // idempotency vs. redelivery
    if (before?.status === after.status) return;                  // not a status change
    if (after.status !== 'approved' && after.status !== 'rejected') return;

    const { uid, sid, aid } = event.params as { uid: string; sid: string; aid: string };
    const db = admin.firestore();
    const sessionRef = db.doc(`users/${uid}/chatSessions/${sid}`);
    const messagesCol = sessionRef.collection('messages');
    const proposalRef = db.doc(`users/${uid}/chatSessions/${sid}/proposedActions/${aid}`);

    try {
      if (after.status === 'approved') {
        const result = await executeProposedAction(uid, after.tool ?? '', after.args ?? {});
        await messagesCol.add({
          role: 'assistant',
          content: result,
          toolActivity: [{ tool: after.tool ?? 'action', summary: result, status: 'ok' }],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        const what = after.summary ? after.summary.charAt(0).toLowerCase() + after.summary.slice(1) : 'that';
        await messagesCol.add({
          role: 'assistant',
          content: `Okay, I won't ${what}.`,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    } catch (err) {
      console.error('resumeAgent failed:', err);
      await messagesCol.add({
        role: 'assistant',
        content: 'I couldn\'t complete that action. Please try again.',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } finally {
      // Mark handled (guards redelivery) and return the session to idle if nothing
      // else is still awaiting approval.
      await proposalRef.set({ executedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
      const stillPending = await sessionRef.collection('proposedActions').where('status', '==', 'pending').limit(1).get();
      await sessionRef.set(
        { status: stillPending.empty ? 'idle' : 'awaiting-approval', updatedAt: admin.firestore.FieldValue.serverTimestamp() },
        { merge: true },
      );
    }
  },
);
