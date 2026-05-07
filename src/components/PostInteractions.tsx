import React, { useState, useEffect } from 'react';
import { Heart, MessageCircle, Share2, Bookmark } from 'lucide-react';
import { auth } from '../lib/firebase';
import { likePost, unlikePost, isPostLiked, addComment, getPostComments, listenToLikeStatus, listenToComments } from '../lib/interactions';
import { Comment as CommentType } from '../types';

interface PostInteractionsProps {
  postId: string;
  initialLikesCount: number;
  initialCommentsCount: number;
  authorName: string;
  authorPhoto?: string;
}

export const PostInteractions: React.FC<PostInteractionsProps> = ({
  postId,
  initialLikesCount,
  initialCommentsCount,
  authorName,
  authorPhoto
}) => {
  const [isLiked, setIsLiked] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [likesCount, setLikesCount] = useState(initialLikesCount);
  const [commentsCount, setCommentsCount] = useState(initialCommentsCount);
  const [showComments, setShowComments] = useState(false);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [newComment, setNewComment] = useState('');
  const [loadingLike, setLoadingLike] = useState(false);
  const currentUserId = auth.currentUser?.uid;

  useEffect(() => {
    if (!currentUserId) return;

    // Listen to like status
    const unsubscribeLike = listenToLikeStatus(currentUserId, postId, (liked) => {
      setIsLiked(liked);
    });

    // Listen to comments
    const unsubscribeComments = listenToComments(postId, (updatedComments) => {
      setComments(updatedComments);
      setCommentsCount(updatedComments.length);
    });

    return () => {
      unsubscribeLike();
      unsubscribeComments();
    };
  }, [postId, currentUserId]);

  const handleLike = async () => {
    if (!currentUserId) return;
    setLoadingLike(true);

    try {
      if (isLiked) {
        await unlikePost(currentUserId, postId);
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        await likePost(currentUserId, postId);
        setLikesCount(prev => prev + 1);
      }
    } catch (error) {
      console.error('Error toggling like:', error);
    } finally {
      setLoadingLike(false);
    }
  };

  const handleSave = () => {
    setIsSaved(!isSaved);
    // TODO: Implement save/unsave post functionality
  };

  const handleShare = () => {
    // TODO: Implement share functionality
    alert('Share functionality coming soon!');
  };

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUserId || !newComment.trim()) return;

    try {
      await addComment(
        currentUserId,
        postId,
        newComment.trim(),
        auth.currentUser?.displayName || 'Anonymous',
        auth.currentUser?.photoURL
      );
      setNewComment('');
    } catch (error) {
      console.error('Error adding comment:', error);
      alert('Error adding comment');
    }
  };

  return (
    <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
      {/* Action Buttons */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleLike}
            disabled={loadingLike}
            className={`transition-colors ${isLiked ? 'text-red-500' : 'text-gray-600 dark:text-gray-400 hover:text-red-500'}`}
          >
            <Heart
              size={24}
              fill={isLiked ? 'currentColor' : 'none'}
              className={loadingLike ? 'animate-pulse' : ''}
            />
          </button>

          <button
            onClick={() => setShowComments(!showComments)}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <MessageCircle size={24} />
          </button>

          <button
            onClick={handleShare}
            className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors"
          >
            <Share2 size={24} />
          </button>
        </div>

        <button
          onClick={handleSave}
          className={`transition-colors ${isSaved ? 'text-blue-500' : 'text-gray-600 dark:text-gray-400 hover:text-blue-500'}`}
        >
          <Bookmark size={24} fill={isSaved ? 'currentColor' : 'none'} />
        </button>
      </div>

      {/* Likes Count */}
      <div className="mb-2">
        <span className="font-semibold text-gray-900 dark:text-white">
          {likesCount.toLocaleString()} likes
        </span>
      </div>

      {/* Comments Section */}
      {showComments && (
        <div className="border-t border-gray-200 dark:border-gray-700 pt-4 mt-4">
          {/* Comments List */}
          <div className="max-h-60 overflow-y-auto mb-4 space-y-3">
            {comments.length === 0 ? (
              <p className="text-gray-500 dark:text-gray-400 text-sm">No comments yet. Be the first to comment!</p>
            ) : (
              comments.map((comment) => (
                <div key={comment.id} className="flex gap-2">
                  <img
                    src={comment.authorPhoto || `https://ui-avatars.com/api/?name=${comment.authorName}&background=random`}
                    alt={comment.authorName}
                    className="w-8 h-8 rounded-full object-cover flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-sm">
                      <span className="font-semibold text-gray-900 dark:text-white">{comment.authorName}</span>
                      <span className="text-gray-900 dark:text-white ml-2">{comment.content}</span>
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add Comment Form */}
          <form onSubmit={handleSubmitComment} className="flex gap-2">
            <input
              type="text"
              placeholder="Add a comment..."
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              className="flex-1 px-3 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              type="submit"
              disabled={!newComment.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-lg font-semibold hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
            >
              Post
            </button>
          </form>
        </div>
      )}
    </div>
  );
};
