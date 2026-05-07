import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Chat, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Search, Edit, MoreHorizontal, MessageCircle } from 'lucide-react';
import { motion } from 'motion/react';
import { formatDistanceToNow } from 'date-fns';
import { useNavigate } from 'react-router-dom';
import { UserStatusDot } from '../components/UserStatusDot';

const ChatItem: React.FC<{ chat: Chat; user: User | null; navigate: (path: string) => void }> = ({ chat, user, navigate }) => {
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);
  const otherUserId = chat.participants.find(id => id !== user?.uid);

  useEffect(() => {
    if (chat.type === 'direct' && otherUserId) {
      getDoc(doc(db, 'users', otherUserId)).then(doc => {
        if (doc.exists()) setOtherUser(doc.data() as User);
      }).catch(err => {
        handleFirestoreError(err, OperationType.GET, `users/${otherUserId}`);
      });
    }

    if (user) {
      const q = query(collection(db, 'chats', chat.id, 'messages'));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const unread = snapshot.docs.filter(doc => {
          const data = doc.data();
          return data.senderUid !== user.uid && !data.read;
        }).length;
        setUnreadCount(unread);
      }, (err) => {
        handleFirestoreError(err, OperationType.LIST, `chats/${chat.id}/messages`);
      });
      return () => unsubscribe();
    }
  }, [chat, otherUserId, user]);

  const name = chat.type === 'group' ? chat.name : otherUser?.displayName || 'User';
  const photo = chat.type === 'group' ? `https://ui-avatars.com/api/?name=${chat.name}&background=random` : otherUser?.photoURL || `https://ui-avatars.com/api/?name=${name}&background=random`;

  return (
    <motion.div
      whileHover={{ backgroundColor: 'rgba(var(--accent-rgb), 0.02)' }}
      onClick={() => navigate(`/chats/${chat.id}`)}
      className="flex items-center space-x-5 p-6 cursor-pointer transition-all border-b border-border/30 last:border-0 group"
    >
      <div className="relative">
        <div className="absolute -inset-1 bg-gradient-to-tr from-accent to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-[2px]" />
        <img
          src={photo}
          alt={name}
          className="relative w-16 h-16 rounded-full object-cover border-2 border-background shadow-sm"
        />
        {chat.type === 'direct' && otherUser && (
          <UserStatusDot 
            user={otherUser} 
            className="absolute -bottom-1 -right-1 w-5 h-5 border-4" 
            size="md"
          />
        )}
        {unreadCount > 0 && (
          <div className="absolute -top-2 -right-2 bg-accent text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-4 border-background shadow-lg shadow-accent/20">
            {unreadCount}
          </div>
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <h3 className={`font-black text-sm tracking-tight truncate ${unreadCount > 0 ? 'text-primary' : 'text-primary/80'}`}>{name}</h3>
          {chat.lastMessageAt && (
            <span className={`text-[10px] font-bold uppercase tracking-tighter ${unreadCount > 0 ? 'text-accent' : 'text-secondary'}`}>
              {formatDistanceToNow(chat.lastMessageAt.toDate(), { addSuffix: false })}
            </span>
          )}
        </div>
        <p className={`text-xs truncate leading-relaxed ${unreadCount > 0 ? 'text-primary font-bold' : 'text-secondary font-medium'}`}>
          {chat.lastMessage || 'Start a conversation'}
        </p>
      </div>
    </motion.div>
  );
};

export default function ChatList() {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'users', user.uid, 'blockedUsers'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setBlockedUserIds(snapshot.docs.map(doc => doc.data().blockedUid));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, `users/${user.uid}/blockedUsers`);
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', user.uid),
      orderBy('lastMessageAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
      setChats(chatsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'chats');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredChats = chats.filter(chat => {
    if (chat.type === 'direct') {
      const otherId = chat.participants.find(id => id !== user?.uid);
      if (otherId && blockedUserIds.includes(otherId)) return false;
    }
    return true;
  });

  return (
    <div className="max-w-2xl mx-auto bg-background min-h-screen border-x border-border shadow-2xl shadow-zinc-200/50 dark:shadow-none">
      <div className="p-8 border-b border-border sticky top-0 bg-background/80 backdrop-blur-xl z-10">
        <div className="flex items-center justify-between mb-8">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black tracking-tighter">Messages</h1>
            <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em] mt-1">Nexus Communications</p>
          </div>
          <div className="flex space-x-3">
            <button className="p-3 bg-surface border border-border rounded-2xl text-secondary hover:text-primary transition-all">
              <MoreHorizontal size={20} />
            </button>
            <button className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all">
              <Edit size={20} />
            </button>
          </div>
        </div>

        <div className="relative group">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none">
            <Search className="text-secondary group-focus-within:text-accent transition-colors" size={18} />
          </div>
          <input
            type="text"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-14 pr-6 py-4 bg-surface border border-border rounded-[2rem] text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-sm"
          />
        </div>
      </div>

      {loading ? (
        <div className="p-8 space-y-6">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="flex items-center space-x-4 animate-pulse">
              <div className="w-16 h-16 bg-surface rounded-[1.5rem]" />
              <div className="flex-1 space-y-3">
                <div className="h-4 bg-surface rounded-full w-1/4" />
                <div className="h-3 bg-surface rounded-full w-3/4" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="divide-y divide-border/50">
          {filteredChats.map(chat => (
            <ChatItem key={chat.id} chat={chat} user={user} navigate={navigate} />
          ))}
          {filteredChats.length === 0 && (
            <div className="text-center py-32 px-10">
              <div className="w-24 h-24 bg-surface rounded-[2.5rem] flex items-center justify-center mx-auto mb-8 border border-border shadow-sm">
                <MessageCircle size={40} className="text-zinc-200" />
              </div>
              <h2 className="text-xl font-black tracking-tight mb-2">No messages yet</h2>
              <p className="text-sm text-secondary max-w-xs mx-auto">Connect with your friends and start sharing moments in real-time.</p>
              <button className="mt-8 px-8 py-3 bg-accent text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-accent/20 hover:scale-105 transition-all">
                Find Friends
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
