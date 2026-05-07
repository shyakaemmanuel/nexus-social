import { 
  doc, 
  updateDoc, 
  addDoc, 
  deleteDoc, 
  collection,
  query,
  where,
  getDocs,
  getDoc,
  serverTimestamp,
  setDoc,
  onSnapshot
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { User } from '../types';

export interface ReportData {
  reportedUserId: string;
  reporterId: string;
  reason: 'spam' | 'harassment' | 'inappropriate_content' | 'fake_account' | 'other';
  description: string;
  createdAt: any;
  status: 'pending' | 'reviewed' | 'resolved';
}

export interface BlockData {
  blockerId: string;
  blockedId: string;
  blockedAt: any;
}

export class PrivacySecurity {
  // Toggle private/public account
  static async setAccountPrivacy(userId: string, isPrivate: boolean): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, { isPrivate });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  }

  // Block user
  static async blockUser(blockerId: string, blockedId: string): Promise<void> {
    try {
      // Add to blocker's blocked list
      const blockRef = doc(db, 'users', blockerId, 'blockedUsers', blockedId);
      await setDoc(blockRef, {
        blockerId,
        blockedId,
        blockedAt: serverTimestamp()
      });

      // Update blocker's blocked count
      const blockerRef = doc(db, 'users', blockerId);
      await updateDoc(blockerRef, {
        blockedCount: increment(1)
      });

      // Remove from following if they were following
      await this.unfollowUser(blockerId, blockedId);
      
      // Remove from followers if they were followers
      await this.removeFollower(blockerId, blockedId);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `users/${blockerId}/blockedUsers`);
      throw error;
    }
  }

  // Unblock user
  static async unblockUser(blockerId: string, blockedId: string): Promise<void> {
    try {
      const blockRef = doc(db, 'users', blockerId, 'blockedUsers', blockedId);
      await deleteDoc(blockRef);

      // Update blocker's blocked count
      const blockerRef = doc(db, 'users', blockerId);
      await updateDoc(blockerRef, {
        blockedCount: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `users/${blockerId}/blockedUsers`);
      throw error;
    }
  }

  // Get blocked users
  static async getBlockedUsers(userId: string): Promise<User[]> {
    try {
      const blockedRef = collection(db, 'users', userId, 'blockedUsers');
      const snapshot = await getDocs(blockedRef);
      const blockedIds = snapshot.docs.map(doc => doc.data().blockedId);
      
      if (blockedIds.length === 0) return [];

      // Get user details for blocked users
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        where('__name__', 'in', blockedIds)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      return usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `users/${userId}/blockedUsers`);
      return [];
    }
  }

  // Check if user is blocked
  static async isUserBlocked(userId: string, targetUserId: string): Promise<boolean> {
    try {
      const blockRef = doc(db, 'users', userId, 'blockedUsers', targetUserId);
      const blockSnap = await getDoc(blockRef);
      return blockSnap.exists();
    } catch (error) {
      console.error('Error checking block status:', error);
      return false;
    }
  }

  // Report user
  static async reportUser(
    reporterId: string,
    reportedUserId: string,
    reason: ReportData['reason'],
    description: string
  ): Promise<void> {
    try {
      const reportData: Omit<ReportData, 'createdAt' | 'status'> = {
        reportedUserId,
        reporterId,
        reason,
        description
      };

      await addDoc(collection(db, 'reports'), {
        ...reportData,
        createdAt: serverTimestamp(),
        status: 'pending'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'reports');
      throw error;
    }
  }

  // Report content
  static async reportContent(
    reporterId: string,
    contentId: string,
    contentType: 'post' | 'comment' | 'story' | 'reel',
    reason: ReportData['reason'],
    description: string
  ): Promise<void> {
    try {
      const reportData = {
        reporterId,
        contentId,
        contentType,
        reason,
        description,
        createdAt: serverTimestamp(),
        status: 'pending'
      };

      await addDoc(collection(db, 'contentReports'), reportData);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'contentReports');
      throw error;
    }
  }

  // Get user's privacy settings
  static async getPrivacySettings(userId: string): Promise<{
    isPrivate: boolean;
    allowDirectMessages: 'everyone' | 'following' | 'none';
    showStatus: boolean;
    allowTagging: boolean;
  }> {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      
      if (!userSnap.exists()) {
        throw new Error('User not found');
      }

      const userData = userSnap.data();
      return {
        isPrivate: userData.isPrivate || false,
        allowDirectMessages: userData.settings?.privacy?.allowDirectMessages || 'everyone',
        showStatus: userData.settings?.privacy?.showStatus !== false,
        allowTagging: userData.settings?.privacy?.allowTagging !== false
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}`);
      throw error;
    }
  }

  // Update privacy settings
  static async updatePrivacySettings(
    userId: string,
    settings: {
      isPrivate?: boolean;
      allowDirectMessages?: 'everyone' | 'following' | 'none';
      showStatus?: boolean;
      allowTagging?: boolean;
    }
  ): Promise<void> {
    try {
      const userRef = doc(db, 'users', userId);
      
      // Update nested settings object
      const updates: any = {};
      
      if (settings.isPrivate !== undefined) {
        updates.isPrivate = settings.isPrivate;
      }
      
      if (settings.allowDirectMessages !== undefined) {
        updates['settings.privacy.allowDirectMessages'] = settings.allowDirectMessages;
      }
      
      if (settings.showStatus !== undefined) {
        updates['settings.privacy.showStatus'] = settings.showStatus;
      }
      
      if (settings.allowTagging !== undefined) {
        updates['settings.privacy.allowTagging'] = settings.allowTagging;
      }
      
      await updateDoc(userRef, updates);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}`);
      throw error;
    }
  }

  // Check if user can view content
  static async canViewContent(
    viewerId: string,
    contentOwnerId: string,
    contentIsPrivate: boolean
  ): Promise<boolean> {
    try {
      // Always can view own content
      if (viewerId === contentOwnerId) return true;
      
      // If content is public, anyone can view
      if (!contentIsPrivate) return true;
      
      // Get content owner's privacy settings
      const ownerPrivacy = await this.getPrivacySettings(contentOwnerId);
      
      // If owner has private account, check if viewer follows
      if (ownerPrivacy.isPrivate) {
        const isFollowing = await this.checkFollowStatus(viewerId, contentOwnerId);
        return isFollowing;
      }
      
      return true;
    } catch (error) {
      console.error('Error checking content visibility:', error);
      return false;
    }
  }

  // Check if user can send message
  static async canSendMessage(
    senderId: string,
    recipientId: string
  ): Promise<boolean> {
    try {
      // Can't message self
      if (senderId === recipientId) return false;
      
      // Check if sender is blocked by recipient
      const isBlocked = await this.isUserBlocked(recipientId, senderId);
      if (isBlocked) return false;
      
      // Get recipient's privacy settings
      const recipientPrivacy = await this.getPrivacySettings(recipientId);
      
      switch (recipientPrivacy.allowDirectMessages) {
        case 'none':
          return false;
        case 'following':
          return await this.checkFollowStatus(senderId, recipientId);
        case 'everyone':
        default:
          return true;
      }
    } catch (error) {
      console.error('Error checking message permission:', error);
      return false;
    }
  }

  // Get user's moderation status
  static async getUserModerationStatus(userId: string): Promise<{
    isSuspended: boolean;
    suspensionReason?: string;
    suspensionEnd?: any;
    warningCount: number;
    reportCount: number;
  }> {
    try {
      const moderationRef = doc(db, 'users', userId, 'moderation', 'status');
      const modSnap = await getDoc(moderationRef);
      
      if (!modSnap.exists()) {
        return {
          isSuspended: false,
          warningCount: 0,
          reportCount: 0
        };
      }

      const modData = modSnap.data();
      return {
        isSuspended: modData.isSuspended || false,
        suspensionReason: modData.suspensionReason,
        suspensionEnd: modData.suspensionEnd,
        warningCount: modData.warningCount || 0,
        reportCount: modData.reportCount || 0
      };
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, `users/${userId}/moderation/status`);
      return {
        isSuspended: false,
        warningCount: 0,
        reportCount: 0
      };
    }
  }

  // Subscribe to blocked users list
  static subscribeToBlockedUsers(
    userId: string,
    callback: (blockedUsers: User[]) => void
  ): () => void {
    const blockedRef = collection(db, 'users', userId, 'blockedUsers');
    
    const unsubscribe = onSnapshot(blockedRef, async (snapshot) => {
      const blockedIds = snapshot.docs.map(doc => doc.data().blockedId);
      
      if (blockedIds.length === 0) {
        callback([]);
        return;
      }

      // Get user details for blocked users
      const usersRef = collection(db, 'users');
      const usersQuery = query(
        usersRef,
        where('__name__', 'in', blockedIds)
      );
      
      const usersSnapshot = await getDocs(usersQuery);
      const blockedUsers = usersSnapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as User[];
      callback(blockedUsers);
    });

    return unsubscribe;
  }

  // Helper: Check follow status
  private static async checkFollowStatus(
    followerId: string,
    followingId: string
  ): Promise<boolean> {
    try {
      const followRef = doc(db, 'users', followerId, 'following', followingId);
      const followSnap = await getDoc(followRef);
      return followSnap.exists();
    } catch (error) {
      console.error('Error checking follow status:', error);
      return false;
    }
  }

  // Helper: Unfollow user
  private static async unfollowUser(
    followerId: string,
    followingId: string
  ): Promise<void> {
    try {
      const followRef = doc(db, 'users', followerId, 'following', followingId);
      await deleteDoc(followRef);
    } catch (error) {
      console.error('Error unfollowing user:', error);
    }
  }

  // Helper: Remove follower
  private static async removeFollower(
    userId: string,
    followerId: string
  ): Promise<void> {
    try {
      const followRef = doc(db, 'users', userId, 'followers', followerId);
      await deleteDoc(followRef);
    } catch (error) {
      console.error('Error removing follower:', error);
    }
  }

  // Content filtering utilities
  static filterContent(
    content: string,
    filterLevel: 'none' | 'basic' | 'strict' = 'basic'
  ): { isFiltered: boolean; filteredContent: string } {
    if (filterLevel === 'none') {
      return { isFiltered: false, filteredContent: content };
    }

    // Basic profanity filter (in production, use a proper service)
    const profanityList = [
      'spam', 'scam', 'inappropriate', 'harassment'
      // Add more words as needed
    ];

    let filteredContent = content.toLowerCase();
    let isFiltered = false;

    profanityList.forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      if (regex.test(filteredContent)) {
        filteredContent = filteredContent.replace(regex, '*'.repeat(word.length));
        isFiltered = true;
      }
    });

    return { isFiltered, filteredContent };
  }

  // Rate limiting for actions
  static async checkRateLimit(
    userId: string,
    action: 'like' | 'comment' | 'follow' | 'message',
    limit: number = 50,
    windowMs: number = 3600000 // 1 hour
  ): Promise<{ allowed: boolean; remaining: number; resetTime: number }> {
    try {
      const rateLimitRef = doc(db, 'users', userId, 'rateLimits', action);
      const rateSnap = await getDoc(rateLimitRef);
      
      const now = Date.now();
      const windowStart = now - windowMs;
      
      if (!rateSnap.exists()) {
        // First time action
        await setDoc(rateLimitRef, {
          count: 1,
          windowStart,
          lastReset: now
        });
        return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
      }
      
      const data = rateSnap.data();
      
      // Reset if window has passed
      if (now - data.windowStart > windowMs) {
        await updateDoc(rateLimitRef, {
          count: 1,
          windowStart: now,
          lastReset: now
        });
        return { allowed: true, remaining: limit - 1, resetTime: now + windowMs };
      }
      
      // Check limit
      if (data.count >= limit) {
        return { 
          allowed: false, 
          remaining: 0, 
          resetTime: data.windowStart + windowMs 
        };
      }
      
      // Increment count
      await updateDoc(rateLimitRef, {
        count: increment(1)
      });
      
      return { 
        allowed: true, 
        remaining: limit - data.count - 1, 
        resetTime: data.windowStart + windowMs 
      };
    } catch (error) {
      console.error('Error checking rate limit:', error);
      // Allow action on error
      return { allowed: true, remaining: limit - 1, resetTime: Date.now() + 3600000 };
    }
  }
}

// Helper function for increment
const increment = (n: number) => ({
  increment: n
});

export default PrivacySecurity;
