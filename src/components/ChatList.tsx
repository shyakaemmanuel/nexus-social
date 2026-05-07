import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { Chat } from '../types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { MessageSquare, Search, ChevronRight, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { Logo } from './Logo';

// Skeleton loading component
function ChatListSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {[1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="flex items-center space-x-3 p-3 rounded-lg">
          <div className="w-12 h-12 rounded-full bg-surface animate-pulse" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 bg-surface rounded animate-pulse" />
            <div className="h-3 w-48 bg-surface rounded animate-pulse" />
          </div>
        </div>
      ))}
    </div>
  );
}

interface ChatUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
}

export default function ChatList() {
  const { chats, activeChat, setActiveChat, setActiveChatById, loading } = useChat();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();
  const [searchQuery, setSearchQuery] = useState('');
  const [chatUsers, setChatUsers] = useState<Record<string, ChatUser>>({});

  // Load chat from URL on mount
  useEffect(() => {
    if (chatId && user) {
      setActiveChatById(chatId).catch(() => {
        // Chat not found or access denied, navigate back to chat list
        navigate('/chats');
      });
    }
  }, [chatId, user]);

  // Load user data for chats
  useEffect(() => {
    const loadUsers = async () => {
      const users: Record<string, ChatUser> = {};
      
      for (const chat of chats) {
        const otherUid = chat.participants.find(uid => uid !== user?.uid);
        if (otherUid && !users[otherUid]) {
          const userDoc = await getDoc(doc(db, 'users', otherUid));
          if (userDoc.exists()) {
            const data = userDoc.data();
            users[otherUid] = {
              uid: otherUid,
              displayName: data.displayName,
              photoURL: data.photoURL,
              status: data.status || 'offline'
            };
          }
        }
      }
      
      setChatUsers(users);
    };
    
    if (chats.length > 0) {
      loadUsers();
    }
  }, [chats, user]);

  const handleChatClick = (chat: Chat) => {
    setActiveChat(chat);
    navigate(`/chats/${chat.id}`);
  };

  const filteredChats = chats.filter(chat => {
    const otherUid = chat.participants.find(uid => uid !== user?.uid);
    const otherUser = otherUid ? chatUsers[otherUid] : null;
    return otherUser?.displayName.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const getOtherParticipant = (chat: Chat) => {
    const otherUid = chat.participants.find(uid => uid !== user?.uid);
    return otherUid ? chatUsers[otherUid] : null;
  };

  const getUnreadCount = (chat: Chat) => {
    if (!user) return 0;
    return chat.unreadCount?.[user.uid] || 0;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  return (
    <div className="h-full flex flex-col bg-background border-r border-border">
      {/* Header */}
      <div className="p-4 border-b border-border">
        <div className="flex items-center justify-between mb-4">
          <Logo variant="icon" size="sm" />
          <h1 className="text-xl font-bold">Messages</h1>
          <div className="w-8" />
        </div>
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={18} />
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <ChatListSkeleton />
        ) : filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-64 text-secondary px-4">
            <div className="w-16 h-16 rounded-full bg-surface/50 flex items-center justify-center mb-4">
              <Users size={32} className="opacity-50" />
            </div>
            <p className="text-sm font-medium">No conversations yet</p>
            <p className="text-xs mt-1 text-center max-w-xs">
              Start chatting with people by visiting their profile or searching for users
            </p>
            <div className="flex flex-col space-y-2 mt-4">
              <button 
                onClick={() => navigate('/search')}
                className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 transition-colors"
              >
                Find people to message
              </button>
              <button 
                onClick={() => navigate('/groups')}
                className="px-4 py-2 border border-border text-sm font-medium rounded-full hover:bg-surface transition-colors"
              >
                Browse groups
              </button>
            </div>
          </div>
        ) : (
          <AnimatePresence mode="popLayout">
            {filteredChats.map((chat) => {
              const otherUser = getOtherParticipant(chat);
              const unreadCount = getUnreadCount(chat);
              const isActive = activeChat?.id === chat.id;

              return (
                <motion.button
                  key={chat.id}
                  layout
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  onClick={() => handleChatClick(chat)}
                  className={`w-full p-4 flex items-center space-x-3 hover:bg-surface/50 transition-colors border-b border-border/50 ${
                    isActive ? 'bg-accent/5 border-l-4 border-l-accent' : ''
                  }`}
                >
                  {/* Avatar */}
                  <div className="relative">
                    <img
                      src={otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherUser?.displayName}&background=random`}
                      alt={otherUser?.displayName}
                      className="w-12 h-12 rounded-full object-cover"
                    />
                    <span className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-background ${getStatusColor(otherUser?.status)}`} />
                  </div>

                  {/* Content */}
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center justify-between">
                      <h3 className="font-semibold text-sm truncate">{otherUser?.displayName}</h3>
                      {chat.lastMessageAt && (
                        <span className="text-xs text-secondary">
                          {formatDistanceToNow(chat.lastMessageAt.toDate(), { addSuffix: false })}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between mt-0.5">
                      <p className={`text-sm truncate ${unreadCount > 0 ? 'font-medium text-primary' : 'text-secondary'}`}>
                        {chat.lastMessage || 'No messages yet'}
                      </p>
                      {unreadCount > 0 && (
                        <span className="ml-2 px-2 py-0.5 bg-accent text-white text-xs font-bold rounded-full">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight size={18} className="text-secondary" />
                </motion.button>
              );
            })}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
