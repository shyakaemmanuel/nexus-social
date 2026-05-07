import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, PanInfo } from 'motion/react';
import { X, ChevronLeft, ChevronRight, MoreHorizontal, Eye, MessageCircle, Heart, Trash2, Send, ChevronDown, Edit3, Music } from 'lucide-react';
import { Story, User, StoryReaction, StoryReply } from '../types';
import { useAuth } from '../context/AuthContext';
import { db } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, getDoc, deleteDoc, addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';

interface StoryViewerProps {
  stories: Story[];
  isOpen: boolean;
  onClose: () => void;
  onEditStory?: (story: Story) => void;
}

const EMOJI_REACTIONS = ['❤️', '😂', '😮', '🔥', '👍'];

const FloatingEmoji: React.FC<{ emoji: string; onDone: () => void }> = ({ emoji, onDone }) => (
  <motion.div
    initial={{ opacity: 1, y: 0, scale: 0.5 }}
    animate={{ opacity: 0, y: -120, scale: 1.5 }}
    transition={{ duration: 1, ease: 'easeOut' }}
    onAnimationComplete={onDone}
    className="absolute text-4xl pointer-events-none z-[70]"
    style={{ left: '50%', bottom: '30%', transform: 'translateX(-50%)' }}
  >
    {emoji}
  </motion.div>
);

