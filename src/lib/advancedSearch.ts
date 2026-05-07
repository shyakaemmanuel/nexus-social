import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Post, User } from '../types';

export interface SearchResult {
  type: 'user' | 'post' | 'hashtag';
  id: string;
  data: User | Post;
  relevanceScore: number;
}

export interface HashtagResult {
  tag: string;
  count: number;
  recentPosts: Post[];
}

export class AdvancedSearch {
  static async searchUsers(
    query: string,
    currentUserId: string,
    limitCount: number = 10
  ): Promise<SearchResult[]> {
    try {
      // Search by display name and bio
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        where('displayName', '>=', query.toLowerCase()),
        where('displayName', '<=', query.toLowerCase() + '\uf8ff'),
        limit(limitCount * 2)
      );

      const snapshot = await getDocs(usersQuery);
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
      
      // Filter out current user and calculate relevance
      const results = users
        .filter(user => user.uid !== currentUserId)
        .map(user => ({
          type: 'user' as const,
          id: user.uid,
          data: user,
          relevanceScore: this.calculateUserRelevance(user, query)
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limitCount);

      return results;
    } catch (error) {
      console.error('Error searching users:', error);
      return [];
    }
  }

  static async searchPosts(
    query: string,
    currentUserId: string,
    followingUids: string[] = [],
    limitCount: number = 20
  ): Promise<SearchResult[]> {
    try {
      const postsRef = collection(db, 'posts');
      const postsQuery = query(
        postsRef,
        orderBy('createdAt', 'desc'),
        limit(limitCount * 3)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Filter and calculate relevance
      const results = posts
        .filter(post => this.postMatchesQuery(post, query))
        .map(post => ({
          type: 'post' as const,
          id: post.id,
          data: post,
          relevanceScore: this.calculatePostRelevance(post, query, followingUids)
        }))
        .sort((a, b) => b.relevanceScore - a.relevanceScore)
        .slice(0, limitCount);

      return results;
    } catch (error) {
      console.error('Error searching posts:', error);
      return [];
    }
  }

  static async searchHashtags(
    query: string,
    limitCount: number = 10
  ): Promise<HashtagResult[]> {
    try {
      const postsRef = collection(db, 'posts');
      const postsQuery = query(
        postsRef,
        orderBy('createdAt', 'desc'),
        limit(1000) // Get recent posts to analyze hashtags
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Extract and count hashtags
      const hashtagCounts = new Map<string, { count: number; posts: Post[] }>();
      
      posts.forEach(post => {
        if (post.tags) {
          post.tags.forEach(tag => {
            if (tag.toLowerCase().includes(query.toLowerCase())) {
              const existing = hashtagCounts.get(tag) || { count: 0, posts: [] };
              existing.count++;
              existing.posts.push(post);
              hashtagCounts.set(tag, existing);
            }
          });
        }
      });

      // Convert to results and sort
      const results = Array.from(hashtagCounts.entries())
        .map(([tag, data]) => ({
          tag,
          count: data.count,
          recentPosts: data.posts.slice(0, 5) // Keep only recent 5 posts
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limitCount);

      return results;
    } catch (error) {
      console.error('Error searching hashtags:', error);
      return [];
    }
  }

  static async getTrendingHashtags(limitCount: number = 10): Promise<HashtagResult[]> {
    try {
      const postsRef = collection(db, 'posts');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const postsQuery = query(
        postsRef,
        where('createdAt', '>=', sevenDaysAgo),
        limit(2000)
      );

      const snapshot = await getDocs(postsQuery);
      const posts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      
      // Extract and count hashtags from last 7 days
      const hashtagCounts = new Map<string, { count: number; posts: Post[] }>();
      
      posts.forEach(post => {
        if (post.tags) {
          post.tags.forEach(tag => {
            const existing = hashtagCounts.get(tag) || { count: 0, posts: [] };
            existing.count++;
            existing.posts.push(post);
            hashtagCounts.set(tag, existing);
          });
        }
      });

      // Convert to results and sort by count
      const results = Array.from(hashtagCounts.entries())
        .map(([tag, data]) => ({
          tag,
          count: data.count,
          recentPosts: data.posts.slice(0, 5)
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, limitCount);

      return results;
    } catch (error) {
      console.error('Error getting trending hashtags:', error);
      return [];
    }
  }

  static async getSuggestedUsers(
    currentUserId: string,
    followingUids: string[],
    limitCount: number = 10
  ): Promise<User[]> {
    try {
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        limit(100)
      );

      const snapshot = await getDocs(usersQuery);
      const users = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
      
      // Filter out current user and already followed users
      const suggestions = users
        .filter(user => 
          user.uid !== currentUserId && 
          !followingUids.includes(user.uid)
        )
        .map(user => ({
          user,
          score: this.calculateSuggestionScore(user, followingUids)
        }))
        .sort((a, b) => b.score - a.score)
        .slice(0, limitCount)
        .map(item => item.user);

      return suggestions;
    } catch (error) {
      console.error('Error getting suggested users:', error);
      return [];
    }
  }

  static async comprehensiveSearch(
    query: string,
    currentUserId: string,
    followingUids: string[] = []
  ): Promise<{
    users: SearchResult[];
    posts: SearchResult[];
    hashtags: HashtagResult[];
  }> {
    const [users, posts, hashtags] = await Promise.all([
      this.searchUsers(query, currentUserId),
      this.searchPosts(query, currentUserId, followingUids),
      this.searchHashtags(query)
    ]);

    return { users, posts, hashtags };
  }

  private static calculateUserRelevance(user: User, query: string): number {
    const queryLower = query.toLowerCase();
    const displayName = user.displayName.toLowerCase();
    const bio = user.bio?.toLowerCase() || '';
    
    let score = 0;
    
    // Exact match in display name
    if (displayName === queryLower) score += 100;
    // Display name starts with query
    else if (displayName.startsWith(queryLower)) score += 80;
    // Display name contains query
    else if (displayName.includes(queryLower)) score += 60;
    
    // Bio contains query
    if (bio.includes(queryLower)) score += 30;
    
    // Boost for users with more followers
    score += Math.min(user.followersCount / 100, 10);
    
    return score;
  }

  private static calculatePostRelevance(
    post: Post, 
    query: string, 
    followingUids: string[]
  ): number {
    const queryLower = query.toLowerCase();
    const content = post.content.toLowerCase();
    const tags = post.tags || [];
    
    let score = 0;
    
    // Content contains query
    if (content.includes(queryLower)) score += 50;
    
    // Tags match
    const matchingTags = tags.filter(tag => 
      tag.toLowerCase().includes(queryLower)
    );
    score += matchingTags.length * 30;
    
    // Boost for posts from followed users
    if (followingUids.includes(post.authorUid)) score += 20;
    
    // Boost based on engagement
    score += Math.min(post.likesCount / 10, 15);
    score += Math.min(post.commentsCount / 5, 10);
    
    // Time decay (newer posts get higher score)
    const hoursAgo = (Date.now() - post.createdAt.toDate().getTime()) / (1000 * 60 * 60);
    score += Math.max(0, 20 - hoursAgo);
    
    return score;
  }

  private static postMatchesQuery(post: Post, query: string): boolean {
    const queryLower = query.toLowerCase();
    const content = post.content.toLowerCase();
    const tags = post.tags || [];
    
    return (
      content.includes(queryLower) ||
      tags.some(tag => tag.toLowerCase().includes(queryLower)) ||
      post.authorName.toLowerCase().includes(queryLower)
    );
  }

  private static calculateSuggestionScore(user: User, followingUids: string[]): number {
    let score = 0;
    
    // Boost for users with more followers
    score += Math.min(user.followersCount / 50, 20);
    
    // Boost for verified/higher status users
    if (user.role === 'admin') score += 15;
    
    // Boost for recently active users
    if (user.lastActive) {
      const daysAgo = (Date.now() - user.lastActive.toDate().getTime()) / (1000 * 60 * 60 * 24);
      score += Math.max(0, 10 - daysAgo);
    }
    
    // Boost for users with complete profiles
    if (user.bio && user.photoURL) score += 5;
    
    return score;
  }
}

export default AdvancedSearch;
