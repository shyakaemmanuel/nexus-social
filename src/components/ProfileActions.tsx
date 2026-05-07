import React, { useState, useEffect } from 'react';
import { User, Heart, MessageCircle, MoreVertical, Lock, Globe } from 'lucide-react';
import { auth } from '../lib/firebase';
import { isFollowing, followUser, unfollowUser, acceptFollowRequest, rejectFollowRequest, getFollowRequests } from '../lib/follow';
import { canSendMessage, getOrCreateChat } from '../lib/messaging';
import { useNavigate } from 'react-router-dom';

interface ProfileActionsProps {
  profileUserId: string;
  profileUser: any;
  onFollowChange?: () => void;
}

export const ProfileActions: React.FC<ProfileActionsProps> = ({ 
  profileUserId, 
  profileUser,
  onFollowChange 
}) => {
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [hasPendingRequest, setHasPendingRequest] = useState(false);
  const [canMessage, setCanMessage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    loadFollowStatus();
  }, [profileUserId, currentUserId]);

  const loadFollowStatus = async () => {
    if (!currentUserId || currentUserId === profileUserId) {
      setLoading(false);
      return;
    }

    try {
      const [following, requests] = await Promise.all([
        isFollowing(currentUserId, profileUserId),
        getFollowRequests(profileUserId)
      ]);

      setIsFollowingUser(following);
      setHasPendingRequest(
        requests.some((req: any) => req.fromUid === currentUserId && req.status === 'pending')
      );

      const messageAllowed = await canSendMessage(currentUserId, profileUserId);
      setCanMessage(messageAllowed);
    } catch (error) {
      console.error('Error loading follow status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleFollow = async () => {
    if (!currentUserId) return;
    setActionLoading(true);

    try {
      await followUser(currentUserId, profileUserId);
      setIsFollowingUser(true);
      setHasPendingRequest(false);
      
      // Recheck messaging permission
      const messageAllowed = await canSendMessage(currentUserId, profileUserId);
      setCanMessage(messageAllowed);
      
      onFollowChange?.();
    } catch (error: any) {
      console.error('Error following user:', error);
      if (error.message === 'User not found') {
        alert('User not found');
      } else if (error.message === 'Cannot follow yourself') {
        alert('Cannot follow yourself');
      } else {
        alert('Error following user');
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnfollow = async () => {
    if (!currentUserId) return;
    
    if (!confirm('Are you sure you want to unfollow this user?')) {
      return;
    }

    setActionLoading(true);

    try {
      await unfollowUser(currentUserId, profileUserId);
      setIsFollowingUser(false);
      setHasPendingRequest(false);
      setCanMessage(false);
      onFollowChange?.();
    } catch (error) {
      console.error('Error unfollowing user:', error);
      alert('Error unfollowing user');
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!currentUserId) return;

    if (!canMessage) {
      if (profileUser.isPrivate) {
        alert('Follow this user to send messages');
      } else {
        alert('This user does not allow messages from non-followers');
      }
      return;
    }

    try {
      const chatId = await getOrCreateChat(currentUserId, profileUserId);
      navigate(`/chat/${chatId}`);
    } catch (error) {
      console.error('Error opening chat:', error);
      alert('Error opening chat');
    }
  };

  if (loading || currentUserId === profileUserId) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 mt-4">
      {isFollowingUser ? (
        <>
          <button
            onClick={handleUnfollow}
            disabled={actionLoading}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Loading...' : 'Following'}
          </button>
          <button
            onClick={handleMessage}
            disabled={!canMessage || actionLoading}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} />
            Message
          </button>
        </>
      ) : hasPendingRequest ? (
        <button
          disabled
          className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold cursor-not-allowed"
        >
          Request Sent
        </button>
      ) : (
        <>
          <button
            onClick={handleFollow}
            disabled={actionLoading}
            className="flex-1 px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50"
          >
            {actionLoading ? 'Loading...' : 'Follow'}
          </button>
          <button
            onClick={handleMessage}
            disabled={!canMessage || actionLoading}
            className="flex-1 px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-lg font-semibold hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
          >
            <MessageCircle size={18} />
            Message
          </button>
        </>
      )}

      <button className="p-2 bg-gray-200 dark:bg-gray-700 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
        <MoreVertical size={18} className="text-gray-800 dark:text-gray-200" />
      </button>
    </div>
  );
};
