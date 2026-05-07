import React, { useState, useEffect } from 'react';
import { Search, Send, MoreVertical, Phone, Video } from 'lucide-react';
import { auth } from '../lib/firebase';
import { collection, query, where, onSnapshot, orderBy, doc, getDoc, updateDoc, serverTimestamp, addDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { getUserChats, canSendMessage } from '../lib/messaging';
import { useNavigate } from 'react-router-dom';

interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: any;
  type: 'direct' | 'group';
}

interface User {
  uid: string;
  displayName: string;
  photoURL?: string;
  email: string;
}

export const MessageList: React.FC = () => {
  const [chats, setChats] = useState<Chat[]>([]);
  const [users, setUsers] = useState<Map<string, User>>(new Map());
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    const loadChats = async () => {
      try {
        const userChats = await getUserChats(currentUserId);
        
        // Sort by last message time
        const sortedChats = userChats.sort((a: any, b: any) => {
          const timeA = a.lastMessageAt?.toMillis() || 0;
          const timeB = b.lastMessageAt?.toMillis() || 0;
          return timeB - timeA;
        }) as Chat[];

        setChats(sortedChats);

        // Load user data for each chat participant
        const userIds = new Set<string>();
        sortedChats.forEach((chat: Chat) => {
          chat.participants.forEach(uid => {
            if (uid !== currentUserId) userIds.add(uid);
          });
        });

        const usersMap = new Map<string, User>();
        for (const uid of userIds) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            usersMap.set(uid, userDoc.data() as User);
          }
        }
        setUsers(usersMap);
      } catch (error) {
        console.error('Error loading chats:', error);
      } finally {
        setLoading(false);
      }
    };

    loadChats();

    // Set up real-time listener for chats
    const chatsQuery = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUserId)
    );

    const unsubscribe = onSnapshot(chatsQuery, async (snapshot) => {
      const updatedChats = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Chat));
      
      const sortedChats = updatedChats.sort((a, b) => {
        const timeA = a.lastMessageAt?.toMillis() || 0;
        const timeB = b.lastMessageAt?.toMillis() || 0;
        return timeB - timeA;
      });

      setChats(sortedChats);

      // Update users map
      const userIds = new Set<string>();
      sortedChats.forEach((chat: Chat) => {
        chat.participants.forEach(uid => {
          if (uid !== currentUserId) userIds.add(uid);
        });
      });

      const usersMap = new Map<string, User>();
      for (const uid of userIds) {
        if (!usersMap.has(uid)) {
          const userDoc = await getDoc(doc(db, 'users', uid));
          if (userDoc.exists()) {
            usersMap.set(uid, userDoc.data() as User);
          }
        }
      }
      setUsers(usersMap);
    });

    return () => unsubscribe();
  }, [currentUserId]);

  const filteredChats = chats.filter(chat => {
    if (!searchQuery) return true;
    const otherUserId = chat.participants.find(uid => uid !== currentUserId);
    if (!otherUserId) return false;
    const user = users.get(otherUserId);
    return user?.displayName?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  const handleChatClick = (chatId: string) => {
    navigate(`/chat/${chatId}`);
  };

  const getChatUser = (chat: Chat): User | undefined => {
    const otherUserId = chat.participants.find(uid => uid !== currentUserId);
    return otherUserId ? users.get(otherUserId) : undefined;
  };

  const formatTime = (timestamp: any) => {
    if (!timestamp?.toDate) return '';
    const date = timestamp.toDate();
    if (!date) return '';
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const hours = Math.floor(diff / (1000 * 60 * 60));
    
    if (hours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (hours < 24 * 7) {
      return date.toLocaleDateString([], { weekday: 'short' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' });
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Messages</h1>
          <button className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-full transition-colors">
            <MoreVertical size={20} className="text-gray-600 dark:text-gray-400" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="relative">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search messages..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Chat List */}
      <div className="flex-1 overflow-y-auto">
        {filteredChats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <Send size={48} className="mb-4 opacity-50" />
            <p className="text-lg">No messages yet</p>
            <p className="text-sm">Start a conversation with someone</p>
          </div>
        ) : (
          filteredChats.map((chat) => {
            const user = getChatUser(chat);
            if (!user) return null;

            return (
              <div
                key={chat.id}
                onClick={() => handleChatClick(chat.id)}
                className="flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors border-b border-gray-100 dark:border-gray-800"
              >
                <div className="relative">
                  <img
                    src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
                    alt={user.displayName}
                    className="w-14 h-14 rounded-full object-cover"
                  />
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-white dark:border-gray-900"></div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                      {user.displayName}
                    </h3>
                    {chat.lastMessageAt && (
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        {formatTime(chat.lastMessageAt)}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400 truncate">
                    {chat.lastMessage || 'No messages yet'}
                  </p>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
