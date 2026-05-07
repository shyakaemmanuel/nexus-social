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
    <div className="max-w-2xl mx-auto pb-20">
      <div className="sticky top-0 z-40 bg-background/80 backdrop-blur-xl border-b border-border px-4 sm:px-6 py-4 mb-6">
        <div className="flex items-center justify-between">
          <Logo variant="full" size="md" onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} />

          <div className="flex items-center space-x-2">
            <div className="relative hidden sm:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={16} />
              <input
                type="text"
                placeholder="Search Nexus..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="bg-surface/80 backdrop-blur border border-border rounded-full py-2.5 pl-9 pr-10 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all w-48 lg:w-64 hover:bg-surface"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-secondary hover:text-primary transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>
            <div className="flex items-center space-x-1">
              <button className="p-2.5 text-primary hover:bg-surface/80 backdrop-blur rounded-full transition-all active:scale-90 shadow-sm hover:shadow-md">
                <Heart size={22} />
              </button>
              <button className="p-2.5 text-primary hover:bg-surface/80 backdrop-blur rounded-full transition-all active:scale-90 shadow-sm hover:shadow-md">
                <Send size={22} />
              </button>
              <div className="w-px h-6 bg-border mx-1" />
              <ThemeToggle />
              <NotificationCenter />
            </div>
          </div>
        </div>
      </div>

      <div className="px-4">
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
          <div className="space-y-6">
            {filteredPosts.length === 0 ? (
              <div className="text-center py-20">
                <div className="w-20 h-20 bg-surface rounded-full flex items-center justify-center mx-auto mb-4">
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
