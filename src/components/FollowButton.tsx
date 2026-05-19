import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { UserPlus, UserMinus, Clock, UserCheck, Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { followUser, unfollowUser, acceptFollowRequest, rejectFollowRequest } from '../lib/follow';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';

interface FollowButtonProps {
  targetUserId: string;
  targetUserName: string;
  isPrivate?: boolean;
  size?: 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outline' | 'ghost';
  onFollowChange?: (isFollowing: boolean) => void;
  className?: string;
}

type FollowStatus = 'none' | 'following' | 'requested' | 'incoming_request';

export default function FollowButton({
  targetUserId,
  targetUserName,
  isPrivate = false,
  size = 'md',
  variant = 'default',
  onFollowChange,
  className = ''
}: FollowButtonProps) {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [status, setStatus] = useState<FollowStatus>('none');
  const [loading, setLoading] = useState(false);
  const [requestId, setRequestId] = useState<string | null>(null);

  // Listen to follow status
  useEffect(() => {
    if (!user || user.uid === targetUserId) return;

    let following = false;
    let requested = false;
    let incomingRequest = false;

    const syncStatus = () => {
      if (following) {
        setStatus('following');
        onFollowChange?.(true);
      } else if (incomingRequest) {
        setStatus('incoming_request');
        setRequestId(targetUserId);
        onFollowChange?.(false);
      } else if (requested) {
        setStatus('requested');
        onFollowChange?.(false);
      } else {
        setStatus('none');
        setRequestId(null);
        onFollowChange?.(false);
      }
    };

    const followingRef = doc(db, 'users', user.uid, 'following', targetUserId);
    const unsubscribeFollowing = onSnapshot(followingRef, (snap) => {
      following = snap.exists();
      syncStatus();
    });

    const outgoingRequestRef = doc(db, 'users', targetUserId, 'followRequests', user.uid);
    const unsubscribeOutgoing = onSnapshot(outgoingRequestRef, (snap) => {
      requested = snap.exists() && snap.data().status === 'pending';
      syncStatus();
    });

    const incomingRequestRef = doc(db, 'users', user.uid, 'followRequests', targetUserId);
    const unsubscribeIncoming = onSnapshot(incomingRequestRef, (snap) => {
      incomingRequest = snap.exists() && snap.data().status === 'pending';
      syncStatus();
    });

    return () => {
      unsubscribeFollowing();
      unsubscribeOutgoing();
      unsubscribeIncoming();
    };
  }, [user, targetUserId, onFollowChange]);

  const handleFollow = async () => {
    if (!user || loading) return;
    setLoading(true);

    try {
      setStatus(isPrivate ? 'requested' : 'following');
      onFollowChange?.(!isPrivate);
      await followUser(user.uid, targetUserId);
      
      // Send notification if private account
      if (isPrivate) {
        await sendNotification(
          targetUserId,
          'follow_request',
          'New Follow Request',
          `${user.displayName} wants to follow you`,
          { fromUid: user.uid, fromName: user.displayName }
        );
      } else {
        await sendNotification(
          targetUserId,
          'follow',
          'New Follower',
          `${user.displayName} started following you`,
          { fromUid: user.uid }
        );
      }
    } catch (error) {
      setStatus('none');
      onFollowChange?.(false);
      console.error('Error following user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!user || loading) return;
    setLoading(true);

    try {
      setStatus('none');
      onFollowChange?.(false);
      await unfollowUser(user.uid, targetUserId);
    } catch (error) {
      setStatus('following');
      onFollowChange?.(true);
      console.error('Error unfollowing user:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAcceptRequest = async () => {
    if (!user || loading || !requestId) return;
    setLoading(true);

    try {
      await acceptFollowRequest(user.uid, targetUserId);
      
      // Notify the requester
      await sendNotification(
        targetUserId,
        'follow',
        'Follow Request Accepted',
        `${user.displayName} accepted your follow request`,
        { fromUid: user.uid }
      );
      
      setStatus('following');
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleRejectRequest = async () => {
    if (!user || loading) return;
    setLoading(true);

    try {
      await rejectFollowRequest(user.uid, targetUserId);
      setStatus('none');
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setLoading(false);
    }
  };

  const sizeClasses = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base'
  };

  const iconSizes = {
    sm: 14,
    md: 16,
    lg: 20
  };

  const getButtonContent = () => {
    if (loading) {
      return <Loader2 size={iconSizes[size]} className="animate-spin" />;
    }

    switch (status) {
      case 'following':
        return (
          <>
            <UserMinus size={iconSizes[size]} />
            <span>Unfollow</span>
          </>
        );
      case 'requested':
        return (
          <>
            <Clock size={iconSizes[size]} />
            <span>Requested</span>
          </>
        );
      case 'incoming_request':
        return (
          <>
            <UserCheck size={iconSizes[size]} />
            <span>Accept</span>
          </>
        );
      default:
        return (
          <>
            <UserPlus size={iconSizes[size]} />
            <span>{isPrivate ? 'Request' : 'Follow'}</span>
          </>
        );
    }
  };

  const getButtonStyles = () => {
    if (variant === 'outline') {
      switch (status) {
        case 'following':
          return 'border-border text-secondary hover:text-red-500 hover:border-red-500';
        case 'requested':
          return 'border-yellow-500 text-yellow-600';
        case 'incoming_request':
          return 'border-accent text-accent hover:bg-accent hover:text-white';
        default:
          return 'border-accent text-accent hover:bg-accent hover:text-white';
      }
    }

    if (variant === 'ghost') {
      switch (status) {
        case 'following':
          return 'text-secondary hover:text-red-500';
        case 'requested':
          return 'text-yellow-600';
        case 'incoming_request':
          return 'text-accent hover:bg-accent/10';
        default:
          return 'text-accent hover:bg-accent/10';
      }
    }

    // Default variant
    switch (status) {
      case 'following':
        return 'bg-surface border border-border text-primary hover:text-red-500 hover:border-red-500';
      case 'requested':
        return 'bg-yellow-500/10 border border-yellow-500 text-yellow-700';
      case 'incoming_request':
        return 'bg-accent text-white hover:bg-accent/90';
      default:
        return 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20';
    }
  };

  if (status === 'incoming_request') {
    return (
      <div className={`flex items-center space-x-2 ${className}`}>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleAcceptRequest}
          disabled={loading}
          className={`flex items-center space-x-2 ${sizeClasses[size]} rounded-full font-semibold transition-all ${getButtonStyles()}`}
        >
          {getButtonContent()}
        </motion.button>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleRejectRequest}
          disabled={loading}
          className={`px-3 py-2 rounded-full border border-border text-secondary hover:text-red-500 hover:border-red-500 transition-all`}
        >
          <span className="text-sm">Reject</span>
        </motion.button>
      </div>
    );
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={status === 'following' ? handleUnfollow : handleFollow}
      disabled={loading || status === 'requested'}
      className={`flex items-center space-x-2 ${sizeClasses[size]} rounded-full font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed ${getButtonStyles()} ${className}`}
    >
      {getButtonContent()}
    </motion.button>
  );
}
