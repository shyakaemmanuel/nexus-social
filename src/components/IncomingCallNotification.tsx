import React, { useEffect, useState } from 'react';
import { PhoneCall, X, Video, Phone } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { listenToIncomingInvitations, acceptMeetingInvitation, rejectMeetingInvitation, joinMeeting } from '../lib/meetings';
import { MeetingInvitation } from '../types';

export const IncomingCallNotification: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [incomingCall, setIncomingCall] = useState<MeetingInvitation | null>(null);
  const [callerName, setCallerName] = useState<string>('');

  useEffect(() => {
    if (!user) return;

    const unsubscribe = listenToIncomingInvitations(user.uid, (invitations) => {
      if (invitations.length > 0) {
        const latest = invitations[0];
        setIncomingCall(latest);
        
        // Get caller name
        // This would typically be fetched from the users collection
        setCallerName('Incoming Call');
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleAccept = async () => {
    if (!incomingCall) return;

    try {
      await acceptMeetingInvitation(incomingCall.id);
      await joinMeeting(incomingCall.meetingId, user!.uid, 'video', 'participant');
      navigate(`/meeting/${incomingCall.meetingId}`);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error accepting call:', error);
    }
  };

  const handleReject = async () => {
    if (!incomingCall) return;

    try {
      await rejectMeetingInvitation(incomingCall.id);
      setIncomingCall(null);
    } catch (error) {
      console.error('Error rejecting call:', error);
    }
  };

  return (
    <AnimatePresence>
      {incomingCall && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-4 left-4 right-4 md:left-auto md:right-4 md:w-96 bg-gray-900 border border-gray-700 rounded-2xl p-4 shadow-2xl z-50 flex items-center justify-between"
        >
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center">
              <PhoneCall size={24} className="text-blue-500 animate-bounce" />
            </div>
            <div>
              <p className="text-white text-sm font-bold">{callerName}</p>
              <p className="text-gray-400 text-xs">Incoming video call...</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={handleReject}
              className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              title="Decline"
            >
              <X size={20} />
            </button>
            <button
              onClick={handleAccept}
              className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
              title="Accept"
            >
              <Video size={20} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
