import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Heart, MessageCircle, Share2, Bookmark, Trash2, MoreHorizontal } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, increment } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { VideoPlayer } from './VideoPlayer';
import { CommentsModal } from './CommentsModal';

interface PostDetailModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
  onDelete?: (postId: string) => void;
}

export const PostDetailModal: React.FC<PostDetailModalProps> = ({ post, isOpen, onClose, onDelete }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);

  useEffect(() => {
    setLikesCount(post.likesCount);
  }, [post.likesCount]);

  useEffect(() => {
    if (!user || !isOpen) return;
    
    // Check if post is saved
    const savedRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
    getDoc(savedRef).then(docSnap => setIsSaved(docSnap.exists()));

    // Check if post is liked
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    getDoc(likeRef).then(docSnap => setIsLiked(docSnap.exists()));
  }, [user, post.id, isOpen]);

  const handleLike = async () => {
    if (!user) return;
    const postRef = doc(db, 'posts', post.id);
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    
    try {
      if (isLiked) {
        setIsLiked(false);
        setLikesCount(prev => Math.max(0, prev - 1));
        await updateDoc(postRef, { likesCount: increment(-1) });
        await deleteDoc(likeRef);
      } else {
        setIsLiked(true);
        setLikesCount(prev => prev + 1);
        await updateDoc(postRef, { likesCount: increment(1) });
        await setDoc(likeRef, { uid: user.uid, createdAt: serverTimestamp() });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    const savedRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
    try {
      if (isSaved) {
        setIsSaved(false);
        await deleteDoc(savedRef);
      } else {
        setIsSaved(true);
        await setDoc(savedRef, { postId: post.id, savedAt: serverTimestamp() });
      }
    } catch (error) {
      handleFirestoreError(error, isSaved ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/savedPosts/${post.id}`);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-10 bg-black/80 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background w-full max-w-5xl rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col md:flex-row h-[90vh] sm:h-[80vh] border border-border"
      >
        {/* Media Section */}
        <div className="flex-1 bg-black flex items-center justify-center relative group">
          {post.mediaUrl ? (
            post.mediaType === 'video' ? (
              <VideoPlayer src={post.mediaUrl} className="w-full h-full" />
            ) : (
              <img src={post.mediaUrl} alt="Post" className="w-full h-full object-contain" referrerPolicy="no-referrer" />
            )
          ) : (
            <div className="p-12 text-center">
              <p className="text-white text-xl font-medium leading-relaxed">{post.content}</p>
            </div>
          )}
          <button 
            onClick={onClose}
            className="absolute top-6 left-6 p-2.5 bg-black/40 text-white rounded-full md:hidden backdrop-blur-md border border-white/20"
          >
            <X size={24} />
          </button>
        </div>

        {/* Info Section */}
        <div className="w-full md:w-[400px] bg-background flex flex-col border-l border-border">
          <div className="p-6 border-b border-border flex items-center justify-between bg-background/50 backdrop-blur-md">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full p-[2px] bg-gradient-to-tr from-accent to-purple-500">
                <img 
                  src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`} 
                  alt={post.authorName} 
                  className="w-full h-full rounded-full object-cover border-2 border-background"
                />
              </div>
              <div>
                <span className="font-black text-sm tracking-tight block">{post.authorName}</span>
                <span className="text-[10px] font-black text-secondary uppercase tracking-widest">Nexus Member</span>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              {user?.uid === post.authorUid && (
                <button 
                  onClick={() => onDelete?.(post.id)}
                  className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-all"
                >
                  <Trash2 size={18} />
                </button>
              )}
              <button onClick={onClose} className="hidden md:block p-2 hover:bg-surface rounded-full transition-all">
                <X size={20} />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar bg-surface/10">
            <div className="space-y-4">
              <p className="text-sm leading-relaxed text-primary/90 whitespace-pre-wrap">{post.content}</p>
              {post.tags && post.tags.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {post.tags.map(tag => (
                    <span key={tag} className="text-accent text-[11px] font-black uppercase tracking-widest hover:text-accent/70 cursor-pointer transition-colors">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
              <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">
                {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
              </p>
            </div>

            <div className="pt-6 border-t border-border">
              <button 
                onClick={() => setIsCommentsOpen(true)}
                className="w-full py-4 bg-surface border border-border rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-secondary hover:text-accent hover:border-accent transition-all flex items-center justify-center space-x-2"
              >
                <MessageCircle size={16} />
                <span>View all {post.commentsCount} comments</span>
              </button>
            </div>
          </div>

          <div className="p-6 border-t border-border bg-background/50 backdrop-blur-md">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center space-x-6">
                <button 
                  onClick={handleLike}
                  className={`transition-all active:scale-150 ${isLiked ? 'text-red-500 fill-red-500' : 'text-primary hover:text-secondary'}`}
                >
                  <Heart size={26} strokeWidth={isLiked ? 0 : 2} />
                </button>
                <button 
                  onClick={() => setIsCommentsOpen(true)}
                  className="text-primary hover:text-secondary transition-all active:scale-125"
                >
                  <MessageCircle size={26} />
                </button>
                <button className="text-primary hover:text-secondary transition-all active:scale-125">
                  <Share2 size={26} />
                </button>
              </div>
              <button 
                onClick={handleSave}
                className={`transition-all active:scale-150 ${isSaved ? 'text-accent fill-accent' : 'text-primary hover:text-secondary'}`}
              >
                <Bookmark size={26} strokeWidth={isSaved ? 0 : 2} />
              </button>
            </div>
            <p className="text-xs font-black tracking-tight text-primary">
              {likesCount.toLocaleString()} <span className="text-secondary font-bold uppercase text-[10px] tracking-widest ml-1">likes</span>
            </p>
          </div>
        </div>
      </motion.div>

      <CommentsModal
        itemId={post.id}
        itemType="posts"
        authorUid={post.authorUid}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />
    </div>
  );
};
