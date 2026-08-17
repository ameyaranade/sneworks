import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { RotateCcw } from 'lucide-react';
import { useAuth } from '../auth/AuthContext';
import { useToast } from '../shared/components/Toast';
import DetailPageHeader from '../components/primitives/DetailPageHeader';
import EmptyState from '../components/primitives/EmptyState';
import ConfirmSheet from '../components/primitives/ConfirmSheet';
import {
  subscribeToMyPendingInvites,
  acceptInvite,
  declineInvite,
  blockInviter,
} from '../firebase/sharedProjectQueries';
import { subscribeToSettings, unblockInviter, type BlockedInviter } from '../firebase/settingsQueries';
import type { Invite } from '../types';
import './invites-page.css';

export default function InvitesPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid;
  const email = user?.email;

  const [invites, setInvites] = useState<Invite[]>([]);
  const [blocked, setBlocked] = useState<BlockedInviter[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmBlock, setConfirmBlock] = useState<Invite | null>(null);

  useEffect(() => {
    if (!email) return;
    return subscribeToMyPendingInvites(email, setInvites);
  }, [email]);

  useEffect(() => {
    if (!uid) return;
    return subscribeToSettings(uid, (s) => setBlocked(s.blockedInviters ?? []));
  }, [uid]);

  const handleAccept = async (invite: Invite) => {
    if (!invite.id) return;
    setBusyId(invite.id);
    try {
      await acceptInvite(invite.id);
      showToast(`Joined ${invite.projectName}`, 'success');
    } catch {
      showToast('Could not join. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (invite: Invite) => {
    if (!invite.id) return;
    setBusyId(invite.id);
    try {
      await declineInvite(invite.id);
    } catch {
      showToast('Could not decline. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleBlock = async (invite: Invite) => {
    if (!invite.id) return;
    setBusyId(invite.id);
    try {
      await blockInviter(invite.id);
      showToast(`Blocked ${invite.invitedByName ?? 'sender'}`, 'info');
    } catch {
      showToast('Could not block. Try again.', 'error');
    } finally {
      setBusyId(null);
    }
  };

  const handleUnblock = async (senderUid: string) => {
    if (!uid) return;
    try {
      await unblockInviter(uid, senderUid);
      showToast('Unblocked', 'info');
    } catch {
      showToast('Could not unblock. Try again.', 'error');
    }
  };

  return (
    <>
      <div className="sn-invites-page">
        <DetailPageHeader onBack={() => navigate('/more')} title="Invites" />

        <div className="sn-invites-body">
          {/* ── Pending invites ── */}
          <section className="sn-invites-section">
            <div className="sn-invites-section-label">
              Pending
              {invites.length > 0 && <span className="sn-invites-count">{invites.length}</span>}
            </div>

            {invites.length === 0 ? (
              <EmptyState glyph="✦" title="No pending invites." sub="Project invites people send you show up here." />
            ) : (
              <div className="sn-invites-list">
                {invites.map((invite) => (
                  <div className="sn-invite-card" key={invite.id}>
                    <div className="sn-invite-card__info">
                      <span className="sn-invite-card__project">{invite.projectName}</span>
                      <span className="sn-invite-card__from">
                        from {invite.invitedByName ?? 'Someone'}
                        {invite.invitedByEmail ? ` · ${invite.invitedByEmail}` : ''}
                      </span>
                    </div>
                    <div className="sn-invite-card__actions">
                      <button
                        type="button"
                        className="sn-invite-btn sn-invite-btn--block"
                        disabled={busyId === invite.id}
                        onClick={() => setConfirmBlock(invite)}
                      >
                        Block
                      </button>
                      <button
                        type="button"
                        className="sn-invite-btn sn-invite-btn--decline"
                        disabled={busyId === invite.id}
                        onClick={() => handleDecline(invite)}
                      >
                        Decline
                      </button>
                      <button
                        type="button"
                        className="sn-invite-btn sn-invite-btn--accept"
                        disabled={busyId === invite.id}
                        onClick={() => handleAccept(invite)}
                      >
                        {busyId === invite.id ? '…' : 'Accept'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* ── Blocked senders ── */}
          {blocked.length > 0 && (
            <section className="sn-invites-section">
              <div className="sn-invites-section-label">
                Blocked
                <span className="sn-invites-count">{blocked.length}</span>
              </div>
              <p className="sn-invites-section-hint">
                Blocked people can't send you project invites. Unblock to allow them again.
              </p>
              <div className="sn-invites-list">
                {blocked.map((b) => (
                  <div className="sn-blocked-row" key={b.uid}>
                    <div className="sn-blocked-row__info">
                      <span className="sn-blocked-row__name">{b.name}</span>
                      {b.email && <span className="sn-blocked-row__email">{b.email}</span>}
                    </div>
                    <button
                      type="button"
                      className="sn-invite-btn sn-invite-btn--unblock"
                      onClick={() => handleUnblock(b.uid)}
                    >
                      <RotateCcw size={13} strokeWidth={2} />
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      {confirmBlock && (
        <ConfirmSheet
          title={`Block ${confirmBlock.invitedByName ?? 'this sender'}?`}
          message="They won't be able to send you project invites. This invite will be declined. You can unblock them later."
          confirmLabel="Block"
          onConfirm={() => { const inv = confirmBlock; setConfirmBlock(null); handleBlock(inv); }}
          onCancel={() => setConfirmBlock(null)}
        />
      )}
    </>
  );
}
