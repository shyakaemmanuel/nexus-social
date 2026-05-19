import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { collection, query, where, orderBy, onSnapshot, doc, getDoc, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Story, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, X, Play, Camera } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Tooltip } from './Tooltip';

interface StoryGroup {
  userId: string;
  userName: string;
  userPhoto: string;
  stories: Story[];
  hasUnseen: boolean;
}

export const StorySection: React.FC<{ onStoryClick: (stories: Story[]) => void }> = ({ onStoryClick }) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [storyGroups, setStoryGroups] = useState<StoryGroup[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);

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
    <div className="mb-3 flex items-center gap-3 overflow-x-auto border-b border-border/70 bg-background px-1 pb-3 pt-1 no-scrollbar">
      {/* Create Story */}
      <Tooltip content="Create Story" position="top" delay={300}>
        <div className="flex flex-shrink-0 flex-col items-center gap-1">
          <button
            onClick={() => navigate('/create-story')}
            className="relative group"
          >
            <div className="h-16 w-16 rounded-full border border-border bg-surface p-1 transition-colors group-hover:border-accent">
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`}
                alt="My Story"
                className="w-full h-full rounded-full object-cover"
              />
            </div>
            <div className="absolute bottom-0 right-0 rounded-full border-2 border-background bg-accent p-1 text-white transition-transform group-hover:scale-110">
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
            className="flex flex-shrink-0 flex-col items-center gap-1"
          >
            <div className={`h-16 w-16 rounded-full p-1 ${group.hasUnseen ? 'bg-gradient-to-tr from-accent via-fuchsia-500 to-amber-400' : 'border border-border bg-surface'} transition-colors`}>
              <img
                src={group.userPhoto || `https://ui-avatars.com/api/?name=${group.userName}&background=random`}
                alt={group.userName}
                className="h-full w-full rounded-full border-2 border-background object-cover"
              />
            </div>
            <span className="text-[10px] font-medium text-primary truncate w-16 text-center">
              {group.userId === user?.uid ? 'You' : group.userName.split(' ')[0]}
            </span>
          </button>
        </Tooltip>
      ))}
    </div>
  );
};
