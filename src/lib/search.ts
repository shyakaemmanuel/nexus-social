import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from './firebase';
import { User } from '../types';

// Search users by username or display name
export async function searchUsers(searchQuery: string, limitCount: number = 20): Promise<User[]> {
  if (!searchQuery.trim()) {
    return [];
  }

  try {
    const usersRef = collection(db, 'users');
    
    // Search by displayName (case-insensitive)
    const queryLower = searchQuery.toLowerCase();
    
    // Since Firestore doesn't support case-insensitive search natively,
    // we'll get all users and filter on the client side
    // For production, you should use Algolia or a dedicated search service
    const snapshot = await getDocs(query(usersRef, limit(100)));
    
    const users = snapshot.docs
      .map(doc => doc.data() as User)
      .filter(user => 
        user.displayName?.toLowerCase().includes(queryLower) ||
        user.email?.toLowerCase().includes(queryLower)
      )
      .slice(0, limitCount);

    return users;
  } catch (error) {
    console.error('Error searching users:', error);
    return [];
  }
}

// Search posts by content or tags
export async function searchPosts(searchQuery: string, limitCount: number = 20): Promise<any[]> {
  if (!searchQuery.trim()) {
    return [];
  }

  try {
    const postsRef = collection(db, 'posts');
    const snapshot = await getDocs(query(postsRef, limit(100)));
    
    const queryLower = searchQuery.toLowerCase();
    
    const posts = snapshot.docs
      .map(doc => ({ id: doc.id, ...doc.data() } as any))
      .filter(post => 
        post.content?.toLowerCase().includes(queryLower) ||
        post.authorName?.toLowerCase().includes(queryLower) ||
        post.tags?.some((tag: string) => tag.toLowerCase().includes(queryLower))
      )
      .slice(0, limitCount);

    return posts;
  } catch (error) {
    console.error('Error searching posts:', error);
    return [];
  }
}

// Get trending users (by followers count)
export async function getTrendingUsers(limitCount: number = 10): Promise<User[]> {
  try {
    const usersRef = collection(db, 'users');
    const snapshot = await getDocs(query(usersRef, limit(100)));
    
    const users = snapshot.docs
      .map(doc => doc.data() as User)
      .sort((a, b) => b.followersCount - a.followersCount)
      .slice(0, limitCount);

    return users;
  } catch (error) {
    console.error('Error getting trending users:', error);
    return [];
  }
}
