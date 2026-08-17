"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeAgent = void 0;
// resumeAgent.ts — the second half of the Phase 2 approval gate.
//
// The client flips a proposedAction's `status` to 'approved' or 'rejected' (a plain
// owner write). This trigger reacts: on approval it runs the real destructive
// executor (executeProposedAction) and posts a confirmation; on rejection it posts
// a brief acknowledgement. Either way it never re-enters the model — the proposal
// already carries the exact tool + args, so execution is deterministic and can't be
// re-steered by intervening content. The session returns to 'idle' once no pending
// proposals remain.
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-functions/v2/firestore");
const agentTools_1 = require("./agentTools");
exports.resumeAgent = (0, firestore_1.onDocumentUpdated)('users/{uid}/chatSessions/{sid}/proposedActions/{aid}', async (event) => {
    var _a, _b, _c, _d, _e;
    const before = (_a = event.data) === null || _a === void 0 ? void 0 : _a.before.data();
    const after = (_b = event.data) === null || _b === void 0 ? void 0 : _b.after.data();
    if (!after)
        return;
    // Only act on a fresh pending → approved/rejected transition, once.
    if (after.executedAt)
        return; // idempotency vs. redelivery
    if ((before === null || before === void 0 ? void 0 : before.status) === after.status)
        return; // not a status change
    if (after.status !== 'approved' && after.status !== 'rejected')
        return;
    const { uid, sid, aid } = event.params;
    const db = admin.firestore();
    const sessionRef = db.doc(`users/${uid}/chatSessions/${sid}`);
    const messagesCol = sessionRef.collection('messages');
    const proposalRef = db.doc(`users/${uid}/chatSessions/${sid}/proposedActions/${aid}`);
    try {
        if (after.status === 'approved') {
            const result = await (0, agentTools_1.executeProposedAction)(uid, (_c = after.tool) !== null && _c !== void 0 ? _c : '', (_d = after.args) !== null && _d !== void 0 ? _d : {});
            await messagesCol.add({
                role: 'assistant',
                content: result,
                toolActivity: [{ tool: (_e = after.tool) !== null && _e !== void 0 ? _e : 'action', summary: result, status: 'ok' }],
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
        else {
            const what = after.summary ? after.summary.charAt(0).toLowerCase() + after.summary.slice(1) : 'that';
            await messagesCol.add({
                role: 'assistant',
                content: `Okay, I won't ${what}.`,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
            });
        }
    }
    catch (err) {
        console.error('resumeAgent failed:', err);
        await messagesCol.add({
            role: 'assistant',
            content: 'I couldn\'t complete that action. Please try again.',
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
    }
    finally {
        // Mark handled (guards redelivery) and return the session to idle if nothing
        // else is still awaiting approval.
        await proposalRef.set({ executedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        const stillPending = await sessionRef.collection('proposedActions').where('status', '==', 'pending').limit(1).get();
        await sessionRef.set({ status: stillPending.empty ? 'idle' : 'awaiting-approval', updatedAt: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
    }
});
//# sourceMappingURL=resumeAgent.js.map