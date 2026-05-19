import React, { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Heart, MessageCircle, Share2, Bookmark, MoreHorizontal, Trash2, Edit2, X } from 'lucide-react';
import { doc, getDoc, updateDoc, deleteDoc, setDoc, serverTimestamp, increment, addDoc, collection, onSnapshot } from 'firebase/firestore';
import { formatDistanceToNow } from 'date-fns';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post, Group, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { VideoPlayer } from './VideoPlayer';
import { EditPostModal } from './EditPostModal';
import { CommentsModal } from './CommentsModal';
import { UserStatusDot } from './UserStatusDot';
import { Tooltip } from './Tooltip';
import { followUser, unfollowUser } from '../lib/follow';

interface PostCardProps {
  post: Post;
  onTagClick?: (tag: string) => void;
}

export const PostCard: React.FC<PostCardProps> = ({ post, onTagClick }) => {
  const { user } = useAuth();
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(post.likesCount);
  const [commentsCount, setCommentsCount] = useState(post.commentsCount);
  const [canDelete, setCanDelete] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isCommentsOpen, setIsCommentsOpen] = useState(false);
  const [showHeartAnimation, setShowHeartAnimation] = useState(false);
  const [author, setAuthor] = useState<User | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [followLoading, setFollowLoading] = useState(false);
  const lastTap = useRef<number>(0);

  useEffect(() => {
    // Real-time listener for post document
    const unsubscribePost = onSnapshot(doc(db, 'posts', post.id), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setLikesCount(data.likesCount || 0);
        setCommentsCount(data.commentsCount || 0);
      }
    });

    return () => unsubscribePost();
  }, [post.id]);

  useEffect(() => {
    if (!user) return;
    
    // Fetch author for status and follow state
    const unsubscribeAuthor = onSnapshot(doc(db, 'users', post.authorUid), (docSnap) => {
      if (docSnap.exists()) {
        setAuthor({ uid: docSnap.id, ...docSnap.data() } as User);
      }
    });

    // Check if following
    const followRef = doc(db, 'users', user.uid, 'following', post.authorUid);
    const unsubscribeFollow = onSnapshot(followRef, (snap) => {
      setIsFollowing(snap.exists());
    });

    if (post.authorUid === user.uid) {
      setCanDelete(true);
    }
    
    // Check if post is saved
    const savedRef = doc(db, 'users', user.uid, 'savedPosts', post.id);
    getDoc(savedRef).then(docSnap => {
      if (docSnap.exists()) {
        setIsSaved(true);
      }
    });

    // Check if post is liked by user
    const likeRef = doc(db, 'posts', post.id, 'likes', user.uid);
    const unsubscribeLike = onSnapshot(likeRef, (snap) => {
      setIsLiked(snap.exists());
    });

    if (post.groupId) {
      getDoc(doc(db, 'groups', post.groupId)).then(docSnap => {
        if (docSnap.exists()) {
          const group = docSnap.data() as Group;
          if (group.creatorUid === user.uid || group.adminUids?.includes(user.uid)) {
            setCanDelete(true);
          }
        }
      });
    }

    return () => {
      unsubscribeAuthor();
      unsubscribeFollow();
      unsubscribeLike();
    };
  }, [user, post.authorUid, post.id, post.groupId]);

  const handleToggleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!user || !author || followLoading) return;
    setFollowLoading(true);
    const nextFollowing = !isFollowing;
    setIsFollowing(nextFollowing);

    try {
      if (!nextFollowing) {
        await unfollowUser(user.uid, author.uid);
      } else {
        await followUser(user.uid, author.uid);

        await addDoc(collection(db, 'users', author.uid, 'notifications'), {
          type: author.isPrivate ? 'follow_request' : 'follow',
          title: author.isPrivate ? 'New Follow Request' : 'New Follower',
          body: author.isPrivate ? `${user.displayName} wants to follow you` : `${user.displayName} started following you`,
          fromUid: user.uid,
          fromName: user.displayName,
          fromPhoto: user.photoURL || '',
          read: false,
          createdAt: serverTimestamp()
        });
      }
    } catch (error) {
      setIsFollowing(!nextFollowing);
      handleFirestoreError(error, OperationType.UPDATE, `users/${author.uid}/followers`);
    } finally {
      setFollowLoading(false);
    }
  };

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
        
        // Send notification to author
        if (post.authorUid !== user.uid) {
          await addDoc(collection(db, 'users', post.authorUid, 'notifications'), {
            type: 'like',
            title: 'New Like',
            body: `${user.displayName} liked your post`,
            fromUid: user.uid,
            fromName: user.displayName,
            fromPhoto: user.photoURL || '',
            postId: post.id,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    }
  };

  const handleDoubleTap = () => {
    const now = Date.now();
    const DOUBLE_TAP_DELAY = 300;
    if (now - lastTap.current < DOUBLE_TAP_DELAY) {
      if (!isLiked) {
        handleLike();
      }
      setShowHeartAnimation(true);
      setTimeout(() => setShowHeartAnimation(false), 1000);
    }
    lastTap.current = now;
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
        await setDoc(savedRef, {
          postId: post.id,
          savedAt: serverTimestamp()
        });
      }
    } catch (error) {
      handleFirestoreError(error, isSaved ? OperationType.DELETE : OperationType.WRITE, `users/${user.uid}/savedPosts/${post.id}`);
    }
  };

  const handleDelete = async () => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', post.id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${post.id}`);
    }
  };

  const isAuthor = user?.uid === post.authorUid;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true }}
      className="nexus-card mb-4 w-full overflow-hidden transition-all duration-300 hover:shadow-nexus-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3.5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-0.5 rounded-full bg-gradient-to-tr from-accent via-fuchsia-500 to-amber-400 opacity-0 blur-[1px] transition-opacity group-hover:opacity-100" />
            <img
              src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`}
              alt={post.authorName}
              className="relative h-10 w-10 rounded-full border-2 border-background object-cover"
            />
            {author && (
              <UserStatusDot 
                user={author} 
                className="absolute bottom-0 right-0 w-3.5 h-3.5 border-2" 
                size="sm"
              />
            )}
          </div>
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-2">
              <h3 className="truncate text-sm font-bold tracking-tight text-primary">{post.authorName}</h3>
              {user && user.uid !== post.authorUid && (
                <button
                  onClick={handleToggleFollow}
                  disabled={followLoading}
                  className={`shrink-0 text-[10px] font-bold transition-colors ${
                    isFollowing ? 'text-secondary' : 'text-accent'
                  }`}
                >
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              )}
            </div>
            <p className="text-[11px] font-medium text-secondary">
              {post.createdAt ? formatDistanceToNow(post.createdAt.toDate(), { addSuffix: true }) : 'Just now'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          {isAuthor && (
            <button
              onClick={() => setIsEditOpen(true)}
              className="nexus-icon-button text-accent"
              title="Edit Post"
            >
              <Edit2 size={18} />
            </button>
          )}
          {canDelete && (
            <button
              onClick={handleDelete}
              className="nexus-icon-button text-red-500 hover:bg-red-50"
              title="Delete Post"
            >
              <Trash2 size={18} />
            </button>
          )}
          <button className="nexus-icon-button text-secondary hover:text-primary" aria-label="More post options">
            <MoreHorizontal size={20} />
          </button>
        </div>
      </div>

      <EditPostModal
        post={post}
        isOpen={isEditOpen}
        onClose={() => setIsEditOpen(false)}
      />

      <CommentsModal
        itemId={post.id}
        itemType="posts"
        authorUid={post.authorUid}
        isOpen={isCommentsOpen}
        onClose={() => setIsCommentsOpen(false)}
      />

      {/* Content */}
      <div className="px-4 pb-3">
        <p className="mb-3 whitespace-pre-wrap text-[15px] leading-relaxed text-primary/90">{post.content}</p>
        {post.tags && post.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {post.tags.map(tag => (
              <span 
                key={tag} 
                onClick={() => onTagClick?.(tag)}
                className="cursor-pointer rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold text-accent transition-colors hover:bg-accent/15"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Media */}
      {post.mediaUrl && (
        <div 
          className="group relative aspect-square cursor-pointer overflow-hidden bg-surface"
          onClick={handleDoubleTap}
        >
          {post.mediaType === 'video' ? (
            <VideoPlayer src={post.mediaUrl} className="w-full h-full" />
          ) : (
            <img
              src={post.mediaUrl}
              alt="Post media"
              className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
              referrerPolicy="no-referrer"
            />
          )}
          
          <AnimatePresence>
            {showHeartAnimation && (
              <motion.div
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1.5, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none"
              >
                <Heart size={100} className="text-white fill-white drop-shadow-2xl" />
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Actions */}
      <div className="px-4 pb-4 pt-3">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Tooltip content={isLiked ? 'Unlike' : 'Like'} position="top" delay={300}>
              <button
                onClick={handleLike}
                className={`nexus-icon-button ${isLiked ? 'text-red-500 fill-red-500' : 'text-primary hover:text-secondary'}`}
              >
                <Heart size={26} strokeWidth={isLiked ? 0 : 2} />
              </button>
            </Tooltip>
            <Tooltip content="Comment" position="top" delay={300}>
              <button
                onClick={() => setIsCommentsOpen(true)}
                className="nexus-icon-button text-primary hover:text-secondary"
              >
                <MessageCircle size={26} />
              </button>
            </Tooltip>
            <Tooltip content="Share" position="top" delay={300}>
              <button className="nexus-icon-button text-primary hover:text-secondary">
                <Share2 size={26} />
              </button>
            </Tooltip>
          </div>
          <Tooltip content={isSaved ? 'Unsave' : 'Save'} position="top" delay={300}>
            <button
              onClick={handleSave}
              className={`nexus-icon-button ${isSaved ? 'text-accent fill-accent' : 'text-primary hover:text-secondary'}`}
            >
              <Bookmark size={26} strokeWidth={isSaved ? 0 : 2} />
            </button>
          </Tooltip>
        </div>
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-5 h-5 rounded-full border-2 border-background bg-surface overflow-hidden">
                  <img src={`https://i.pravatar.cc/100?u=${post.id}${i}`} alt="User" />
                </div>
              ))}
            </div>
            <p className="text-sm font-bold tracking-tight text-primary">
              {likesCount.toLocaleString()} <span className="ml-1 text-xs font-medium text-secondary">likes</span>
            </p>
          </div>
          <button 
            onClick={() => setIsCommentsOpen(true)}
            className="text-xs font-medium text-secondary transition-colors hover:text-accent"
          >
            View all {commentsCount} comments
          </button>
        </div>
      </div>
    </motion.div>
  );
};
