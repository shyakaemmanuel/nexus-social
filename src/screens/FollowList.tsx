import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, onSnapshot, doc, getDoc, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Search, UserPlus, UserMinus, Loader2, Users } from 'lucide-react';
import { UserStatusDot } from '../components/UserStatusDot';

interface FollowListProps {
  type: 'followers' | 'following';
}

export default function FollowList({ type }: FollowListProps) {
  const { uid } = useParams();
  const navigate = useNavigate();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [profileName, setProfileName] = useState('');

  useEffect(() => {
    if (!uid) return;

    // Fetch profile name for header
    getDoc(doc(db, 'users', uid)).then(snap => {
      if (snap.exists()) {
        setProfileName(snap.data().displayName);
      }
    });

    const q = query(
      collection(db, 'users', uid, type),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const userIds = snapshot.docs.map(doc => doc.id);
      const userPromises = userIds.map(id => getDoc(doc(db, 'users', id)));
      
      try {
        const userSnaps = await Promise.all(userPromises);
        const usersData = userSnaps
          .filter(snap => snap.exists())
          .map(snap => ({ uid: snap.id, ...snap.data() } as User));
        
        setUsers(usersData);
        setLoading(false);
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, `users/${uid}/${type}`);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `users/${uid}/${type}`);
    });

    return () => unsubscribe();
  }, [uid, type]);

  const filteredUsers = users.filter(user => 
    user.displayName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 h-16 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-surface rounded-full transition-colors"
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 className="font-black text-lg tracking-tight capitalize">{type}</h1>
            <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{profileName}</p>
          </div>
        </div>
      </header>

      {/* Search */}
      <div className="p-4">
        <div className="relative group">
          <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none">
            <Search size={18} className="text-secondary group-focus-within:text-accent transition-colors" />
          </div>
          <input
            type="text"
            placeholder={`Search ${type}...`}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-surface border border-border rounded-2xl py-3 pl-12 pr-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
      </div>

      {/* List */}
      <div className="px-4 space-y-2">
        {loading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="animate-spin text-accent mb-4" size={32} />
            <p className="text-sm text-secondary font-medium">Loading users...</p>
          </div>
        ) : filteredUsers.length > 0 ? (
          <AnimatePresence mode="popLayout">
            {filteredUsers.map((user, index) => (
              <motion.div
                key={user.uid}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => navigate(`/profile/${user.uid}`)}
                className="flex items-center justify-between p-3 bg-surface border border-border rounded-2xl hover:border-accent/30 transition-all cursor-pointer group"
              >
                <div className="flex items-center space-x-3">
                  <div className="relative">
                    <div className="absolute -inset-1 bg-gradient-to-tr from-accent to-purple-500 rounded-full blur-[2px] opacity-0 group-hover:opacity-50 transition-opacity" />
                    <img
                      src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
                      alt={user.displayName}
                      className="relative w-12 h-12 rounded-full object-cover border border-border"
                    />
                    <UserStatusDot 
                      user={user} 
                      className="absolute -bottom-1 -right-1 w-4 h-4 border-2" 
                      size="sm"
                    />
                  </div>
                  <div>
                    <h3 className="font-black text-sm tracking-tight">{user.displayName}</h3>
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest line-clamp-1">
                      {user.bio || 'No bio yet'}
                    </p>
                  </div>
                </div>
                <button className="p-2 text-secondary hover:text-accent transition-colors">
                  <ChevronLeft size={18} className="rotate-180" />
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-16 h-16 bg-surface rounded-3xl flex items-center justify-center mb-4">
              <Users size={32} className="text-secondary" />
            </div>
            <h3 className="font-black text-lg mb-1">No users found</h3>
            <p className="text-sm text-secondary max-w-[200px]">
              {searchQuery ? `No matches for "${searchQuery}"` : `This user doesn't have any ${type} yet.`}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
