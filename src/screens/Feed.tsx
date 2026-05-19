import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post, Story } from '../types';
import { useAuth } from '../context/AuthContext';
import { Heart, Send, X, Search, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { StorySection } from '../components/StorySection';
import { StoryViewer } from '../components/StoryViewer';
import { CreateStoryModal } from '../components/CreateStoryModal';
import { NotificationCenter } from '../components/NotificationCenter';
import { ThemeToggle } from '../components/ThemeToggle';
import { PostCard } from '../components/PostCard';
import { CreatePost } from '../components/CreatePost';
import { Logo } from '../components/Logo';
import { useFirestoreListener } from '../lib/firestoreListenerManager';

export default function Feed() {
  const { user } = useAuth();
  const { addListener, removeListener } = useFirestoreListener();
  const [posts, setPosts] = useState<Post[]>([]);
  const [blockedUserIds, setBlockedUserIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStoryGroup, setSelectedStoryGroup] = useState<Story[] | null>(null);
  const [editingStory, setEditingStory] = useState<Story | null>(null);
  const listenersSetupRef = useRef(false);

  useEffect(() => {
    if (!user || listenersSetupRef.current) return;
    
    listenersSetupRef.current = true;

    // Set loading false immediately - posts will load progressively
    setLoading(false);

    // Set up blocked users listener (non-blocking)
    addListener({
      id: 'Feed-blockedUsers',
      query: query(collection(db, 'users', user.uid, 'blockedUsers')),
      context: 'Feed-blockedUsers',
      onNext: (snapshot) => {
        const blockedIds = snapshot.docs
          .map(doc => {
            const data = doc.data();
            return data.blockedUid || data.uid; // Handle different field names
          })
          .filter(Boolean); // Remove undefined values
        setBlockedUserIds(blockedIds);
      },
      onError: (error) => {
        console.error('Error fetching blocked users:', error);
        // Don't block - feed can still work without blocked users
      }
    });

    // Set up posts listener with limit for faster initial load
    addListener({
      id: 'Feed-posts',
      query: query(collection(db, 'posts'), orderBy('createdAt', 'desc')),
      context: 'Feed-posts',
      onNext: (snapshot) => {
        try {
          const postsData = snapshot.docs
            .map(doc => {
              const data = doc.data();
              // Validate required fields
              if (!data.authorUid || !data.authorName) {
                console.warn('Invalid post data:', doc.id, data);
                return null;
              }
              return {
                id: doc.id,
                ...data
              };
            })
            .filter(Boolean) as Post[]; // Remove invalid posts
          setPosts(postsData);
        } catch (error) {
          console.error('Error processing posts snapshot:', error);
        }
      },
      onError: (error) => {
        console.error('Error in posts listener:', error);
        // Don't block - show empty feed if posts fail to load
      }
    });

    // Cleanup on unmount
    return () => {
      removeListener('Feed-blockedUsers');
      removeListener('Feed-posts');
      listenersSetupRef.current = false;
    };
  }, [user, addListener, removeListener]);

  const filteredPosts = posts.filter(post => {
    if (blockedUserIds.includes(post.authorUid)) return false;
    const search = searchQuery.toLowerCase();
    const matchesContent = post.content.toLowerCase().includes(search);
    const matchesTags = post.tags?.some(tag => tag.toLowerCase().includes(search));
    return matchesContent || matchesTags;
  });

  return (
    <div className="nexus-page">
      <div className="sticky top-0 z-40 border-b border-border/80 bg-background/90 px-4 py-3 backdrop-blur-2xl">
        <div className="flex items-center justify-between">
          <Logo variant="full" size="sm" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          <div className="flex items-center gap-1.5">
            <div className="relative hidden min-[390px]:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
              <input
                type="text"
                placeholder="Search Nexus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="h-10 w-36 rounded-full border border-border bg-surface/80 py-2 pl-9 pr-9 text-xs font-medium backdrop-blur transition-all placeholder:text-secondary/75 hover:bg-surface focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/20"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary transition-colors hover:text-primary"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center gap-1">
              <button className="nexus-icon-button" aria-label="Activity">
                <Heart size={20} />
              </button>
              <button className="nexus-icon-button" aria-label="Direct messages">
                <Send size={20} />
              </button>
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </div>
        </div>
      </div>

      <div className="px-3 pt-3">
        <StorySection onStoryClick={setSelectedStoryGroup} />
        <CreatePost />

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              className="w-10 h-10 border-4 border-accent border-t-transparent rounded-full"
            />
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.length === 0 ? (
              <div className="px-6 py-20 text-center">
                <div className="mx-auto mb-4 flex h-20 w-20 items-center justify-center rounded-full bg-surface">
                  <Heart size={32} className="text-secondary" />
                </div>
                <p className="text-secondary font-medium">No posts yet</p>
                <p className="text-secondary/60 text-sm mt-2">{searchQuery ? `We couldn't find any posts matching "${searchQuery}".` : "Be the first to share something!"}</p>
              </div>
            ) : (
              filteredPosts.map(post => (
                <PostCard key={post.id} post={post} onTagClick={(tag) => setSearchQuery(tag)} />
              ))
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="wait">
        {selectedStoryGroup && (
          <StoryViewer 
            key={selectedStoryGroup[0]?.id || 'story-viewer'}
            stories={selectedStoryGroup} 
            isOpen={!!selectedStoryGroup} 
            onClose={() => setSelectedStoryGroup(null)}
            onEditStory={(story) => {
              setEditingStory(story);
              setSelectedStoryGroup(null);
            }}
          />
        )}
      </AnimatePresence>

      <CreateStoryModal 
        isOpen={!!editingStory}
        onClose={() => setEditingStory(null)}
        editStory={editingStory}
      />
    </div>
  );
}
