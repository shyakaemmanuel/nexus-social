import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Send, MessageCircle, Loader2, Trash2 } from 'lucide-react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, deleteDoc, setDoc } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { UserStatusDot } from './UserStatusDot';
import { User } from '../types';
import { Heart } from 'lucide-react';

interface Comment {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto: string;
  content: string;
  createdAt: any;
  likesCount?: number;
}

const CommentItem = ({ 
  comment, 
  itemType, 
  itemId, 
  currentUser, 
  onDelete 
}: { 
  comment: Comment, 
  itemType: string, 
  itemId: string, 
  currentUser: any,
  onDelete: (id: string) => void
}) => {
  const [author, setAuthor] = useState<User | null>(null);
  const [isLiked, setIsLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(comment.likesCount || 0);

  useEffect(() => {
    // Fetch author for status
    const unsubscribeAuthor = onSnapshot(doc(db, 'users', comment.authorUid), (docSnap) => {
      if (docSnap.exists()) {
        setAuthor(docSnap.data() as User);
      }
    });

    // Check if liked
    if (currentUser) {
      const likeRef = doc(db, itemType, itemId, 'comments', comment.id, 'likes', currentUser.uid);
      const unsubscribeLike = onSnapshot(likeRef, (snap) => {
        setIsLiked(snap.exists());
      });
      return () => {
        unsubscribeAuthor();
        unsubscribeLike();
      };
    }

    return () => unsubscribeAuthor();
  }, [comment.authorUid, comment.id, currentUser, itemId, itemType]);

  const handleLike = async () => {
    if (!currentUser) return;
    const commentRef = doc(db, itemType, itemId, 'comments', comment.id);
    const likeRef = doc(db, itemType, itemId, 'comments', comment.id, 'likes', currentUser.uid);

    try {
      if (isLiked) {
        await deleteDoc(likeRef);
        await updateDoc(commentRef, { likesCount: increment(-1) });
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await setDoc(likeRef, { uid: currentUser.uid, createdAt: serverTimestamp() });
        await updateDoc(commentRef, { likesCount: increment(1) });
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error liking comment:', error);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex space-x-3 group"
    >
      <div className="relative flex-shrink-0">
        <img 
          src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName}&background=random`} 
          className="w-9 h-9 rounded-full object-cover border border-border shadow-sm"
          alt=""
        />
        {author && (
          <UserStatusDot 
            user={author} 
            className="absolute bottom-0 right-0 w-2.5 h-2.5 border-2 border-background" 
            size="sm"
          />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="bg-background border border-border p-4 rounded-2xl rounded-tl-none shadow-sm group-hover:shadow-md transition-shadow">
          <div className="flex items-center justify-between mb-1">
            <p className="text-xs font-black text-primary truncate mr-2">{comment.authorName}</p>
            <p className="text-[9px] font-bold text-secondary uppercase tracking-tighter whitespace-nowrap">
              {comment.createdAt ? formatDistanceToNow(comment.createdAt.toDate(), { addSuffix: true }) : 'just now'}
            </p>
          </div>
          <p className="text-sm text-primary/80 leading-relaxed break-words">{comment.content}</p>
        </div>
        <div className="flex items-center space-x-4 mt-2 ml-1">
          <button className="text-[10px] font-black text-secondary uppercase tracking-widest hover:text-accent transition-colors">Reply</button>
          <button 
            onClick={handleLike}
            className={`text-[10px] font-black uppercase tracking-widest transition-colors flex items-center space-x-1 ${
              isLiked ? 'text-accent' : 'text-secondary hover:text-accent'
            }`}
          >
            <Heart size={10} fill={isLiked ? 'currentColor' : 'none'} />
            <span>{likesCount > 0 ? likesCount : 'Like'}</span>
          </button>
          {currentUser?.uid === comment.authorUid && (
            <button 
              onClick={() => onDelete(comment.id)}
              className="text-[10px] font-black text-red-500 uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all flex items-center"
            >
              <Trash2 size={10} className="mr-1" />
              Delete
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
};

interface CommentsModalProps {
  itemId: string;
  itemType: 'posts' | 'reels';
  authorUid: string;
  isOpen: boolean;
  onClose: () => void;
}

export const CommentsModal: React.FC<CommentsModalProps> = ({ itemId, itemType, authorUid, isOpen, onClose }) => {
  const { user: currentUser } = useAuth();
  const [comments, setComments] = useState<Comment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(collection(db, itemType, itemId, 'comments'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const commentsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Comment[];
      setComments(commentsData);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, `${itemType}/${itemId}/comments`);
    });

    return () => unsubscribe();
  }, [isOpen, itemId, itemType]);

  const handleSendComment = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newComment.trim() || !currentUser || sending) return;

    setSending(true);
    try {
      const commentContent = newComment.trim();
      setNewComment(''); // Clear early for better UX

      await addDoc(collection(db, itemType, itemId, 'comments'), {
        authorUid: currentUser.uid,
        authorName: currentUser.displayName,
        authorPhoto: currentUser.photoURL || '',
        content: commentContent,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, itemType, itemId), {
        commentsCount: increment(1)
      });

      // Send notification to author
      if (authorUid !== currentUser.uid) {
        await addDoc(collection(db, 'users', authorUid, 'notifications'), {
          type: 'comment',
          title: 'New Comment',
          body: `${currentUser.displayName} commented on your ${itemType === 'posts' ? 'post' : 'reel'}`,
          fromUid: currentUser.uid,
          fromName: currentUser.displayName,
          fromPhoto: currentUser.photoURL || '',
          postId: itemType === 'posts' ? itemId : undefined,
          reelId: itemType === 'reels' ? itemId : undefined,
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `${itemType}/${itemId}/comments`);
    } finally {
      setSending(false);
    }
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!window.confirm('Delete this comment?')) return;
    try {
      await deleteDoc(doc(db, itemType, itemId, 'comments', commentId));
      await updateDoc(doc(db, itemType, itemId), {
        commentsCount: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `${itemType}/${itemId}/comments/${commentId}`);
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
            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
            className="relative bg-background w-full max-w-lg h-[80vh] sm:h-[600px] rounded-t-[2.5rem] sm:rounded-[2.5rem] overflow-hidden shadow-2xl flex flex-col border-t sm:border border-border"
          >
            <div className="p-6 border-b border-border flex items-center justify-between bg-background/80 backdrop-blur-md sticky top-0 z-10">
              <div className="flex flex-col">
                <h3 className="text-lg font-black tracking-tight">Comments</h3>
                <p className="text-[10px] font-black text-secondary uppercase tracking-widest">{comments.length} interactions</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-6 no-scrollbar bg-surface/30">
              {loading ? (
                <div className="flex flex-col items-center justify-center h-full space-y-4">
                  <Loader2 className="animate-spin text-accent" size={32} />
                  <p className="text-[10px] font-black text-secondary uppercase tracking-widest">Loading conversation...</p>
                </div>
              ) : comments.length > 0 ? (
                comments.map((comment) => (
                  <CommentItem 
                    key={comment.id}
                    comment={comment}
                    itemType={itemType}
                    itemId={itemId}
                    currentUser={currentUser}
                    onDelete={handleDeleteComment}
                  />
                ))
              ) : (
                <div className="flex flex-col items-center justify-center h-full text-center p-8">
                  <div className="w-20 h-20 bg-background rounded-[2rem] flex items-center justify-center mb-6 border border-border shadow-sm">
                    <MessageCircle size={32} className="text-zinc-200" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">No comments yet</h4>
                  <p className="text-sm text-secondary max-w-[200px] mx-auto">Be the first to start the conversation on this {itemType === 'posts' ? 'post' : 'reel'}.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-border bg-background/80 backdrop-blur-md">
              <form onSubmit={handleSendComment} className="flex items-center space-x-3">
                <div className="relative flex-1">
                  <input
                    type="text"
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Add a comment..."
                    className="w-full bg-surface border border-border rounded-2xl px-5 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all pr-12"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                    <button type="button" className="text-xl hover:scale-110 transition-transform">😊</button>
                  </div>
                </div>
                <button 
                  type="submit"
                  disabled={!newComment.trim() || sending}
                  className="p-3.5 bg-accent text-white rounded-2xl disabled:opacity-50 transition-all hover:scale-105 active:scale-95 shadow-lg shadow-accent/20 flex items-center justify-center"
                >
                  {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                </button>
              </form>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};
