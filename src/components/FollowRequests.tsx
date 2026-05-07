import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { acceptFollowRequest, rejectFollowRequest, listenToFollowRequests } from '../lib/follow';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FollowRequest } from '../types';
import { UserCheck, UserX, Clock, Users } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface RequestWithUser extends FollowRequest {
  id: string;
  userData?: {
    displayName: string;
    photoURL?: string;
    bio?: string;
  };
}

interface FollowRequestsProps {
  onClose?: () => void;
  isOpen?: boolean;
}

export default function FollowRequests({ onClose, isOpen = true }: FollowRequestsProps) {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [requests, setRequests] = useState<RequestWithUser[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToFollowRequests(user.uid, async (followRequests) => {
      // Load user data for each request
      const requestsWithUser = await Promise.all(
        followRequests.map(async (req) => {
          const userDoc = await getDoc(doc(db, 'users', req.fromUid));
          return {
            ...req,
            id: req.fromUid,
            userData: userDoc.exists() ? userDoc.data() as any : undefined
          };
        })
      );
      setRequests(requestsWithUser);
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async (request: RequestWithUser) => {
    if (!user || loading[request.fromUid]) return;
    
    setLoading(prev => ({ ...prev, [request.fromUid]: true }));
    
    try {
      await acceptFollowRequest(user.uid, request.fromUid);
      
      // Notify the requester
      await sendNotification(
        request.fromUid,
        'follow',
        'Follow Request Accepted',
        `${user.displayName} accepted your follow request`,
        { fromUid: user.uid }
      );
    } catch (error) {
      console.error('Error accepting request:', error);
    } finally {
      setLoading(prev => ({ ...prev, [request.fromUid]: false }));
    }
  };

  const handleReject = async (request: RequestWithUser) => {
    if (!user || loading[request.fromUid]) return;
    
    setLoading(prev => ({ ...prev, [request.fromUid]: true }));
    
    try {
      await rejectFollowRequest(user.uid, request.fromUid);
    } catch (error) {
      console.error('Error rejecting request:', error);
    } finally {
      setLoading(prev => ({ ...prev, [request.fromUid]: false }));
    }
  };

  if (!isOpen) return null;

  return (
    <div className="bg-background border border-border rounded-2xl shadow-lg overflow-hidden">
      <div className="p-4 border-b border-border flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Users className="text-accent" size={20} />
          <h2 className="font-semibold">Follow Requests</h2>
          {requests.length > 0 && (
            <span className="px-2 py-0.5 bg-accent text-white text-xs font-bold rounded-full">
              {requests.length}
            </span>
          )}
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors"
          >
            <span className="text-sm">Close</span>
          </button>
        )}
      </div>

      <div className="max-h-96 overflow-y-auto">
        {requests.length === 0 ? (
          <div className="p-8 text-center text-secondary">
            <Clock size={48} className="mx-auto mb-3 opacity-50" />
            <p className="text-sm">No pending follow requests</p>
            <p className="text-xs mt-1 opacity-70">
              When someone requests to follow you, they will appear here
            </p>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {requests.map((request) => (
              <motion.div
                key={request.fromUid}
                layout
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -100 }}
                className="p-4 border-b border-border/50 last:border-b-0 hover:bg-surface/50 transition-colors"
              >
                <div className="flex items-start space-x-3">
                  <img
                    src={request.userData?.photoURL || `https://ui-avatars.com/api/?name=${request.userData?.displayName}&background=random`}
                    alt={request.userData?.displayName}
                    className="w-12 h-12 rounded-full object-cover"
                  />
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate">
                        {request.userData?.displayName || 'Unknown User'}
                      </h3>
                      <span className="text-xs text-secondary">
                        {request.createdAt && formatDistanceToNow(request.createdAt.toDate(), { addSuffix: true })}
                      </span>
                    </div>
                    
                    {request.userData?.bio && (
                      <p className="text-xs text-secondary mt-1 line-clamp-2">
                        {request.userData.bio}
                      </p>
                    )}
                    
                    <div className="flex items-center space-x-2 mt-3">
                      <button
                        onClick={() => handleAccept(request)}
                        disabled={loading[request.fromUid]}
                        className="flex items-center space-x-1 px-3 py-1.5 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 disabled:opacity-50 transition-all"
                      >
                        {loading[request.fromUid] ? (
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        ) : (
                          <UserCheck size={16} />
                        )}
                        <span>Accept</span>
                      </button>
                      
                      <button
                        onClick={() => handleReject(request)}
                        disabled={loading[request.fromUid]}
                        className="flex items-center space-x-1 px-3 py-1.5 border border-border text-secondary text-sm font-medium rounded-full hover:text-red-500 hover:border-red-500 disabled:opacity-50 transition-all"
                      >
                        <UserX size={16} />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
