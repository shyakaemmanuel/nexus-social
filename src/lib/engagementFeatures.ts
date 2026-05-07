import { 
  collection, 
  doc, 
  addDoc, 
  deleteDoc, 
  updateDoc, 
  increment, 
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Post, User, Notification } from '../types';

export interface ShareData {
  postId: string;
  userId: string;
  sharedTo: 'story' | 'direct_message' | 'external';
  sharedAt: any;
}

export interface SaveData {
  postId: string;
  userId: string;
  savedAt: any;
}

export class EngagementFeatures {
  // Like/Unlike Post
  static async likePost(postId: string, userId: string, postAuthorId: string): Promise<void> {
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', userId);
      await setDoc(likeRef, {
        userId,
        postId,
        createdAt: serverTimestamp()
      });

      // Update post likes count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        likesCount: increment(1)
      });

      // Update author's total likes
      const authorRef = doc(db, 'users', postAuthorId);
      await updateDoc(authorRef, {
        totalLikes: increment(1)
      });

      // Send notification to post author
      await this.sendLikeNotification(postAuthorId, userId, postId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postId}/likes`);
      throw error;
    }
  }

  static async unlikePost(postId: string, userId: string, postAuthorId: string): Promise<void> {
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', userId);
      await deleteDoc(likeRef);

      // Update post likes count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        likesCount: increment(-1)
      });

      // Update author's total likes
      const authorRef = doc(db, 'users', postAuthorId);
      await updateDoc(authorRef, {
        totalLikes: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}/likes`);
      throw error;
    }
  }

  static async isPostLiked(postId: string, userId: string): Promise<boolean> {
    try {
      const likeRef = doc(db, 'posts', postId, 'likes', userId);
      const likeSnap = await getDoc(likeRef);
      return likeSnap.exists();
    } catch (error) {
      console.error('Error checking like status:', error);
      return false;
    }
  }

  // Save/Unsave Post
  static async savePost(postId: string, userId: string): Promise<void> {
    try {
      const saveRef = doc(db, 'users', userId, 'savedPosts', postId);
      await setDoc(saveRef, {
        postId,
        userId,
        savedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${userId}/savedPosts`);
      throw error;
    }
  }

  static async unsavePost(postId: string, userId: string): Promise<void> {
    try {
      const saveRef = doc(db, 'users', userId, 'savedPosts', postId);
      await deleteDoc(saveRef);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${userId}/savedPosts`);
      throw error;
    }
  }

  static async isPostSaved(postId: string, userId: string): Promise<boolean> {
    try {
      const saveRef = doc(db, 'users', userId, 'savedPosts', postId);
      const saveSnap = await getDoc(saveRef);
      return saveSnap.exists();
    } catch (error) {
      console.error('Error checking save status:', error);
      return false;
    }
  }

  // Share Post
  static async sharePost(
    postId: string, 
    userId: string, 
    sharedTo: 'story' | 'direct_message' | 'external'
  ): Promise<void> {
    try {
      const shareRef = collection(db, 'posts', postId, 'shares');
      await addDoc(shareRef, {
        postId,
        userId,
        sharedTo,
        sharedAt: serverTimestamp()
      });

      // Update post shares count
      const postRef = doc(db, 'posts', postId);
      await updateDoc(postRef, {
        sharesCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `posts/${postId}/shares`);
      throw error;
    }
  }

  // Get saved posts
  static async getSavedPosts(userId: string, limitCount: number = 20): Promise<Post[]> {
    try {
      const savedPostsRef = collection(db, 'users', userId, 'savedPosts');
      const q = query(
        savedPostsRef,
        orderBy('savedAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const savedPostIds = snapshot.docs.map(doc => doc.data().postId);
      
      if (savedPostIds.length === 0) return [];

      // Get actual posts
      const postsRef = collection(db, 'posts');
      const postsQuery = query(
        postsRef,
        where('__name__', 'in', savedPostIds),
        orderBy('createdAt', 'desc')
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      return postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/savedPosts`);
      return [];
    }
  }

  // Subscribe to saved posts
  static subscribeToSavedPosts(
    userId: string,
    callback: (posts: Post[]) => void,
    limitCount: number = 20
  ): () => void {
    const savedPostsRef = collection(db, 'users', userId, 'savedPosts');
    const q = query(
      savedPostsRef,
      orderBy('savedAt', 'desc'),
      limit(limitCount)
    );
    
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const savedPostIds = snapshot.docs.map(doc => doc.data().postId);
      
      if (savedPostIds.length === 0) {
        callback([]);
        return;
      }

      // Get actual posts
      const postsRef = collection(db, 'posts');
      const postsQuery = query(
        postsRef,
        where('__name__', 'in', savedPostIds),
        orderBy('createdAt', 'desc')
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      const posts = postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      callback(posts);
    });

    return unsubscribe;
  }

  // Get post engagement stats
  static async getPostEngagement(postId: string): Promise<{
    likesCount: number;
    commentsCount: number;
    sharesCount: number;
    savesCount: number;
  }> {
    try {
      const postRef = doc(db, 'posts', postId);
      const postSnap = await getDoc(postRef);
      
      if (!postSnap.exists()) {
        return { likesCount: 0, commentsCount: 0, sharesCount: 0, savesCount: 0 };
      }

      const postData = postSnap.data();
      return {
        likesCount: postData.likesCount || 0,
        commentsCount: postData.commentsCount || 0,
        sharesCount: postData.sharesCount || 0,
        savesCount: postData.savesCount || 0
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `posts/${postId}`);
      return { likesCount: 0, commentsCount: 0, sharesCount: 0, savesCount: 0 };
    }
  }

  // Get user's recent activity
  static async getUserActivity(userId: string): Promise<{
    likedPosts: Post[];
    savedPosts: Post[];
    sharedPosts: Post[];
  }> {
    try {
      const [likedPosts, savedPosts] = await Promise.all([
        this.getLikedPosts(userId),
        this.getSavedPosts(userId)
      ]);

      // Note: Shared posts would require a separate collection structure
      return {
        likedPosts,
        savedPosts,
        sharedPosts: [] // To be implemented
      };
    } catch (error) {
      console.error('Error getting user activity:', error);
      return { likedPosts: [], savedPosts: [], sharedPosts: [] };
    }
  }

  // Get posts user has liked
  private static async getLikedPosts(userId: string, limitCount: number = 20): Promise<Post[]> {
    try {
      const likesRef = collection(db, 'users', userId, 'likes');
      const q = query(
        likesRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
      
      const snapshot = await getDocs(q);
      const likedPostIds = snapshot.docs.map(doc => doc.data().postId);
      
      if (likedPostIds.length === 0) return [];

      // Get actual posts
      const postsRef = collection(db, 'posts');
      const postsQuery = query(
        postsRef,
        where('__name__', 'in', likedPostIds),
        orderBy('createdAt', 'desc')
      );
      
      const postsSnapshot = await getDocs(postsQuery);
      return postsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/likes`);
      return [];
    }
  }

  // Send like notification
  private static async sendLikeNotification(
    postAuthorId: string, 
    likerId: string, 
    postId: string
  ): Promise<void> {
    try {
      // Don't send notification if user likes their own post
      if (postAuthorId === likerId) return;

      // Get liker info
      const likerRef = doc(db, 'users', likerId);
      const likerSnap = await getDoc(likerRef);
      
      if (!likerSnap.exists()) return;
      
      const likerData = likerSnap.data();
      
      // Create notification
      const notification: Omit<Notification, 'id'> = {
        userId: postAuthorId,
        type: 'like',
        title: 'New Like',
        body: `${likerData.displayName} liked your post`,
        data: { postId, likerId },
        read: false,
        createdAt: serverTimestamp() as any
      };

      await addDoc(collection(db, 'users', postAuthorId, 'notifications'), notification);
    } catch (error) {
      console.error('Error sending like notification:', error);
    }
  }

  // Subscribe to post likes
  static subscribeToPostLikes(
    postId: string,
    callback: (likesCount: number, isLiked: boolean) => void,
    userId: string
  ): () => void {
    const likesRef = collection(db, 'posts', postId, 'likes');
    const q = query(likesRef);
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const likesCount = snapshot.size;
      const isLiked = snapshot.docs.some(doc => doc.id === userId);
      callback(likesCount, isLiked);
    });

    return unsubscribe;
  }

  // Batch operations for better performance
  static async batchEngageWithPosts(
    operations: Array<{
      type: 'like' | 'unlike' | 'save' | 'unsave';
      postId: string;
      userId: string;
      postAuthorId?: string;
    }>
  ): Promise<void> {
    // Note: Firestore batch writes have limitations
    // This would need to be implemented carefully considering the 500 operations limit
    for (const operation of operations) {
      try {
        switch (operation.type) {
          case 'like':
            if (operation.postAuthorId) {
              await this.likePost(operation.postId, operation.userId, operation.postAuthorId);
            }
            break;
          case 'unlike':
            if (operation.postAuthorId) {
              await this.unlikePost(operation.postId, operation.userId, operation.postAuthorId);
            }
            break;
          case 'save':
            await this.savePost(operation.postId, operation.userId);
            break;
          case 'unsave':
            await this.unsavePost(operation.postId, operation.userId);
            break;
        }
      } catch (error) {
        console.error(`Error in batch operation ${operation.type}:`, error);
      }
    }
  }
}

export default EngagementFeatures;
