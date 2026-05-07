import { collection, query, orderBy, where, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Post } from '../types';

export interface EngagementScore {
  postId: string;
  score: number;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  createdAt: any;
  authorUid: string;
}

export class FeedAlgorithm {
  static calculateEngagementScore(post: Post): number {
    const now = new Date();
    const createdAt = post.createdAt.toDate();
    const hoursAgo = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    
    // Time decay factor (newer posts get higher score)
    const timeDecay = Math.max(0.1, 1 / (1 + hoursAgo * 0.1));
    
    // Engagement metrics with different weights
    const likesWeight = 1;
    const commentsWeight = 3; // Comments are more valuable than likes
    const sharesWeight = 5; // Shares are most valuable
    
    const engagementScore = 
      (post.likesCount * likesWeight) +
      (post.commentsCount * commentsWeight) +
      ((post as any).sharesCount || 0 * sharesWeight);
    
    // Apply time decay
    return engagementScore * timeDecay;
  }

  static async getPersonalizedFeed(
    userId: string, 
    followingUids: string[],
    limitCount: number = 20
  ): Promise<Post[]> {
    try {
      // Get posts from followed users
      const postsQuery = query(
        collection(db, 'posts'),
        where('authorUid', 'in', followingUids),
        orderBy('createdAt', 'desc'),
        limit(limitCount * 2) // Get more to rank
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Calculate engagement scores and sort
      const scoredPosts = posts.map(post => ({
        post,
        score: this.calculateEngagementScore(post)
      }));
      
      // Sort by engagement score and take top posts
      scoredPosts.sort((a, b) => b.score - a.score);
      
      return scoredPosts.slice(0, limitCount).map(item => item.post);
    } catch (error) {
      console.error('Error getting personalized feed:', error);
      return [];
    }
  }

  static async getTrendingPosts(limitCount: number = 50): Promise<Post[]> {
    try {
      // Get recent posts (last 7 days)
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const postsQuery = query(
        collection(db, 'posts'),
        where('createdAt', '>=', sevenDaysAgo),
        orderBy('createdAt', 'desc'),
        limit(limitCount * 2)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Calculate engagement scores and sort
      const scoredPosts = posts.map(post => ({
        post,
        score: this.calculateEngagementScore(post)
      }));
      
      scoredPosts.sort((a, b) => b.score - a.score);
      
      return scoredPosts.slice(0, limitCount).map(item => item.post);
    } catch (error) {
      console.error('Error getting trending posts:', error);
      return [];
    }
  }

  static async getDiscoverPosts(
    userId: string,
    blockedUids: string[],
    limitCount: number = 30
  ): Promise<Post[]> {
    try {
      // Get popular posts from users you don't follow
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('likesCount', 'desc'),
        limit(limitCount * 2)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Filter out own posts and blocked users
      const filteredPosts = posts.filter(post => 
        post.authorUid !== userId && !blockedUids.includes(post.authorUid)
      );
      
      // Calculate engagement scores and sort
      const scoredPosts = filteredPosts.map(post => ({
        post,
        score: this.calculateEngagementScore(post)
      }));
      
      scoredPosts.sort((a, b) => b.score - a.score);
      
      return scoredPosts.slice(0, limitCount).map(item => item.post);
    } catch (error) {
      console.error('Error getting discover posts:', error);
      return [];
    }
  }

  static subscribeToPersonalizedFeed(
    userId: string,
    followingUids: string[],
    callback: (posts: Post[]) => void,
    limitCount: number = 20
  ): () => void {
    const postsQuery = query(
      collection(db, 'posts'),
      where('authorUid', 'in', followingUids),
      orderBy('createdAt', 'desc'),
      limit(limitCount * 2)
    );

    const unsubscribe = onSnapshot(postsQuery, (snapshot) => {
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Calculate engagement scores and sort
      const scoredPosts = posts.map(post => ({
        post,
        score: this.calculateEngagementScore(post)
      }));
      
      scoredPosts.sort((a, b) => b.score - a.score);
      
      callback(scoredPosts.slice(0, limitCount).map(item => item.post));
    });

    return unsubscribe;
  }
}

export default FeedAlgorithm;
