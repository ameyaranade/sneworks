import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import BottomSheet from '../primitives/BottomSheet';
import ConfirmSheet from '../primitives/ConfirmSheet';
import SharedBadge from '../sharing/SharedBadge';
import {
  inviteToProject,
  revokeInvite,
  removeMember,
  leaveSharedProject,
  subscribeToProjectInvites,
} from '../../firebase/sharedProjectQueries';
import type { ProjectGroup, ShoppingListGroup, Invite } from '../../types';
import './share-sheet.css';

interface ShareSheetProps {
  project: ProjectGroup | ShoppingListGroup;
  onClose: () => void;
}

function errorMessage(err: unknown): string {
  const msg = (err as { message?: string } | undefined)?.message;
  return msg && msg.length < 120 ? msg : 'Something went wrong. Try again.';
}

export default function ShareSheet({ project, onClose }: ShareSheetProps) {
  const { user } = useAuth();
  const { showToast } = useToast();
  const uid = user?.uid;

  const isShared = project.location === 'shared';
  const members = isShared ? project.members ?? {} : uid ? { [uid]: true as const } : {};
  const memberNames = isShared ? project.memberNames ?? {} : {};
  const ownerUid = isShared ? project.ownerUid : uid;
  const memberCount = isShared ? project.memberCount ?? 1 : 1;
  const isOwner = ownerUid === uid;

  const [email, setEmail] = useState('');
  const [sending, setSending] = useState(false);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [confirmRevokeId, setConfirmRevokeId] = useState<string | null>(null);
  const [confirmRemoveUid, setConfirmRemoveUid] = useState<string | null>(null);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    // Only the owner can read a project's invites (rule + query both scope to
    // invitedBy == ownerUid); non-owners skip the subscription entirely.
    if (!project.id || !isOwner || !ownerUid) return;
    return subscribeToProjectInvites(project.id, ownerUid, setInvites);
  }, [project.id, isOwner, ownerUid]);

  const handleInvite = async () => {
    if (!project.id || !email.trim()) return;
    setSending(true);
    try {
      await inviteToProject(project.id, email.trim());
      showToast('Invite sent', 'success');
      setEmail('');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    } finally {
      setSending(false);
    }
  };

  const handleRevoke = async (inviteId: string) => {
    try {
      await revokeInvite(inviteId);
      showToast('Invite revoked', 'info');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const handleRemoveMember = async (memberUid: string) => {
    if (!project.id) return;
    try {
      await removeMember(project.id, memberUid);
      showToast('Member removed', 'info');
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  const handleLeave = async () => {
    if (!project.id) return;
    try {
      await leaveSharedProject(project.id);
      showToast('Left project', 'info');
      onClose();
    } catch (err) {
      showToast(errorMessage(err), 'error');
    }
  };

  return (
    <>
      <BottomSheet onClose={onClose} title={project.groupKind === 'shopping-list' ? 'Share list' : 'Share project'}>
        <div className="sn-share-body">
          {isShared && memberCount > 1 && (
            <div className="sn-share-badge-row">
              <SharedBadge memberCount={memberCount} />
            </div>
          )}

          {isOwner && (
            <div className="sn-share-invite-row">
              <input
                type="email"
                className="sn-share-email-input"
                placeholder="name@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') handleInvite(); }}
                autoFocus
              />
              <button
                type="button"
                className="sn-share-send-btn"
                disabled={!email.trim() || sending}
                onClick={handleInvite}
              >
                {sending ? 'Sending…' : 'Send invite'}
              </button>
            </div>
          )}
          {!isOwner && (
            <p className="sn-share-hint">Only the owner can invite new people.</p>
          )}

          <div className="sn-share-divider" />

          <div className="sn-share-section-label">People</div>
          <div className="sn-share-people">
            {ownerUid && (
              <div className="sn-share-person">
                <span className="sn-share-avatar sn-share-avatar--owner">
                  {(memberNames[ownerUid]?.name ?? (ownerUid === uid ? (user?.displayName ?? 'You') : 'Owner'))
                    .slice(0, 2)
                    .toUpperCase()}
                </span>
                <span className="sn-share-person-text">
                  <span className="sn-share-person-name">
                    {ownerUid === uid ? 'You' : memberNames[ownerUid]?.name ?? 'Owner'}
                  </span>
                  {memberNames[ownerUid]?.email && (
                    <span className="sn-share-person-email">{memberNames[ownerUid].email}</span>
                  )}
                </span>
                <span className="sn-share-tag sn-share-tag--owner">Owner</span>
              </div>
            )}

            {Object.keys(members)
              .filter((m) => m !== ownerUid)
              .map((m) => (
                <div className="sn-share-person" key={m}>
                  <span className="sn-share-avatar">
                    {(memberNames[m]?.name ?? 'Member').slice(0, 2).toUpperCase()}
                  </span>
                  <span className="sn-share-person-text">
                    <span className="sn-share-person-name">
                      {m === uid ? 'You' : memberNames[m]?.name ?? 'Member'}
                    </span>
                    {memberNames[m]?.email && (
                      <span className="sn-share-person-email">{memberNames[m].email}</span>
                    )}
                  </span>
                  {isOwner ? (
                    <button
                      type="button"
                      className="sn-share-remove-btn"
                      aria-label="Remove member"
                      onClick={() => setConfirmRemoveUid(m)}
                    >
                      <X size={14} strokeWidth={2} />
                    </button>
                  ) : m === uid ? (
                    <button
                      type="button"
                      className="sn-share-leave-btn"
                      onClick={() => setConfirmLeave(true)}
                    >
                      Leave
                    </button>
                  ) : null}
                </div>
              ))}

            {invites.map((inv) => (
              <div className="sn-share-person" key={inv.id}>
                <span className="sn-share-avatar sn-share-avatar--pending">
                  {inv.invitedEmail.slice(0, 2).toUpperCase()}
                </span>
                <span className="sn-share-person-text">
                  <span className="sn-share-person-name">{inv.invitedEmail}</span>
                </span>
                <span className="sn-share-tag sn-share-tag--pending">Invited</span>
                {isOwner && (
                  <button
                    type="button"
                    className="sn-share-remove-btn"
                    aria-label="Revoke invite"
                    onClick={() => setConfirmRevokeId(inv.id!)}
                  >
                    <X size={14} strokeWidth={2} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      </BottomSheet>

      {confirmRevokeId && (
        <ConfirmSheet
          title="Revoke invite?"
          message="They will no longer be able to accept this invite."
          confirmLabel="Revoke"
          onConfirm={() => { const id = confirmRevokeId; setConfirmRevokeId(null); handleRevoke(id); }}
          onCancel={() => setConfirmRevokeId(null)}
        />
      )}

      {confirmRemoveUid && (
        <ConfirmSheet
          title="Remove member?"
          message="They will lose access to this project immediately."
          confirmLabel="Remove"
          onConfirm={() => { const m = confirmRemoveUid; setConfirmRemoveUid(null); handleRemoveMember(m); }}
          onCancel={() => setConfirmRemoveUid(null)}
        />
      )}

      {confirmLeave && (
        <ConfirmSheet
          title={project.groupKind === 'shopping-list' ? 'Leave list?' : 'Leave project?'}
          message={project.groupKind === 'shopping-list'
            ? "You'll lose access to this list and its items."
            : "You'll lose access to this project and its tasks."}
          confirmLabel="Leave"
          onConfirm={() => { setConfirmLeave(false); handleLeave(); }}
          onCancel={() => setConfirmLeave(false)}
        />
      )}
    </>
  );
}
