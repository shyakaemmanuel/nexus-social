import React, { useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Story, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Play, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { CreateStoryModal } from './CreateStoryModal';
import { Tooltip } from './Tooltip';

interface StoryGroup {
  userId: string;
  userName: string;
  userPhoto: string;
  stories: Story[];
  hasUnseen: boolean;
}

export const StorySection: React.FC<{ onStoryClick: (stories: Story[]) => void }> = ({ onStoryClick }) => {
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

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
    const now = Timestamp.now();
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '>', now),
      orderBy('expiresAt', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const stories = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];

      const filteredStories = stories.filter(s => !blockedUserIds.includes(s.authorUid));

      // Group stories by author
      const groups: { [key: string]: StoryGroup } = {};
      filteredStories.forEach(story => {
        if (!groups[story.authorUid]) {
          groups[story.authorUid] = {
            userId: story.authorUid,
            userName: story.authorName,
            userPhoto: story.authorPhoto || '',
            stories: [],
            hasUnseen: false
          };
        }
        groups[story.authorUid].stories.push(story);
        if (user && !story.viewers?.includes(user.uid)) {
          groups[story.authorUid].hasUnseen = true;
        }
      });

      setStoryGroups(Object.values(groups));
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'stories');
    });

    return () => unsubscribe();
  }, [user]);

  return (
    <div className="flex items-center space-x-4 p-4 overflow-x-auto custom-scrollbar bg-background border-b border-border sticky top-0 z-30">
      {/* Create Story */}
      <Tooltip content="Create Story" position="top" delay={300}>
        <div className="flex flex-col items-center space-y-1 flex-shrink-0">
          <button
            onClick={() => setIsCreateModalOpen(true)}
            className="relative group"
          >
            <div className="w-16 h-16 rounded-full border-2 border-border p-1 group-hover:border-accent transition-colors">
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`}
                alt="My Story"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 bg-accent text-white rounded-full p-1 border-2 border-background group-hover:scale-110 transition-transform">
              <Plus size={12} />
            </div>
          </button>
          <span className="text-[10px] font-medium text-secondary">Your Story</span>
        </div>
      </Tooltip>

      {/* Story Groups */}
      {storyGroups.map(group => (
        <Tooltip key={group.userId} content={`${group.userName.split(' ')[0]}'s Story`} position="top" delay={300}>
          <button
            onClick={() => onStoryClick(group.stories)}
            className="flex flex-col items-center space-y-1 flex-shrink-0"
          >
            <div className={`w-16 h-16 rounded-full p-1 border-2 ${group.hasUnseen ? 'border-accent' : 'border-border'} transition-colors`}>
              <img
                src={group.userPhoto || `https://ui-avatars.com/api/?name=${group.userName}&background=random`}
                alt={group.userName}
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <span className="text-[10px] font-medium text-primary truncate w-16 text-center">
              {group.userId === user?.uid ? 'You' : group.userName.split(' ')[0]}
            </span>
          </button>
        </Tooltip>
      ))}

      {/* Create Story Modal */}
      <CreateStoryModal isOpen={isCreateModalOpen} onClose={() => setIsCreateModalOpen(false)} />
    </div>
  );
};
