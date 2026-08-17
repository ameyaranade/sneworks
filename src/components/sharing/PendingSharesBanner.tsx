import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../auth/AuthContext';
import { useToast } from '../../shared/components/Toast';
import { subscribeToMyPendingInvites, acceptInvite, declineInvite } from '../../firebase/sharedProjectQueries';
import type { Invite } from '../../types';
import './pending-shares-banner.css';

// Home surfaces at most this many invites inline; the rest live on /invites.
const HOME_PREVIEW_LIMIT = 2;

/** Surfaces invites sent to the signed-in user's email (spec §Pending-share prompt). */
export default function PendingSharesBanner() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const email = user?.email;
  const [invites, setInvites] = useState<Invite[]>([]);
  const [resolvingId, setResolvingId] = useState<string | null>(null);

  useEffect(() => {
    if (!email) return;
    return subscribeToMyPendingInvites(email, setInvites);
  }, [email]);

  if (invites.length === 0) return null;

  const preview = invites.slice(0, HOME_PREVIEW_LIMIT);
  const overflow = invites.length - preview.length;

  const handleAccept = async (invite: Invite) => {
    if (!invite.id) return;
    setResolvingId(invite.id);
    try {
      await acceptInvite(invite.id);
      showToast(`Joined ${invite.projectName}`, 'success');
    } catch {
      showToast('Could not join. Try again.', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  const handleDecline = async (invite: Invite) => {
    if (!invite.id) return;
    setResolvingId(invite.id);
    try {
      await declineInvite(invite.id);
    } catch {
      showToast('Could not decline. Try again.', 'error');
    } finally {
      setResolvingId(null);
    }
  };

  return (
    <div className="sn-pending-shares">
      {preview.map((invite) => (
        <div className="sn-pending-share-card" key={invite.id}>
          <p className="sn-pending-share-text">
            <strong>{invite.invitedByName ?? 'Someone'}</strong> shared{' '}
            <strong>{invite.projectName}</strong> with you
          </p>
          <div className="sn-pending-share-actions">
            <button
              type="button"
              className="sn-pending-share-decline"
              disabled={resolvingId === invite.id}
              onClick={() => handleDecline(invite)}
            >
              Decline
            </button>
            <button
              type="button"
              className="sn-pending-share-accept"
              disabled={resolvingId === invite.id}
              onClick={() => handleAccept(invite)}
            >
              {resolvingId === invite.id ? 'Joining…' : 'Accept'}
            </button>
          </div>
        </div>
      ))}
      {overflow > 0 && (
        <button
          type="button"
          className="sn-pending-share-seeall"
          onClick={() => navigate('/invites')}
        >
          See all {invites.length} invites
        </button>
      )}
    </div>
  );
}