export const StoryViewer: React.FC<StoryViewerProps> = ({ stories, isOpen, onClose, onEditStory }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [viewerProfiles, setViewerProfiles] = useState<User[]>([]);
  const [showViewers, setShowViewers] = useState(false);
  const [showReactions, setShowReactions] = useState(false);
  const [showReplyInput, setShowReplyInput] = useState(false);
  const [replyText, setReplyText] = useState('');
  const [replies, setReplies] = useState<StoryReply[]>([]);
  const [localReactions, setLocalReactions] = useState<StoryReaction[]>([]);
  const [userReaction, setUserReaction] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [floatingEmojis, setFloatingEmojis] = useState<Array<{ id: string; emoji: string }>>([]);
  const [showAuthorMenu, setShowAuthorMenu] = useState(false);
  const [isReacting, setIsReacting] = useState(false);
  const { user } = useAuth();
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const currentIndexRef = useRef(0);
  const isMountedRef = useRef(true);
  const STORY_DURATION = 5000;
  const y = useMotionValue(0);
  const opacity = useTransform(y, [0, 300], [1, 0]);

  const currentStory = stories[currentIndex];
  const isAuthor = user?.uid === currentStory?.authorUid;

  // Keep ref in sync
  currentIndexRef.current = currentIndex;

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, []);

  // Sync local reactions from prop when story changes (but not while processing)
  useEffect(() => {
    if (!currentStory || isReacting) return;
    const reactions = currentStory.reactions || [];
    setLocalReactions(reactions);

    if (user) {
      const userReacted = reactions.find(r => r.uid === user.uid);
      setUserReaction(userReacted?.emoji || null);
    } else {
      setUserReaction(null);
    }
  }, [currentStory?.id, user?.uid, isReacting]);

  // Sync replies from prop
  useEffect(() => {
    if (!currentStory) return;
    setReplies(currentStory.replies || []);
  }, [currentStory?.id]);

  // Fetch viewer profiles
  useEffect(() => {
    if (!isOpen || !currentStory || !currentStory.viewers?.length) {
      setViewerProfiles([]);
      return;
    }
    const fetchViewers = async () => {
      try {
        const profiles = await Promise.all(
          currentStory.viewers!.map(async (uid) => {
            const snap = await getDoc(doc(db, 'users', uid));
            return snap.exists() ? (snap.data() as User) : null;
          })
        );
        if (isMountedRef.current) {
          setViewerProfiles(profiles.filter((p): p is User => p !== null));
        }
      } catch (error) {
        if (isMountedRef.current) {
          console.error('Error fetching viewers:', error);
        }
      }
    };
    fetchViewers();
  }, [currentStory?.id, isOpen]);

  // Mark as viewed
  useEffect(() => {
    if (!user || !currentStory || currentStory.viewers?.includes(user.uid)) return;
    
    const markAsViewed = async () => {
      try {
        await updateDoc(doc(db, 'stories', currentStory.id), {
          viewers: arrayUnion(user.uid)
        });
      } catch (error) {
        if (isMountedRef.current) {
          console.error('Error marking story as viewed:', error);
        }
      }
    };
    
    markAsViewed();
  }, [currentStory?.id, user?.uid]);

  // Progress bar timer
  useEffect(() => {
    if (!isOpen || !currentStory) return;

    setProgress(0);
    if (progressInterval.current) clearInterval(progressInterval.current);

    const step = 100;
    const increment = (step / STORY_DURATION) * 100;

    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (isPaused || showViewers || showReplyInput || showReactions) return prev;
        if (prev >= 100) {
          // Use ref to get latest index
          const idx = currentIndexRef.current;
          if (idx < stories.length - 1) {
            setCurrentIndex(idx + 1);
          } else {
            onClose();
          }
          return 100;
        }
        return prev + increment;
      });
    }, step);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [currentIndex, isOpen, currentStory?.id, isPaused, showViewers, showReplyInput, showReactions]);

  const handleNext = useCallback(() => {
    if (currentIndexRef.current < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  }, [stories.length, onClose]);

  const handlePrev = useCallback(() => {
    if (currentIndexRef.current > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  }, []);

  const handleReaction = useCallback(async (emoji: string) => {
    if (!user || !currentStory || isReacting) return;

    setIsReacting(true);

    // Get current reactions from state
    let previousReactions: StoryReaction[] = [];
    setLocalReactions(prev => {
      previousReactions = prev;
      const existingIndex = prev.findIndex(r => r.uid === user.uid);

      if (existingIndex !== -1) {
        // Toggle: if same emoji, remove; if different, replace
        if (prev[existingIndex].emoji === emoji) {
          setUserReaction(null);
          return prev.filter(r => r.uid !== user.uid);
        } else {
          setUserReaction(emoji);
          return prev.map(r =>
            r.uid === user.uid ? { ...r, emoji } : r
          );
        }
      } else {
        setUserReaction(emoji);
        return [...prev, { uid: user.uid, emoji, createdAt: new Date() as any }];
      }
    });

    // Floating emoji animation
    const floatId = `${Date.now()}_${emoji}`;
    setFloatingEmojis(prev => [...prev, { id: floatId, emoji }]);

    // Persist to Firestore
    try {
      const storyRef = doc(db, 'stories', currentStory.id);
      const storySnap = await getDoc(storyRef);
      if (!storySnap.exists()) {
        setIsReacting(false);
        return;
      }
      
      const currentData = storySnap.data();
      const serverReactions = currentData.reactions || [];
      const existingReaction = serverReactions.find((r: StoryReaction) => r.uid === user.uid);
      
      let newReactions: StoryReaction[];
      if (existingReaction) {
        if (existingReaction.emoji === emoji) {
          // Remove reaction
          newReactions = serverReactions.filter((r: StoryReaction) => r.uid !== user.uid);
        } else {
          // Update reaction
          newReactions = serverReactions.map((r: StoryReaction) =>
            r.uid === user.uid ? { ...r, emoji } : r
          );
        }
      } else {
        // Add new reaction
        newReactions = [...serverReactions, { uid: user.uid, emoji, createdAt: serverTimestamp() as any }];
      }

      await updateDoc(storyRef, { reactions: newReactions });
    } catch (error) {
      console.error('Error updating reaction:', error);
      // Revert on error
      setLocalReactions(previousReactions);
      setUserReaction(previousReactions.find(r => r.uid === user.uid)?.emoji || null);
    } finally {
      setIsReacting(false);
      setShowReactions(false);
    }
  }, [user?.uid, currentStory?.id, isReacting]);

  const handleQuickHeart = useCallback(() => {
    if (userReaction) {
      // Unlike
      handleReaction(userReaction);
    } else {
      handleReaction('❤️');
    }
  }, [userReaction, handleReaction]);

  const handleReply = useCallback(async () => {
    if (!user || !currentStory || !replyText.trim()) return;

    const newReply: StoryReply = {
      id: `${Date.now()}_${user.uid}`,
      storyId: currentStory.id,
      authorUid: user.uid,
      authorName: user.displayName || 'Anonymous',
      authorPhoto: user.photoURL,
      content: replyText.trim(),
      createdAt: new Date() as any
    };

    // Optimistic update with functional state
    setReplies(prev => [...prev, newReply]);
    setReplyText('');

    try {
      const storyRef = doc(db, 'stories', currentStory.id);
      const storySnap = await getDoc(storyRef);
      if (!storySnap.exists()) return;
      
      const currentData = storySnap.data();
      const serverReplies = currentData.replies || [];
      
      await updateDoc(storyRef, {
        replies: [...serverReplies, { ...newReply, createdAt: serverTimestamp() as any }]
      });
    } catch (error) {
      console.error('Error sending reply:', error);
      // Revert on error
      setReplies(prev => prev.filter(r => r.id !== newReply.id));
    }
  }, [user?.uid, currentStory?.id, replyText]);

  const handleDeleteStory = useCallback(async () => {
    if (!currentStory || !isAuthor) return;
    if (!window.confirm('Are you sure you want to delete this story?')) return;

    try {
      await deleteDoc(doc(db, 'stories', currentStory.id));
      if (currentIndexRef.current < stories.length - 1) {
        // Stories will refresh via listener, just move to next
        setCurrentIndex(prev => prev + 1);
      } else {
        onClose();
      }
    } catch (error) {
      console.error('Error deleting story:', error);
    }
  }, [currentStory?.id, isAuthor, stories.length, onClose]);

  const handleDragStart = useCallback(() => {
    setIsDragging(true);
    setIsPaused(true);
  }, []);

  const handleDragEnd = useCallback((event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    setIsDragging(false);
    setIsPaused(false);
    if (info.offset.y > 150) {
      onClose();
    } else {
      y.set(0);
    }
  }, [onClose, y]);

  const removeFloatingEmoji = useCallback((id: string) => {
    setFloatingEmojis(prev => prev.filter(e => e.id !== id));
  }, []);

  const formatTimestamp = (timestamp: any): string => {
    if (!timestamp) return '';
    try {
      const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
      return formatDistanceToNow(date, { addSuffix: true });
    } catch {
      return '';
    }
  };

  if (!isOpen || !currentStory) return null;

  const reactionCount = localReactions.length;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <motion.div
        className="relative w-full max-w-lg h-full md:h-[90vh] md:rounded-3xl overflow-hidden bg-zinc-900"
        style={{ y, opacity }}
        drag="y"
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={0.2}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        {/* Progress Bars */}
        <div className="absolute top-3 left-4 right-4 z-50 flex space-x-1">
          {stories.map((_, idx) => (
            <div key={idx} className="h-[3px] flex-1 bg-white/20 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-white rounded-full"
                initial={false}
                animate={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                }}
                transition={idx === currentIndex ? { duration: 0.1, ease: 'linear' } : { duration: 0.3 }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-6 left-4 right-4 z-50 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <div className="relative">
              <img
                src={currentStory.authorPhoto || `https://ui-avatars.com/api/?name=${currentStory.authorName}&background=random`}
                alt={currentStory.authorName}
                className="w-10 h-10 rounded-full object-cover border-2 border-white/30"
              />
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm">{currentStory.authorName}</span>
              <span className="text-[11px] text-white/60">{formatTimestamp(currentStory.createdAt)}</span>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            {isAuthor && (
              <>
                <button
                  onClick={() => setShowAuthorMenu(!showAuthorMenu)}
                  className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors"
                >
                  <MoreHorizontal size={18} />
                </button>
                <AnimatePresence>
                  {showAuthorMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: 0.9, y: -5 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.9, y: -5 }}
                      className="absolute top-14 right-4 z-[70] bg-black/80 backdrop-blur-xl rounded-2xl p-2 min-w-[160px] border border-white/10"
                    >
                      {onEditStory && (
                        <button
                          onClick={() => { setShowAuthorMenu(false); onEditStory(currentStory); }}
                          className="w-full flex items-center space-x-3 px-4 py-3 text-white text-sm hover:bg-white/10 rounded-xl transition-colors"
                        >
                          <Edit3 size={16} />
                          <span>Edit Story</span>
                        </button>
                      )}
                      <button
                        onClick={() => { setShowAuthorMenu(false); handleDeleteStory(); }}
                        className="w-full flex items-center space-x-3 px-4 py-3 text-red-400 text-sm hover:bg-white/10 rounded-xl transition-colors"
                      >
                        <Trash2 size={16} />
                        <span>Delete Story</span>
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </>
            )}
            <button onClick={onClose} className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-colors">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Floating Emoji Animations */}
        {floatingEmojis.map(fe => (
          <FloatingEmoji key={fe.id} emoji={fe.emoji} onDone={() => removeFloatingEmoji(fe.id)} />
        ))}

        {/* Media */}
        <div className="w-full h-full flex items-center justify-center">
          {currentStory.mediaType === 'text' ? (
            <div
              className="w-full h-full flex items-center justify-center p-8 relative"
              style={{ backgroundColor: currentStory.backgroundColor || '#FF6B6B' }}
            >
              <p className="text-white text-2xl md:text-3xl font-bold text-center leading-relaxed z-10">
                {currentStory.textContent}
              </p>
              {currentStory.stickers && currentStory.stickers.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {currentStory.stickers.map((sticker, idx) => (
                    <span
                      key={idx}
                      className="absolute text-6xl"
                      style={{
                        top: `${20 + (idx * 15)}%`,
                        left: `${20 + (idx * 20)}%`,
                        transform: `rotate(${idx * 15}deg)`
                      }}
                    >
                      {sticker}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : currentStory.mediaType === 'video' ? (
            <video
              key={currentStory.id}
              src={currentStory.mediaUrl}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
              onEnded={handleNext}
            />
          ) : (
            <img
              key={currentStory.id}
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}

          {/* Caption overlay */}
          {currentStory.caption && currentStory.mediaType !== 'text' && (
            <div className="absolute bottom-24 left-4 right-16 z-40">
              <p className="text-white text-sm font-medium bg-black/30 backdrop-blur-sm rounded-xl px-3 py-2 inline-block">
                {currentStory.caption}
              </p>
            </div>
          )}

          {/* Music indicator */}
          {currentStory.musicTitle && (
            <div className="absolute bottom-24 left-4 z-40 flex items-center space-x-2 bg-black/40 backdrop-blur-md px-3 py-1.5 rounded-full border border-white/10">
              <Music size={12} className="text-white/70" />
              <span className="text-[11px] text-white/70 truncate max-w-[120px]">{currentStory.musicTitle}</span>
            </div>
          )}
        </div>

        {/* Navigation Overlays - tap left/right */}
        <div className="absolute inset-0 flex z-10">
          <div
            className="w-1/3 h-full cursor-pointer"
            onClick={handlePrev}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          />
          <div
            className="w-2/3 h-full cursor-pointer"
            onClick={handleNext}
            onMouseDown={() => setIsPaused(true)}
            onMouseUp={() => setIsPaused(false)}
            onTouchStart={() => setIsPaused(true)}
            onTouchEnd={() => setIsPaused(false)}
          />
        </div>

        {/* Navigation Buttons (Desktop) */}
        <button
          onClick={handlePrev}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hidden md:block z-20 ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hidden md:block z-20"
        >
          <ChevronRight size={24} />
        </button>

        {/* Reaction and Reply Buttons */}
        <div className="absolute bottom-8 right-4 z-50 flex flex-col space-y-3">
          <motion.button
            onClick={handleQuickHeart}
            whileTap={{ scale: 1.3 }}
            className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-4 py-3 rounded-full border border-white/20 text-white hover:bg-black/60 transition-all"
          >
            <motion.div
              animate={userReaction ? { scale: [1, 1.3, 1] } : {}}
              transition={{ duration: 0.3 }}
            >
              <Heart size={20} className={userReaction === '❤️' ? 'fill-red-500 text-red-500' : ''} />
            </motion.div>
            <span className="text-xs font-bold">{reactionCount}</span>
          </motion.button>
          <button
            onClick={() => setShowReactions(!showReactions)}
            className="flex items-center space-x-1 bg-black/40 backdrop-blur-md px-3 py-2 rounded-full border border-white/20 text-white hover:bg-black/60 transition-all text-lg"
          >
            {userReaction || '😀'}
          </button>
          <button
            onClick={() => setShowReplyInput(!showReplyInput)}
            className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-4 py-3 rounded-full border border-white/20 text-white hover:bg-black/60 transition-all"
          >
            <MessageCircle size={20} />
            <span className="text-xs font-bold">{replies.length}</span>
          </button>
        </div>

        {/* Viewer Count (author only) */}
        {isAuthor && (
          <div className="absolute bottom-8 left-4 z-50">
            <button
              onClick={() => setShowViewers(!showViewers)}
              className="flex items-center space-x-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/20 text-white hover:bg-black/60 transition-colors"
            >
              <Eye size={16} />
              <span className="text-xs font-bold">{currentStory.viewers?.length || 0}</span>
            </button>
          </div>
        )}

        {/* Reactions Picker */}
        <AnimatePresence>
          {showReactions && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.8, y: 10 }}
              className="absolute bottom-28 right-4 z-[60] bg-black/70 backdrop-blur-xl rounded-2xl p-2 flex space-x-1 border border-white/10"
            >
              {EMOJI_REACTIONS.map((emoji) => (
                <motion.button
                  key={emoji}
                  onClick={() => handleReaction(emoji)}
                  whileHover={{ scale: 1.3 }}
                  whileTap={{ scale: 0.9 }}
                  className={`w-10 h-10 flex items-center justify-center text-2xl rounded-xl transition-colors ${
                    userReaction === emoji ? 'bg-white/20' : 'hover:bg-white/10'
                  }`}
                >
                  {emoji}
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Reply Input */}
        <AnimatePresence>
          {showReplyInput && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="absolute bottom-28 left-4 right-4 z-[60] bg-black/60 backdrop-blur-md rounded-2xl p-4"
            >
              <div className="flex space-x-3">
                <input
                  type="text"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Reply to story..."
                  className="flex-1 bg-white/10 border border-white/20 rounded-full px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/50"
                  onKeyDown={(e) => e.key === 'Enter' && handleReply()}
                  autoFocus
                />
                <button
                  onClick={handleReply}
                  disabled={!replyText.trim()}
                  className="p-2 bg-accent rounded-full text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
                >
                  <Send size={18} />
                </button>
              </div>
              {replies.length > 0 && (
                <div className="mt-3 space-y-2 max-h-32 overflow-y-auto">
                  {replies.slice(-3).map((reply) => (
                    <div key={reply.id} className="flex items-start space-x-2">
                      <img
                        src={reply.authorPhoto || `https://ui-avatars.com/api/?name=${reply.authorName}&background=random`}
                        alt={reply.authorName}
                        className="w-6 h-6 rounded-full object-cover"
                      />
                      <div className="bg-white/10 rounded-xl px-3 py-1">
                        <span className="text-xs font-bold text-white">{reply.authorName}</span>
                        <p className="text-xs text-white/80">{reply.content}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Viewers List Drawer */}
        <AnimatePresence>
          {showViewers && (
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="absolute inset-x-0 bottom-0 z-[60] bg-background rounded-t-3xl p-6 max-h-[60%] overflow-y-auto custom-scrollbar"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-primary">Viewers</h3>
                <button onClick={() => setShowViewers(false)} className="p-2 hover:bg-surface rounded-full transition-colors">
                  <X size={24} className="text-primary" />
                </button>
              </div>
              <div className="space-y-4">
                {viewerProfiles.map(profile => (
                  <div key={profile.uid} className="flex items-center space-x-3">
                    <img
                      src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}&background=random`}
                      alt={profile.displayName}
                      className="w-10 h-10 rounded-full object-cover"
                    />
                    <span className="font-semibold text-sm">{profile.displayName}</span>
                  </div>
                ))}
                {viewerProfiles.length === 0 && (
                  <p className="text-center text-secondary text-sm py-8">No viewers yet</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};
