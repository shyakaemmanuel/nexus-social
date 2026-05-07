import { doc, setDoc, deleteDoc, getDoc, updateDoc, increment, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Like, Comment } from '../types';

// LIKE SYSTEM

// Like a post
export async function likePost(userId: string, postId: string): Promise<void> {
  await setDoc(doc(db, 'posts', postId, 'likes', userId), {
    userId,
    postId,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'posts', postId), {
    likesCount: increment(1)
  });
}

// Unlike a post
export async function unlikePost(userId: string, postId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId, 'likes', userId));

  await updateDoc(doc(db, 'posts', postId), {
    likesCount: increment(-1)
  });
}

// Check if user liked a post
export async function isPostLiked(userId: string, postId: string): Promise<boolean> {
  const likeDoc = await getDoc(doc(db, 'posts', postId, 'likes', userId));
  return likeDoc.exists();
}

// Get post likes
export async function getPostLikes(postId: string): Promise<Like[]> {
  const likesQuery = query(collection(db, 'posts', postId, 'likes'));
  const snapshot = await getDocs(likesQuery);
  return snapshot.docs.map(doc => doc.data() as Like);
}

// Listen to like status changes
export function listenToLikeStatus(userId: string, postId: string, callback: (isLiked: boolean) => void) {
  return onSnapshot(doc(db, 'posts', postId, 'likes', userId), (doc) => {
    callback(doc.exists());
  });
}

// COMMENT SYSTEM

// Add comment to post
export async function addComment(
  userId: string,
  postId: string,
  content: string,
  authorName: string,
  authorPhoto?: string
): Promise<string> {
  const commentRef = doc(collection(db, 'posts', postId, 'comments'));
  const commentId = commentRef.id;

  await setDoc(commentRef, {
    id: commentId,
    postId,
    authorUid: userId,
    authorName,
    authorPhoto,
    content,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'posts', postId), {
    commentsCount: increment(1)
  });

  return commentId;
}

// Delete comment
export async function deleteComment(postId: string, commentId: string, userId: string): Promise<void> {
  await deleteDoc(doc(db, 'posts', postId, 'comments', commentId));

  await updateDoc(doc(db, 'posts', postId), {
    commentsCount: increment(-1)
  });
}

// Get post comments
export async function getPostComments(postId: string): Promise<Comment[]> {
  const commentsQuery = query(collection(db, 'posts', postId, 'comments'));
  const snapshot = await getDocs(commentsQuery);
  return snapshot.docs.map(doc => doc.data() as Comment);
}

// Listen to comments changes
export function listenToComments(postId: string, callback: (comments: Comment[]) => void) {
  const q = query(collection(db, 'posts', postId, 'comments'));
  return onSnapshot(q, (snapshot) => {
    const comments = snapshot.docs.map(doc => doc.data() as Comment);
    callback(comments);
  });
}

// REAL-LIKE SYSTEM (for stories and reels)

// Like a reel
export async function likeReel(userId: string, reelId: string): Promise<void> {
  await setDoc(doc(db, 'reels', reelId, 'likes', userId), {
    userId,
    reelId,
    createdAt: serverTimestamp()
  });

  await updateDoc(doc(db, 'reels', reelId), {
    likesCount: increment(1)
  });
}

// Unlike a reel
export async function unlikeReel(userId: string, reelId: string): Promise<void> {
  await deleteDoc(doc(db, 'reels', reelId, 'likes', userId));

  await updateDoc(doc(db, 'reels', reelId), {
    likesCount: increment(-1)
  });
}

// Check if user liked a reel
export async function isReelLiked(userId: string, reelId: string): Promise<boolean> {
  const likeDoc = await getDoc(doc(db, 'reels', reelId, 'likes', userId));
  return likeDoc.exists();
}

// Like a story
export async function likeStory(userId: string, storyId: string, emoji: string): Promise<void> {
  await setDoc(doc(db, 'stories', storyId, 'reactions', userId), {
    uid: userId,
    emoji,
    createdAt: serverTimestamp()
  });
}

// Unlike a story
export async function unlikeStory(userId: string, storyId: string): Promise<void> {
  await deleteDoc(doc(db, 'stories', storyId, 'reactions', userId));
}
