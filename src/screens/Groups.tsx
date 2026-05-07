import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Group, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { Users, Plus, Search, MoreHorizontal, Shield, UserPlus, UserMinus, X, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';

const ManageAdminsModal = ({ group, isOpen, onClose }: { group: Group, isOpen: boolean, onClose: () => void }) => {
  const [members, setMembers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendNotification } = useNotifications();

  useEffect(() => {
    if (!isOpen) return;
    const q = collection(db, 'groups', group.id, 'members');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => doc.data() as User);
      setMembers(membersData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `groups/${group.id}/members`);
    });
    return () => unsubscribe();
  }, [isOpen, group.id]);

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    const groupRef = doc(db, 'groups', group.id);
    try {
      await updateDoc(groupRef, {
        adminUids: isAdmin ? arrayRemove(userId) : arrayUnion(userId)
      });

      if (!isAdmin) {
        await sendNotification(
          userId,
          'group_activity',
          `Promoted to Admin`,
          `You have been promoted to admin in ${group.name}.`,
          { groupId: group.id }
        );
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background w-full max-w-md rounded-3xl p-8 shadow-2xl max-h-[80vh] flex flex-col"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold">Manage Admins</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
            <X size={24} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-4 custom-scrollbar pr-2">
          {loading ? (
            <div className="text-center py-10 text-secondary">Loading members...</div>
          ) : (
            members.map(member => {
              const isAdmin = group.adminUids.includes(member.uid);
              const isCreator = group.creatorUid === member.uid;

              return (
                <div key={member.uid} className="flex items-center justify-between p-3 bg-surface rounded-2xl">
                  <div className="flex items-center space-x-3">
                    <img
                      src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}&background=random`}
                      alt={member.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <div>
                      <p className="text-sm font-semibold">{member.displayName}</p>
                      {isCreator && <p className="text-[10px] text-accent font-bold uppercase">Creator</p>}
                    </div>
                  </div>
                  {!isCreator && (
                    <button
                      onClick={() => toggleAdmin(member.uid, isAdmin)}
                      className={`p-2 rounded-xl transition-all ${
                        isAdmin ? 'bg-red-50 text-red-500 hover:bg-red-100' : 'bg-accent/10 text-accent hover:bg-accent/20'
                      }`}
                    >
                      {isAdmin ? <UserMinus size={20} /> : <Shield size={20} />}
                    </button>
                  )}
                </div>
              );
            })
          )}
        </div>
      </motion.div>
    </div>
  );
};

const GroupCard: React.FC<{ group: Group }> = ({ group }) => {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const [isMember, setIsMember] = useState(false);
  const [isManageOpen, setIsManageOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!user) return;
    const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
    const unsubscribe = onSnapshot(memberRef, (doc) => {
      setIsMember(doc.exists());
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `groups/${group.id}/members/${user.uid}`);
    });
    return () => unsubscribe();
  }, [user, group.id]);

  const handleJoin = async () => {
    if (!user) return;
    const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
    const groupRef = doc(db, 'groups', group.id);
    const chatRef = group.chatId ? doc(db, 'chats', group.chatId) : null;

    try {
      const batch = writeBatch(db);
      batch.set(memberRef, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        joinedAt: serverTimestamp()
      });
      batch.update(groupRef, {
        membersCount: increment(1)
      });
      if (chatRef) {
        batch.update(chatRef, {
          participants: arrayUnion(user.uid)
        });
      }
      await batch.commit();

      // Notify admins about new member
      const adminList = Array.from(new Set([...group.adminUids, group.creatorUid]));
      await Promise.all(adminList.map(adminId => 
        sendNotification(
          adminId,
          'group_activity',
          `New member in ${group.name}`,
          `${user.displayName} has joined the community.`,
          { groupId: group.id }
        )
      ));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/members/${user.uid}`);
    }
  };

  const handleLeave = async () => {
    if (!user) return;
    const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
    const groupRef = doc(db, 'groups', group.id);
    const chatRef = group.chatId ? doc(db, 'chats', group.chatId) : null;

    try {
      const batch = writeBatch(db);
      batch.delete(memberRef);
      batch.update(groupRef, {
        membersCount: increment(-1)
      });
      if (chatRef) {
        batch.update(chatRef, {
          participants: arrayRemove(user.uid)
        });
      }
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${group.id}/members/${user.uid}`);
    }
  };

  const isCreator = group.creatorUid === user?.uid;
  const isAdmin = group.adminUids.includes(user?.uid || '');

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-background border border-border rounded-2xl p-4 flex items-center space-x-4 shadow-sm hover:shadow-md transition-shadow"
    >
      <img
        src={group.photoURL || `https://ui-avatars.com/api/?name=${group.name}&background=random`}
        alt={group.name}
        className="w-16 h-16 rounded-full object-cover border border-border"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center space-x-2">
          <h3 className="font-bold text-base truncate">{group.name}</h3>
          {(isCreator || isAdmin) && <Shield size={14} className="text-accent" />}
        </div>
        <p className="text-xs text-secondary line-clamp-1 mb-2">{group.description || 'No description provided.'}</p>
        <div className="flex items-center space-x-4 text-[10px] font-semibold text-secondary uppercase tracking-wider">
          <span className="flex items-center space-x-1">
            <Users size={12} />
            <span>{group.membersCount} members</span>
          </span>
          <button
            onClick={isMember ? handleLeave : handleJoin}
            className={`flex items-center space-x-1 transition-colors ${
              isMember ? 'text-red-500 hover:text-red-600' : 'text-accent hover:text-accent/80'
            }`}
          >
            {isMember ? <UserMinus size={12} /> : <UserPlus size={12} />}
            <span>{isMember ? 'Leave' : 'Join'}</span>
          </button>
        </div>
      </div>
      <div className="flex flex-col space-y-2">
        {isMember && group.chatId && (
          <button
            onClick={() => navigate(`/chats/${group.chatId}`)}
            className="p-2 bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors"
            title="Group Chat"
          >
            <MessageSquare size={20} />
          </button>
        )}
        {(isCreator || isAdmin) && (
          <button
            onClick={() => setIsManageOpen(true)}
            className="p-2 bg-accent/10 text-accent rounded-xl hover:bg-accent/20 transition-colors"
            title="Manage Admins"
          >
            <Shield size={20} />
          </button>
        )}
        <button className="bg-surface p-2 rounded-xl text-secondary hover:text-accent transition-colors">
          <MoreHorizontal size={20} />
        </button>
      </div>

      <ManageAdminsModal
        group={group}
        isOpen={isManageOpen}
        onClose={() => setIsManageOpen(false)}
      />
    </motion.div>
  );
};

const CreateGroupModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user } = useAuth();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !user) return;

    setLoading(true);
    try {
      // 1. Create a placeholder for the group ID to use in the chat
      const groupRef = doc(collection(db, 'groups'));

      // 2. Create the chat with the groupId
      const chatRef = await addDoc(collection(db, 'chats'), {
        name: name,
        type: 'group',
        groupId: groupRef.id,
        participants: [user.uid],
        lastMessage: 'Group created',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      // 3. Create the group with the chatId
      await setDoc(groupRef, {
        name,
        description,
        creatorUid: user.uid,
        adminUids: [],
        chatId: chatRef.id,
        membersCount: 1,
        createdAt: serverTimestamp()
      });

      // 4. Add creator as first member
      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        joinedAt: serverTimestamp()
      });

      onClose();
      setName('');
      setDescription('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background w-full max-w-md rounded-3xl p-8 shadow-2xl"
      >
        <h2 className="text-2xl font-bold mb-6">Create Community</h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Group Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Photography Enthusiasts"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this group about?"
              className="w-full bg-surface border border-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none h-32"
            />
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-3 border border-border rounded-xl font-semibold text-secondary hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !name.trim()}
              className="flex-1 py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-all disabled:opacity-50"
            >
              {loading ? 'Creating...' : 'Create Group'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};

export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const groupsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Group[];
      setGroups(groupsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
    });

    return () => unsubscribe();
  }, []);

  const filteredGroups = groups.filter(g => 
    g.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    g.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="max-w-xl mx-auto px-4 pt-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Communities</h1>
          <p className="text-xs text-secondary font-medium uppercase tracking-wider mt-1">Discover and join groups</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="p-3 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:scale-105 active:scale-95 transition-all"
        >
          <Plus size={24} />
        </button>
      </div>

      <div className="relative mb-8">
        <Search className="absolute left-4 top-3.5 text-secondary" size={20} />
        <input
          type="text"
          placeholder="Search for communities"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-3.5 bg-background border border-border rounded-2xl text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
        />
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="bg-background border border-border rounded-2xl h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map(group => (
            <GroupCard key={group.id} group={group} />
          ))}
          {filteredGroups.length === 0 && (
            <div className="text-center py-20">
              <div className="w-20 h-20 bg-background border border-border rounded-3xl flex items-center justify-center mx-auto mb-4">
                <Users size={32} className="text-secondary" />
              </div>
              <h2 className="text-lg font-semibold mb-1">No groups found</h2>
              <p className="text-sm text-secondary">Try a different search or create your own community.</p>
            </div>
          )}
        </div>
      )}

      <CreateGroupModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
}
