import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, doc, updateDoc, increment, setDoc, deleteDoc, getDoc, where, limit, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useFirestoreListener } from '../lib/firestoreListenerManager';
import { Reel, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Music, User as UserIcon, Plus, X, Send, Loader2, Video, ChevronDown, Filter, Link, ExternalLink, Check, MoreVertical, Volume2, VolumeX } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { uploadVideoToCloudinary } from '../lib/cloudinary';
import { CommentsModal } from '../components/CommentsModal';
import { UserStatusDot } from '../components/UserStatusDot';
import { NotificationCenter } from '../components/NotificationCenter';
import { followUser, unfollowUser } from '../lib/follow';

const REEL_CATEGORIES = [
  'Entertainment',
  'Gaming',
  'Music',
  'Education',
  'Lifestyle',
  'Tech',
  'Comedy',
  'Sports',
  'Other'
];

const ReelCard = ({ reel, isActive }: { reel: Reel, isActive: boolean }) => {
  const { user: currentUser } = useAuth();
  const { sendNotification } = useNotifications();
  const { addListener, removeListener } = useFirestoreListener();
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(reel.likesCount);
  const [showHeartAnim, setShowHeartAnim] = useState(false);
  const [showComments, setShowComments] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [author, setAuthor] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastTap = useRef<number>(0);
  const navigate = useNavigate();
  const authorListenerId = `ReelCard-author-${reel.id}`;
  const followingListenerId = `ReelCard-following-${reel.id}-${currentUser?.uid || 'guest'}`;

  useEffect(() => {
    setLikesCount(reel.likesCount);
  }, [reel.likesCount]);

  useEffect(() => {
    // Fetch author for status
    addListener({
      id: authorListenerId,
      query: doc(db, 'users', reel.authorUid),
      context: authorListenerId,
      onNext: (docSnap) => {
        if (docSnap.exists()) {
          setAuthor({ uid: docSnap.id, ...docSnap.data() } as User);
        }
      }
    });

    // Check if following
    if (currentUser && currentUser.uid !== reel.authorUid) {
      addListener({
        id: followingListenerId,
        query: doc(db, 'users', currentUser.uid, 'following', reel.authorUid),
        context: followingListenerId,
        onNext: (snap) => {
          setIsFollowing(snap.exists());
        }
      });
    }

    return () => {
      removeListener(authorListenerId);
      removeListener(followingListenerId);
    };
  }, [reel.id, reel.authorUid, currentUser?.uid, addListener, removeListener, authorListenerId, followingListenerId]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !author || followLoading) return;
    setFollowLoading(true);
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);

    try {
      if (!nextFollowing) {
        await unfollowUser(currentUser.uid, author.uid);
      } else {
        await followUser(currentUser.uid, author.uid);

        await sendNotification(
          author.uid,
          author.isPrivate ? 'follow_request' : 'follow',
          author.isPrivate ? 'New Follow Request' : 'New Follower',
          author.isPrivate ? `${currentUser.displayName} wants to follow you` : `${currentUser.displayName} started following you`,
          { fromUid: currentUser.uid }
        );
      }
    } catch (error) {
      setIsFollowing(!nextFollowing);
      console.error('Error toggling follow:', error);
    } finally {
      setFollowLoading(false);
    }
  };

  useEffect(() => {
    if (isActive && videoRef.current) {
      videoRef.current.play().catch(() => {});
    } else if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  }, [isActive]);

  useEffect(() => {
    if (currentUser) {
      const likeRef = doc(db, 'reels', reel.id, 'likes', currentUser.uid);
      getDoc(likeRef).then(snap => setIsLiked(snap.exists()));
    }
  }, [currentUser, reel.id]);

  const toggleLike = async () => {
    if (!currentUser) return;

    const reelRef = doc(db, 'reels', reel.id);
    const likeRef = doc(db, 'reels', reel.id, 'likes', currentUser.uid);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(reelRef, { likesCount: increment(-1) });
        setLikesCount(prev => prev - 1);
        setIsLiked(false);
      } else {
        await setDoc(likeRef, { uid: currentUser.uid, createdAt: new Date() });
        await updateDoc(reelRef, { likesCount: increment(1) });
        setLikesCount(prev => prev + 1);
        setIsLiked(true);

        // Send notification to author
        if (reel.authorUid !== currentUser.uid) {
          await sendNotification(
            reel.authorUid,
            'like',
            'New Like!',
            `${currentUser.displayName} liked your Reel`,
            { reelId: reel.id }
          );
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `reels/${reel.id}`);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await toggleLike();
  };

  const handleVideoClick = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      // Double tap
      if (!isLiked) {
        toggleLike();
      }
      setShowHeartAnim(true);
      setTimeout(() => setShowHeartAnim(false), 1000);
    } else {
      // Single tap
      if (videoRef.current?.paused) {
        videoRef.current.play();
      } else {
        videoRef.current?.pause();
      }
    }
    lastTap.current = now;
  };

