import React, { useState } from 'react';
import { useNotifications } from '../context/NotificationContext';
import { Bell, X, Check, Trash2, MessageCircle, Users, Video, Clock, Heart, UserPlus } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';

export const NotificationCenter = ({ variant = 'default' }: { variant?: 'default' | 'minimal' }) => {
  const { notifications, unreadCount, markAsRead, markAllAsRead, deleteNotification } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);

  const getIcon = (type: string) => {
    switch (type) {
      case 'message': return <MessageCircle size={16} className="text-blue-500" />;
      case 'group_activity': return <Users size={16} className="text-green-500" />;
      case 'meeting_invite': return <Video size={16} className="text-purple-500" />;
      case 'like': return <Heart size={16} className="text-red-500 fill-red-500" />;
      case 'follow': return <UserPlus size={16} className="text-accent" />;
      case 'follow_request': return <UserPlus size={16} className="text-yellow-500" />;
      case 'comment': return <MessageCircle size={16} className="text-orange-500" />;
      default: return <Bell size={16} className="text-zinc-500" />;
    }
  };

  return (
    <div className="relative">
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className={`relative p-2.5 rounded-full transition-all active:scale-90 ${
          variant === 'minimal' 
            ? 'bg-white/10 backdrop-blur-md text-white hover:bg-white/20' 
            : 'text-secondary hover:bg-surface'
        }`}
      >
        <Bell size={variant === 'minimal' ? 20 : 24} />
        {unreadCount > 0 && (
          <span className={`absolute top-1.5 right-1.5 w-5 h-5 bg-red-500 text-white text-[10px] font-black flex items-center justify-center rounded-full border-2 ${
            variant === 'minimal' ? 'border-black' : 'border-background'
          }`}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <>
            <div 
              className="fixed inset-0 z-40" 
              onClick={() => setIsOpen(false)} 
            />
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              className="absolute right-0 mt-2 w-80 md:w-96 bg-background rounded-2xl shadow-2xl border border-border z-50 overflow-hidden"
            >
              <div className="p-4 border-b border-border flex items-center justify-between bg-surface/50">
                <h3 className="font-bold text-primary">Notifications</h3>
                <div className="flex items-center space-x-2">
                  {unreadCount > 0 && (
                    <button 
                      onClick={markAllAsRead}
                      className="text-[10px] font-bold text-accent uppercase tracking-wider hover:underline"
                    >
                      Mark all as read
                    </button>
                  )}
                  <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-surface rounded-full transition-colors">
                    <X size={16} className="text-secondary" />
                  </button>
                </div>
              </div>

              <div className="max-h-[400px] overflow-y-auto custom-scrollbar">
                {notifications.length === 0 ? (
                  <div className="p-12 flex flex-col items-center justify-center text-center">
                    <div className="w-16 h-16 bg-surface rounded-full flex items-center justify-center mb-4">
                      <Bell size={32} className="text-zinc-300" />
                    </div>
                    <p className="text-sm font-medium text-secondary">No notifications yet</p>
                    <p className="text-xs text-zinc-400 mt-1">We'll notify you when something happens</p>
                  </div>
                ) : (
                  <div className="divide-y divide-border">
                    {notifications.map((notification) => (
                      <div 
                        key={notification.id}
                        className={`p-4 transition-colors hover:bg-surface group relative ${!notification.read ? 'bg-accent/5' : ''}`}
                      >
                        <div className="flex space-x-3">
                          <div className={`mt-1 w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${!notification.read ? 'bg-background shadow-sm' : 'bg-surface'}`}>
                            {getIcon(notification.type)}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-0.5">
                              <p className={`text-sm truncate ${!notification.read ? 'font-bold text-primary' : 'font-medium text-secondary'}`}>
                                {notification.title}
                              </p>
                              <span className="text-[10px] text-zinc-400 whitespace-nowrap ml-2 flex items-center">
                                <Clock size={10} className="mr-1" />
                                {formatDistanceToNow(notification.createdAt.toDate(), { addSuffix: true })}
                              </span>
                            </div>
                            <p className="text-xs text-zinc-500 line-clamp-2 leading-relaxed">
                              {notification.body}
                            </p>
                            
                            <div className="mt-3 flex items-center space-x-3 opacity-0 group-hover:opacity-100 transition-opacity">
                              {!notification.read && (
                                <button 
                                  onClick={() => markAsRead(notification.id)}
                                  className="text-[10px] font-bold text-accent uppercase tracking-widest flex items-center hover:underline"
                                >
                                  <Check size={12} className="mr-1" />
                                  Mark read
                                </button>
                              )}
                              <button 
                                onClick={() => deleteNotification(notification.id)}
                                className="text-[10px] font-bold text-red-500 uppercase tracking-widest flex items-center hover:underline"
                              >
                                <Trash2 size={12} className="mr-1" />
                                Delete
                              </button>
                            </div>
                          </div>
                        </div>
                        {!notification.read && (
                          <div className="absolute top-4 right-4 w-2 h-2 bg-accent rounded-full" />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {notifications.length > 0 && (
                <div className="p-3 bg-surface border-t border-border text-center">
                  <button className="text-[10px] font-black text-secondary uppercase tracking-widest hover:text-primary transition-colors">
                    View All Activity
                  </button>
                </div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
