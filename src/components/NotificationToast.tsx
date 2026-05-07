import React, { useEffect, useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, MessageCircle, Heart, UserPlus, X } from 'lucide-react';
import { Notification } from '../types';

export const NotificationToast = () => {
  const { notifications } = useNotifications();
  const [activeNotification, setActiveNotification] = useState<Notification | null>(null);
  const [lastNotifId, setLastNotifId] = useState<string | null>(null);

  useEffect(() => {
    if (notifications.length > 0) {
      const latest = notifications[0];
      // Only show if it's new, unread, and created in the last 10 seconds
      const isRecent = latest.createdAt && (Date.now() - latest.createdAt.toMillis()) < 10000;
      
      if (!latest.read && latest.id !== lastNotifId && isRecent) {
        setActiveNotification(latest);
        setLastNotifId(latest.id);
        
        const timer = setTimeout(() => {
          setActiveNotification(null);
        }, 5000);
        
        return () => clearTimeout(timer);
      }
    }
  }, [notifications, lastNotifId]);

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'message': return <MessageCircle size={18} className="text-blue-500" />;
      case 'like': return <Heart size={18} className="text-red-500" fill="currentColor" />;
      case 'follow': return <UserPlus size={18} className="text-green-500" />;
      case 'comment': return <MessageCircle size={18} className="text-accent" />;
      default: return <Bell size={18} className="text-accent" />;
    }
  };

  return (
    <AnimatePresence>
      {activeNotification && (
        <motion.div
          initial={{ y: -100, opacity: 0 }}
          animate={{ y: 20, opacity: 1 }}
          exit={{ y: -100, opacity: 0 }}
          className="fixed top-0 left-4 right-4 z-[9999] flex justify-center pointer-events-none"
        >
          <div className="bg-background/80 backdrop-blur-xl border border-border/50 rounded-[2rem] p-4 shadow-2xl flex items-center space-x-4 max-w-md w-full pointer-events-auto ring-1 ring-black/5">
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-tr from-accent to-purple-500 rounded-xl blur-[2px] opacity-20" />
              <div className="relative p-2.5 bg-background rounded-xl border border-border/50 shadow-sm">
                {getIcon(activeNotification.type)}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-black text-primary tracking-tight truncate">{activeNotification.title}</p>
              <p className="text-[10px] font-bold text-secondary uppercase tracking-widest truncate opacity-70">{activeNotification.body}</p>
            </div>
            <button 
              onClick={() => setActiveNotification(null)}
              className="p-2 hover:bg-surface rounded-full transition-all active:scale-90 text-secondary"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