return (
    <div className="relative h-full w-full bg-black flex items-center justify-center snap-start overflow-hidden group">
      <video
        ref={videoRef}
        src={reel.videoUrl}
        className="h-full w-full object-cover"
        loop
        playsInline
        onClick={handleVideoClick}
        poster={reel.videoUrl ? undefined : undefined}
      />

      {/* Modern gradient overlay with smooth vignette */}
      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-black/60 pointer-events-none" />
      
      {/* Top fade overlay */}
      <div className="absolute top-0 left-0 right-0 h-24 bg-gradient-to-b from-black/50 to-transparent pointer-events-none" />

      {/* Mute Toggle Indicator */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <AnimatePresence>
          {isMuted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="px-5 py-3 bg-black/50 backdrop-blur-xl rounded-2xl border border-white/10 shadow-2xl"
            >
              <div className="flex items-center gap-3">
                <VolumeX size={24} className="text-white" />
                <span className="text-white font-semibold text-sm">Muted</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Double Tap Heart Animation */}
      <AnimatePresence>
        {showHeartAnim && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <motion.div
              animate={{ 
                scale: [1, 1.1, 1],
                rotate: [0, -5, 5, 0]
              }}
              transition={{ duration: 0.6, repeat: 0 }}
            >
              <Heart size={140} fill="white" className="text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]" />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Info - Clean minimal design */}
      <div className="absolute left-4 right-4 top-32 z-20 flex items-center justify-between">
        <button 
          onClick={() => navigate(`/profile/${reel.authorUid}`)}
          className="group/author pointer-events-auto flex items-center gap-3"
        >
          <div className="relative">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-r from-pink-500 via-purple-500 to-blue-500 opacity-80 group-hover/author:opacity-100 transition-opacity" />
            <img 
              src={reel.authorPhoto || `https://ui-avatars.com/api/?name=${reel.authorName}&background=random`} 
              alt={reel.authorName} 
              className="relative h-10 w-10 rounded-full border-2 border-black/30 object-cover"
            />
            {author && (
              <UserStatusDot 
                user={author} 
                className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 border-2 border-black" 
                size="sm"
              />
            )}
          </div>
          <div className="flex flex-col items-start">
            <div className="flex items-center gap-2">
              <span className="text-white font-semibold text-sm">{reel.authorName}</span>
              {currentUser && currentUser.uid !== reel.authorUid && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition-all ${
                    isFollowing 
                      ? 'bg-white/10 text-white/70' 
                      : 'bg-white text-black'
                  }`}
                >
                  {followLoading ? <Loader2 size={10} className="animate-spin" /> : isFollowing ? 'Following' : 'Follow'}
                </motion.button>
              )}
            </div>
            <span className="text-white/40 text-[11px]">Original Sound</span>
          </div>
        </button>
      </div>

      {/* Right Side Actions - Compact & Minimal */}
      <div className="pointer-events-auto absolute right-2 bottom-24 z-20 flex flex-col items-center gap-4">
        {/* Like Button */}
        <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-1">
          <button
            onClick={handleLike}
            className={`h-11 w-11 rounded-full flex items-center justify-center transition-all ${
              isLiked 
                ? 'text-pink-500' 
                : 'text-white hover:bg-white/10'
            }`}
          >
            <Heart size={26} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={2} />
          </button>
          <span className="text-white text-[11px] font-medium tabular-nums drop-shadow-md">
            {likesCount >= 1000 ? `${(likesCount/1000).toFixed(1)}K` : likesCount}
          </span>
        </motion.div>

        {/* Comment Button */}
        <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowComments(true)}
            className="h-11 w-11 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all"
          >
            <MessageCircle size={26} strokeWidth={2} />
          </button>
          <span className="text-white text-[11px] font-medium tabular-nums drop-shadow-md">
            {reel.commentsCount >= 1000 ? `${(reel.commentsCount/1000).toFixed(1)}K` : reel.commentsCount}
          </span>
        </motion.div>

        {/* Share Button */}
        <motion.div whileTap={{ scale: 0.85 }} className="flex flex-col items-center gap-1">
          <button
            onClick={() => setShowShare(true)}
            className="h-11 w-11 rounded-full flex items-center justify-center text-white hover:bg-white/10 transition-all"
          >
            <Share2 size={26} strokeWidth={2} />
          </button>
          <span className="text-white text-[11px] font-medium tabular-nums drop-shadow-md">
            {reel.sharesCount >= 1000 ? `${((reel.sharesCount || 0)/1000).toFixed(1)}K` : (reel.sharesCount || 0)}
          </span>
        </motion.div>

        {/* Small Music Disc */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
          className="w-10 h-10 rounded-full overflow-hidden mt-1"
        >
          {reel.authorPhoto ? (
            <img src={reel.authorPhoto} className="w-full h-full object-cover" alt="" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center">
              <Music size={16} className="text-white/80" />
            </div>
          )}
        </motion.div>
      </div>

      {/* Bottom Gradient Overlay for Readability */}
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none" />

      {/* Bottom Info - Caption + Audio */}
      <div className="pointer-events-none absolute left-0 right-14 bottom-20 z-20">
        <div className="px-4 space-y-2.5">
          {/* Username + Caption Group */}
          <div className="pointer-events-auto">
            <div className="flex items-center gap-2 mb-1.5">
              <span className="text-white font-bold text-[15px]">{reel.authorName}</span>
              {reel.category && (
                <span className="px-2 py-0.5 bg-white/15 backdrop-blur-sm rounded text-[10px] font-semibold text-white/90">
                  {reel.category}
                </span>
              )}
            </div>
            {reel.caption && (
              <p className="text-white/90 text-[14px] font-normal leading-snug line-clamp-2">
                {reel.caption}
              </p>
            )}
          </div>
          
          {/* Audio Info */}
          <div className="flex items-center gap-2 text-white/70 pointer-events-auto">
            <div className="flex items-center gap-1.5">
              <Music size={13} className="animate-pulse" />
              <span className="text-[12px] font-medium truncate max-w-[200px]">
                {reel.authorName} · Original Sound
              </span>
            </div>
          </div>
        </div>
      </div>

      <CommentsModal
        itemId={reel.id} 
        itemType="reels"
        authorUid={reel.authorUid}
        isOpen={showComments} 
        onClose={() => setShowComments(false)} 
      />

      <ShareModal
        reel={reel}
        isOpen={showShare}
        onClose={() => setShowShare(false)}
      />
    </div>
  );
};

const ShareModal = ({ reel, isOpen, onClose }: { reel: Reel, isOpen: boolean, onClose: () => void }) => {
  const { user: currentUser } = useAuth();
  const { addListener, removeListener } = useFirestoreListener();
  const [chats, setChats] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);
  const [sharing, setSharing] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen || !currentUser) return;

    const q = query(
      collection(db, 'chats'),
      where('participants', 'array-contains', currentUser.uid),
      orderBy('lastMessageAt', 'desc'),
      limit(10)
    );

    addListener({
      id: 'Reels-shareChats',
      query: q,
      context: 'Reels-shareChats',
      onNext: (snapshot) => {
        const chatsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setChats(chatsData);
        setLoading(false);
      }
    });

    return () => removeListener('Reels-shareChats');
  }, [isOpen, currentUser, addListener, removeListener]);

  const handleExternalShare = async () => {
    const shareData = {
      title: `Check out ${reel.authorName}'s Reel`,
      text: reel.caption || 'Watch this cool video on Nexus Social!',
      url: window.location.origin + `/reels?id=${reel.id}`
    };

    if (navigator.share) {
      try {
        await navigator.share(shareData);
        await updateDoc(doc(db, 'reels', reel.id), { sharesCount: increment(1) });
      } catch (err) {
        // Error sharing - user may have cancelled
      }
    } else {
      handleCopyLink();
    }
  };

  const handleCopyLink = () => {
    const url = window.location.origin + `/reels?id=${reel.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInternalShare = async (chatId: string) => {
    if (!currentUser) return;
    setSharing(chatId);

    try {
      const messageRef = doc(collection(db, 'chats', chatId, 'messages'));
      await setDoc(messageRef, {
        id: messageRef.id,
        chatId,
        senderUid: currentUser.uid,
        content: `Shared a Reel: ${reel.caption || ''}`,
        mediaUrl: reel.videoUrl,
        mediaType: 'reel',
        reelId: reel.id,
        createdAt: new Date()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: 'Shared a Reel',
        lastMessageAt: new Date()
      });

      await updateDoc(doc(db, 'reels', reel.id), {
        sharesCount: increment(1)
      });

      onClose();
    } catch (error) {
      // Error sharing internally
    } finally {
      setSharing(null);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[200] flex items-end justify-center sm:items-center p-0 sm:p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            className="relative flex h-[60vh] w-full max-w-[420px] flex-col overflow-hidden rounded-t-3xl bg-background shadow-2xl sm:h-[500px] sm:rounded-3xl"
          >
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold">Share Reel</h3>
              <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
              {/* Quick Actions */}
              <div className="grid grid-cols-2 gap-4">
                <button 
                  onClick={handleExternalShare}
                  className="flex flex-col items-center justify-center p-4 bg-surface rounded-2xl border border-border hover:border-accent transition-all group"
                >
                  <div className="p-3 bg-accent/10 rounded-full text-accent mb-2 group-hover:scale-110 transition-transform">
                    <ExternalLink size={24} />
                  </div>
                  <span className="text-xs font-bold">Share Externally</span>
                </button>
                <button 
                  onClick={handleCopyLink}
                  className="flex flex-col items-center justify-center p-4 bg-surface rounded-2xl border border-border hover:border-accent transition-all group"
                >
                  <div className="p-3 bg-accent/10 rounded-full text-accent mb-2 group-hover:scale-110 transition-transform">
                    {copied ? <Check size={24} /> : <Link size={24} />}
                  </div>
                  <span className="text-xs font-bold">{copied ? 'Copied!' : 'Copy Link'}</span>
                </button>
              </div>

              {/* Internal Share */}
              <div className="space-y-4">
                <h4 className="text-xs font-bold text-secondary uppercase tracking-widest">Send to Friends</h4>
                {loading ? (
                  <div className="flex justify-center py-8">
                    <Loader2 className="animate-spin text-accent" />
                  </div>
                ) : chats.length > 0 ? (
                  <div className="space-y-2">
                    {chats.map((chat) => (
                      <div key={chat.id} className="flex items-center justify-between p-3 bg-surface rounded-2xl border border-border">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-accent/10 rounded-full flex items-center justify-center">
                            <UserIcon size={20} className="text-accent" />
                          </div>
                          <div>
                            <p className="text-sm font-bold truncate max-w-[150px]">
                              {chat.type === 'direct' ? 'Direct Message' : chat.name || 'Group Chat'}
                            </p>
                            <p className="text-[10px] text-secondary">Recent activity</p>
                          </div>
                        </div>
                        <button
                          onClick={() => handleInternalShare(chat.id)}
                          disabled={sharing === chat.id}
                          className="px-4 py-1.5 bg-accent text-white rounded-full text-xs font-bold hover:bg-accent/90 transition-all disabled:opacity-50"
                        >
                          {sharing === chat.id ? <Loader2 size={14} className="animate-spin" /> : 'Send'}
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-8 text-secondary">
                    <p className="text-sm">No recent chats found.</p>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};



const UploadReelModal = ({ isOpen, onClose }: { isOpen: boolean, onClose: () => void }) => {
  const { user: currentUser } = useAuth();
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [caption, setCaption] = useState('');
  const [category, setCategory] = useState(REEL_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [success, setSuccess] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile && selectedFile.type.startsWith('video/')) {
      setFile(selectedFile);
      setPreviewUrl(URL.createObjectURL(selectedFile));
      setErrorMessage('');
    }
  };

  const handleUpload = async () => {
    if (!currentUser) {
      setErrorMessage('You must be logged in to post a reel.');
      return;
    }

    if (!file) {
      setErrorMessage('Please select a video to upload.');
      return;
    }

    if (!caption.trim()) {
      setErrorMessage('Please add a caption to your reel.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrorMessage('');
    setSuccess(false);

    try {
      const reelId = doc(collection(db, 'reels')).id;

      console.log('Starting upload to Cloudinary...');
      const videoUrl = await uploadVideoToCloudinary(file, `reels/${currentUser.uid}`);
      console.log('Upload complete:', videoUrl);

      const reelData: Reel = {
        id: reelId,
        authorUid: currentUser.uid,
        authorName: currentUser.displayName || 'Anonymous',
        authorPhoto: currentUser.photoURL || '',
        videoUrl,
        caption: caption.trim(),
        category: showCustomInput ? customCategory.trim() : category,
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        createdAt: serverTimestamp() as any
      };

      console.log('Saving reel to Firestore:', reelData);
      await setDoc(doc(db, 'reels', reelId), reelData);
      console.log('Reel saved successfully');

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate('/reels');
        setFile(null);
        setPreviewUrl(null);
        setCaption('');
        setCategory(REEL_CATEGORIES[0]);
        setCustomCategory('');
        setShowCustomInput(false);
        setUploadProgress(0);
        setSuccess(false);
      }, 1500);
    } catch (error: any) {
      console.error('Error uploading reel:', error);
      let errorMsg = 'Failed to post reel. Please try again.';
      if (error?.code === 'storage/unauthorized') {
        errorMsg = 'You do not have permission to upload files.';
      } else if (error?.code === 'permission-denied') {
        errorMsg = 'Permission denied. You do not have permission to create reels.';
      } else if (error?.code === 'unauthenticated') {
        errorMsg = 'You must be logged in to create reels.';
      } else if (error?.code === 'network-request-failed') {
        errorMsg = 'Network error. Please check your connection.';
      } else if (error?.message) {
        errorMsg = error.message;
      }
      setErrorMessage(errorMsg);
      handleFirestoreError(error, OperationType.CREATE, 'reels');
    } finally {
      setUploading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-background w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-border flex flex-col max-h-[90vh]"
      >
        <div className="p-4 border-b border-border flex items-center justify-between flex-shrink-0">
          <h2 className="text-xl font-bold">Create Reel</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {!previewUrl ? (
            <label className="flex flex-col items-center justify-center h-64 border-2 border-dashed border-border rounded-2xl cursor-pointer hover:bg-surface transition-all group">
              <div className="p-4 bg-accent/10 rounded-full text-accent group-hover:scale-110 transition-transform">
                <Plus size={32} />
              </div>
              <span className="mt-4 font-bold">Select Video</span>
              <span className="text-xs text-secondary mt-1">Short-form vertical videos work best</span>
              <input type="file" accept="video/*" className="hidden" onChange={handleFileChange} />
            </label>
          ) : (
            <div className="relative aspect-[9/16] max-h-96 mx-auto bg-black rounded-xl overflow-hidden">
              <video src={previewUrl} className="w-full h-full object-contain" controls />
              <button
                onClick={() => { setFile(null); setPreviewUrl(null); }}
                className="absolute top-2 right-2 p-1.5 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all"
              >
                <X size={16} />
              </button>
            </div>
          )}

          <textarea
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            placeholder="Write a caption..."
            className="w-full bg-surface border border-border rounded-xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none h-24"
          />

          <div className="space-y-2">
            <label className="text-[10px] font-bold text-secondary uppercase tracking-widest block">Category</label>
            <div className="flex flex-wrap gap-2">
              {REEL_CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  onClick={() => {
                    setCategory(cat);
                    setShowCustomInput(false);
                  }}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    !showCustomInput && category === cat
                      ? 'bg-accent text-white shadow-lg shadow-accent/30'
                      : 'bg-surface border border-border text-secondary hover:border-accent'
                  }`}
                >
                  {cat}
                </button>
              ))}
              <button
                onClick={() => setShowCustomInput(true)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  showCustomInput
                    ? 'bg-accent text-white shadow-lg shadow-accent/30'
                    : 'bg-surface border border-border text-secondary hover:border-accent'
                }`}
              >
                + Custom
              </button>
            </div>
            {showCustomInput && (
              <motion.input
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                type="text"
                value={customCategory}
                onChange={(e) => setCustomCategory(e.target.value)}
                placeholder="Enter custom category..."
                className="w-full mt-2 bg-surface border border-border rounded-xl px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
              />
            )}
          </div>

          {errorMessage && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-4 bg-red-500/20 border border-red-500/50 rounded-2xl"
            >
              <p className="text-red-400 text-sm text-center">{errorMessage}</p>
            </motion.div>
          )}

          {success && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 bg-green-500/20 border border-green-500/50 rounded-2xl text-center"
            >
              <p className="text-green-400 font-bold">🎉 Reel posted successfully!</p>
            </motion.div>
          )}

          {uploading && uploadProgress > 0 && (
            <div className="space-y-2">
              <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${uploadProgress}%` }}
                  className="h-full bg-gradient-to-r from-accent to-purple-600"
                />
              </div>
              <p className="text-xs text-secondary text-center">Uploading... {Math.round(uploadProgress)}%</p>
            </div>
          )}
        </div>

        <div className="p-6 border-t border-border flex-shrink-0 bg-background">
          <button
            onClick={handleUpload}
            disabled={!file || uploading || success}
            className="w-full py-4 bg-gradient-to-r from-accent to-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98] flex items-center justify-center space-x-2"
          >
            {uploading ? (
              <>
                <Loader2 size={20} className="animate-spin" />
                <span>Posting...</span>
              </>
            ) : success ? (
              <>
                <Check size={20} />
                <span>Posted!</span>
              </>
            ) : (
              <>
                <Send size={20} />
                <span>Post Reel</span>
              </>
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default function Reels() {
  const [reels, setReels] = useState<Reel[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showFilterDropdown, setShowFilterDropdown] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchParams] = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const { addListener, removeListener } = useFirestoreListener();

  useEffect(() => {
    let q = query(collection(db, 'reels'), orderBy('createdAt', 'desc'));
    
    addListener({
      id: 'Reels-main',
      query: q,
      context: 'Reels-main',
      onNext: (snapshot) => {
        const reelsData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Reel[];
      
      // Client side filtering for better UX and to avoid index requirements for now
      const filteredReels = selectedCategory 
        ? reelsData.filter(r => r.category === selectedCategory)
        : reelsData;

      setReels(filteredReels);
      setLoading(false);

      // Handle direct link to reel
      const targetId = searchParams.get('id');
      if (targetId && filteredReels.length > 0) {
        const index = filteredReels.findIndex(r => r.id === targetId);
        if (index !== -1) {
          setTimeout(() => {
            if (containerRef.current) {
              containerRef.current.scrollTop = index * containerRef.current.clientHeight;
              setActiveIndex(index);
            }
          }, 500);
        }
      }
    },
    onError: (error) => {
      handleFirestoreError(error, OperationType.LIST, 'reels');
      setLoading(false);
    }
    });

    return () => removeListener('Reels-main');
  }, [selectedCategory, searchParams, addListener, removeListener]);

  const handleScroll = () => {
    if (containerRef.current) {
      const index = Math.round(containerRef.current.scrollTop / containerRef.current.clientHeight);
      setActiveIndex(index);
    }
  };

  if (loading) {
    return (
      <div className="h-screen w-full flex flex-col items-center justify-center bg-black">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
          className="w-12 h-12 rounded-full border-2 border-white/20 border-t-purple-500"
        />
        <p className="text-white/50 text-sm mt-4 font-medium">Loading reels...</p>
      </div>
    );
  }

return (
    <div className="mx-auto h-screen w-full max-w-[400px] overflow-hidden bg-black relative shadow-2xl ring-1 ring-white/10">
      {/* Modern Header - floating with blur */}
      <div className="absolute left-0 right-0 top-0 z-50 px-4 pt-[max(12px,env(safe-area-inset-top))] pb-3 bg-gradient-to-b from-black/80 to-transparent">
        <div className="flex items-center justify-between">
          {/* Logo/Title */}
          <div className="flex items-center gap-2">
            <h1 className="text-[22px] font-bold tracking-tight text-white">Reels</h1>
          </div>
          
          {/* Actions */}
          <div className="flex items-center gap-1">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setShowUploadModal(true)}
              className="h-9 w-9 rounded-full bg-white/10 backdrop-blur-md border border-white/10 flex items-center justify-center text-white hover:bg-white/20 transition-all"
            >
              <Plus size={20} />
            </motion.button>
            
            <div className="relative">
              <motion.button
                whileTap={{ scale: 0.92 }}
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`h-9 w-9 rounded-full backdrop-blur-md border flex items-center justify-center transition-all ${
                  selectedCategory 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500 border-transparent text-white' 
                    : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
                }`}
              >
                <Filter size={18} />
              </motion.button>
              
              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.15 }}
                    className="absolute right-0 mt-2 w-44 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden z-[60]"
                  >
                    <div className="p-2 max-h-64 overflow-y-auto no-scrollbar">
                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                          selectedCategory === null 
                            ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                            : 'text-white/70 hover:bg-white/10 hover:text-white'
                        }`}
                      >
                        All Reels
                      </button>
                      {REEL_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                            selectedCategory === cat 
                              ? 'bg-gradient-to-r from-purple-500 to-pink-500 text-white' 
                              : 'text-white/70 hover:bg-white/10 hover:text-white'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>

        {/* Category Pills - horizontal scroll */}
        <div className="flex items-center gap-2 overflow-x-auto no-scrollbar pt-2 -mx-4 px-4">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setSelectedCategory(null)}
            className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              selectedCategory === null 
                ? 'bg-white text-black' 
                : 'bg-white/10 text-white/80 hover:bg-white/20'
            }`}
          >
            For You
          </motion.button>
          {REEL_CATEGORIES.slice(0, 5).map(cat => (
            <motion.button
              whileTap={{ scale: 0.95 }}
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`whitespace-nowrap px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                selectedCategory === cat 
                  ? 'bg-white text-black' 
                  : 'bg-white/10 text-white/80 hover:bg-white/20'
              }`}
            >
              {cat}
            </motion.button>
))}
        </div>
      </div>

      {/* Reels Container */}
      <div 
        ref={containerRef}
        onScroll={handleScroll}
        className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar relative"
        style={{ scrollBehavior: 'smooth' }}
      >
        {reels.length > 0 ? (
          <div style={{ height: `${reels.length * 100}vh`, position: 'relative' }}>
            {/* Invisible snap points to maintain scroll behavior and snapping */}
            {reels.map((reel, index) => (
              <div 
                key={`snap-${reel.id}`} 
                className="snap-start absolute w-full h-screen pointer-events-none" 
                style={{ top: `${index * 100}vh` }} 
              />
            ))}

            {/* Render only visible reels with a small buffer */}
            {(() => {
              const BUFFER = 2;
              const startIndex = Math.max(0, activeIndex - BUFFER);
              const endIndex = Math.min(reels.length - 1, activeIndex + BUFFER);
              
              return reels.slice(startIndex, endIndex + 1).map((reel, i) => {
                const actualIndex = startIndex + i;
                return (
                  <div 
                    key={reel.id}
                    className="absolute w-full h-screen"
                    style={{ top: `${actualIndex * 100}vh` }}
                  >
                    <ReelCard reel={reel} isActive={actualIndex === activeIndex} />
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-white p-8 text-center">
            <motion.div 
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="w-28 h-28 bg-gradient-to-br from-purple-500/20 to-pink-500/20 rounded-full flex items-center justify-center mb-6 border border-white/10"
            >
              <Video size={52} className="text-white/50" />
            </motion.div>
            <motion.h2 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.1 }}
              className="text-2xl font-bold mb-3"
            >
              No Reels Yet
            </motion.h2>
            <motion.p 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-white/50 max-w-[240px] mx-auto mb-8 text-sm leading-relaxed"
            >
              Be the first to share a short video with the community!
            </motion.p>
            <motion.button 
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.3 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowUploadModal(true)}
              className="px-8 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-full font-semibold hover:shadow-lg hover:shadow-purple-500/30 transition-all"
            >
              Create First Reel
            </motion.button>
          </div>
        )}
      </div>

      <UploadReelModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </div>
  );
}
