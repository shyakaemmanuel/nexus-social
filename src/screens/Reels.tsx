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

  useEffect(() => {
    setLikesCount(reel.likesCount);
  }, [reel.likesCount]);

  useEffect(() => {
    // Fetch author for status
    addListener({
      id: 'ReelCard-author',
      query: doc(db, 'users', reel.authorUid),
      context: 'ReelCard-author',
      onNext: (docSnap) => {
        if (docSnap.exists()) {
          setAuthor(docSnap.data() as User);
        }
      }
    });

    // Check if following
    if (currentUser && currentUser.uid !== reel.authorUid) {
      addListener({
        id: 'ReelCard-following',
        query: doc(db, 'users', currentUser.uid, 'following', reel.authorUid),
        context: 'ReelCard-following',
        onNext: (snap) => {
          setIsFollowing(snap.exists());
        }
      });
    }

    return () => {
      removeListener('ReelCard-author');
      removeListener('ReelCard-following');
    };
  }, [reel.authorUid, currentUser, addListener, removeListener]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.muted = isMuted;
    }
  }, [isMuted]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!currentUser || !author || followLoading) return;
    setFollowLoading(true);

    const followingRef = doc(db, 'users', currentUser.uid, 'following', author.uid);
    const followerRef = doc(db, 'users', author.uid, 'followers', currentUser.uid);

    try {
      if (isFollowing) {
        await deleteDoc(followingRef);
        await deleteDoc(followerRef);
        await updateDoc(doc(db, 'users', currentUser.uid), { followingCount: increment(-1) });
        await updateDoc(doc(db, 'users', author.uid), { followersCount: increment(-1) });
      } else {
        await setDoc(followingRef, { uid: author.uid, createdAt: serverTimestamp() });
        await setDoc(followerRef, { uid: currentUser.uid, createdAt: serverTimestamp() });
        await updateDoc(doc(db, 'users', currentUser.uid), { followingCount: increment(1) });
        await updateDoc(doc(db, 'users', author.uid), { followersCount: increment(1) });

        await sendNotification(
          author.uid,
          'follow',
          'New Follower',
          `${currentUser.displayName} started following you`,
          { fromUid: currentUser.uid }
        );
      }
    } catch (error) {
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
      />

      {/* Immersive Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-black/90 pointer-events-none" />

      {/* Mute Toggle Overlay */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
        <AnimatePresence>
          {isMuted && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.5 }}
              className="p-4 bg-black/40 backdrop-blur-md rounded-full"
            >
              <VolumeX size={32} className="text-white" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Double Tap Heart Animation */}
      <AnimatePresence>
        {showHeartAnim && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1.5, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
          >
            <Heart size={120} fill="white" className="text-white drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Info */}
      <div className="absolute top-8 left-6 right-6 flex items-center justify-between z-20">
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => navigate(`/profile/${reel.authorUid}`)}
            className="flex items-center space-x-3 group/author pointer-events-auto"
          >
            <div className="relative">
              <div className="absolute -inset-1 bg-gradient-to-tr from-accent to-purple-500 rounded-xl blur-[2px] opacity-70 group-hover/author:opacity-100 transition-opacity" />
              <img 
                src={reel.authorPhoto || `https://ui-avatars.com/api/?name=${reel.authorName}&background=random`} 
                alt={reel.authorName} 
                className="relative w-10 h-10 rounded-full object-cover border-2 border-white/20"
              />
              {author && (
                <UserStatusDot 
                  user={author} 
                  className="absolute bottom-0 right-0 w-3 h-3 border-2 border-black" 
                  size="sm"
                />
              )}
            </div>
            <div className="flex flex-col items-start">
              <div className="flex items-center space-x-2">
                <span className="text-white font-black text-sm tracking-tight drop-shadow-md">{reel.authorName}</span>
                {currentUser && currentUser.uid !== reel.authorUid && (
                  <button
                    onClick={handleToggleFollow}
                    disabled={followLoading}
                    className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
                      isFollowing 
                        ? 'bg-white/10 text-white border border-white/20' 
                        : 'bg-accent text-white shadow-lg shadow-accent/20'
                    }`}
                  >
                    {followLoading ? <Loader2 size={10} className="animate-spin" /> : isFollowing ? 'Following' : 'Follow'}
                  </button>
                )}
              </div>
              <span className="text-white/60 text-[10px] font-black uppercase tracking-widest drop-shadow-md">Original Audio</span>
            </div>
          </button>
        </div>
        <button 
          onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted); }}
          className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all pointer-events-auto"
        >
          {isMuted ? <VolumeX size={20} /> : <Volume2 size={20} />}
        </button>
        <button className="p-2.5 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all pointer-events-auto">
          <MoreVertical size={20} />
        </button>
      </div>

      {/* Right Side Actions */}
      <div className="absolute right-6 bottom-32 flex flex-col items-center space-y-6 z-20 pointer-events-auto">
        <div className="flex flex-col items-center space-y-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={handleLike}
            className={`p-4 rounded-2xl backdrop-blur-md border transition-all ${
              isLiked 
                ? 'bg-accent/20 border-accent text-accent shadow-[0_0_20px_rgba(var(--accent-rgb),0.3)]' 
                : 'bg-white/10 border-white/10 text-white hover:bg-white/20'
            }`}
          >
            <Heart size={28} fill={isLiked ? 'currentColor' : 'none'} strokeWidth={2.5} />
          </motion.button>
          <span className="text-white text-[10px] font-black uppercase tracking-widest drop-shadow-md">{likesCount}</span>
        </div>

        <div className="flex flex-col items-center space-y-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => setShowComments(true)}
            className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all"
          >
            <MessageCircle size={28} strokeWidth={2.5} />
          </motion.button>
          <span className="text-white text-[10px] font-black uppercase tracking-widest drop-shadow-md">{reel.commentsCount}</span>
        </div>

        <div className="flex flex-col items-center space-y-1">
          <motion.button
            whileTap={{ scale: 0.8 }}
            onClick={() => setShowShare(true)}
            className="p-4 bg-white/10 backdrop-blur-md border border-white/10 rounded-2xl text-white hover:bg-white/20 transition-all"
          >
            <Share2 size={28} strokeWidth={2.5} />
          </motion.button>
          <span className="text-white text-[10px] font-black uppercase tracking-widest drop-shadow-md">{reel.sharesCount || 0}</span>
        </div>

        <div className="w-12 h-12 rounded-full border-2 border-white/20 overflow-hidden animate-spin-slow shadow-xl">
          <img src={reel.authorPhoto || `https://ui-avatars.com/api/?name=${reel.authorName}&background=random`} className="w-full h-full object-cover" alt="music" />
        </div>
      </div>

      {/* Bottom Info */}
      <div className="absolute bottom-10 left-6 right-20 z-20 pointer-events-none">
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2 pointer-events-auto">
            {reel.category && (
              <span className="px-3 py-1 bg-accent text-white rounded-full text-[10px] font-black uppercase tracking-widest shadow-lg shadow-accent/20">
                {reel.category}
              </span>
            )}
          </div>
          <p className="text-white text-sm font-medium leading-relaxed line-clamp-2 drop-shadow-md pointer-events-auto">
            {reel.caption}
          </p>
          <div className="flex items-center space-x-2 text-white/80">
            <Music size={14} className="animate-pulse" />
            <span className="text-[10px] font-black uppercase tracking-widest truncate">
              {reel.authorName} • Original Audio
            </span>
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
  }, [isOpen, currentUser]);

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
            className="relative bg-background w-full max-w-lg h-[60vh] sm:h-[500px] rounded-t-3xl sm:rounded-3xl overflow-hidden shadow-2xl flex flex-col"
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
      <div className="h-screen w-full flex items-center justify-center bg-black">
        <Loader2 size={48} className="text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-black relative overflow-hidden flex flex-col">
      {/* Header */}
      <div className="absolute top-0 left-0 right-0 p-6 z-50 flex flex-col space-y-4 bg-gradient-to-b from-black/80 via-black/40 to-transparent">
        <div className="flex items-center justify-between text-white">
          <h1 className="text-2xl font-bold tracking-tight">Reels</h1>
          <div className="flex items-center space-x-2">
            <NotificationCenter variant="minimal" />
            <div className="relative">
              <button 
                onClick={() => setShowFilterDropdown(!showFilterDropdown)}
                className={`p-2 rounded-full backdrop-blur-md transition-all ${
                  selectedCategory ? 'bg-accent text-white' : 'bg-white/10 hover:bg-white/20'
                }`}
              >
                <Filter size={20} />
              </button>
              
              <AnimatePresence>
                {showFilterDropdown && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 10, scale: 0.95 }}
                    className="absolute right-0 mt-2 w-48 bg-background border border-border rounded-2xl shadow-2xl overflow-hidden z-[60]"
                  >
                    <div className="p-2 max-h-64 overflow-y-auto no-scrollbar">
                      <button
                        onClick={() => {
                          setSelectedCategory(null);
                          setShowFilterDropdown(false);
                        }}
                        className={`w-full text-left px-4 py-2 rounded-xl text-sm transition-colors ${
                          selectedCategory === null ? 'bg-accent text-white' : 'text-primary hover:bg-surface'
                        }`}
                      >
                        All Categories
                      </button>
                      {REEL_CATEGORIES.map(cat => (
                        <button
                          key={cat}
                          onClick={() => {
                            setSelectedCategory(cat);
                            setShowFilterDropdown(false);
                          }}
                          className={`w-full text-left px-4 py-2 rounded-xl text-sm transition-colors ${
                            selectedCategory === cat ? 'bg-accent text-white' : 'text-primary hover:bg-surface'
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
            <button 
              onClick={() => setShowUploadModal(true)}
              className="p-2 bg-white/10 backdrop-blur-md rounded-full hover:bg-white/20 transition-all"
            >
              <Plus size={24} />
            </button>
          </div>
        </div>

        {/* Category Filter */}
        <div className="flex items-center space-x-2 overflow-x-auto no-scrollbar pb-2">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
              selectedCategory === null 
                ? 'bg-white text-black' 
                : 'bg-white/10 text-white hover:bg-white/20'
            }`}
          >
            All
          </button>
          {REEL_CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-4 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-all ${
                selectedCategory === cat 
                  ? 'bg-white text-black' 
                  : 'bg-white/10 text-white hover:bg-white/20'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Centered Reel Container */}
      <div className="flex-1 flex items-center justify-center px-4">
        {/* Reel Viewport */}
        <div 
          ref={containerRef}
          onScroll={handleScroll}
          className="relative rounded-3xl overflow-hidden bg-black"
          style={{
            width: '100%',
            maxWidth: '420px',
            height: '85vh',
            maxHeight: '90vh',
            scrollBehavior: 'smooth'
          }}
        >
          <div 
            className="h-full w-full overflow-y-scroll snap-y snap-mandatory no-scrollbar"
            style={{
              scrollBehavior: 'smooth'
            }}
          >
        {reels.length > 0 ? (
          <div style={{ height: `${reels.length * 100}%`, position: 'relative' }}>
            {/* Invisible snap points to maintain scroll behavior and snapping */}
            {reels.map((reel, index) => (
              <div 
                key={`snap-${reel.id}`} 
                className="snap-start absolute w-full h-full pointer-events-none" 
                style={{ top: `${index * 100}%` }} 
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
                    className="absolute w-full h-full"
                    style={{ top: `${actualIndex * 100}%` }}
                  >
                    <ReelCard reel={reel} isActive={actualIndex === activeIndex} />
                  </div>
                );
              });
            })()}
          </div>
        ) : (
          <div className="h-full w-full flex flex-col items-center justify-center text-white p-6 text-center">
            <div className="w-24 h-24 bg-white/10 rounded-full flex items-center justify-center mb-6">
              <Video size={48} className="text-white/40" />
            </div>
            <h2 className="text-2xl font-bold mb-2">No Reels Yet</h2>
            <p className="text-white/60 max-w-xs mx-auto mb-8">Be the first to share a short video with the community!</p>
            <button 
              onClick={() => setShowUploadModal(true)}
              className="px-8 py-3 bg-accent text-white rounded-2xl font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
            >
              Create First Reel
            </button>
          </div>
        )}
          </div>
        </div>
      </div>

      <UploadReelModal isOpen={showUploadModal} onClose={() => setShowUploadModal(false)} />
    </div>
  );
}
