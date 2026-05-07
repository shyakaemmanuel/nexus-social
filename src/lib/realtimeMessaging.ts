import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  serverTimestamp,
  onSnapshot,
  query,
  where,
  orderBy,
  limit,
  getDoc,
  setDoc,
  increment,
  getDocs
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { Message, Chat, User } from '../types';

export interface TypingIndicator {
  userId: string;
  chatId: string;
  isTyping: boolean;
  lastTyped: any;
}

export interface MessageRead {
  messageId: string;
  userId: string;
  readAt: any;
}

export interface OnlineStatus {
  userId: string;
  status: 'online' | 'away' | 'busy' | 'offline';
  lastSeen: any;
}

export class RealtimeMessaging {
  // Send message with delivery tracking
  static async sendMessage(
    chatId: string,
    senderId: string,
    content: string,
    mediaUrl?: string,
    mediaType: 'text' | 'image' | 'video' = 'text'
  ): Promise<string> {
    try {
      // Validate required fields
      if (!chatId || typeof chatId !== 'string') {
        throw new Error('Invalid chatId: must be a non-empty string');
      }
      if (!senderId || typeof senderId !== 'string') {
        throw new Error('Invalid senderId: must be a non-empty string');
      }
      if (!content?.trim() && !mediaUrl) {
        throw new Error('Message must have content or mediaUrl');
      }

      const messageData: any = {
        chatId,
        senderUid: senderId,
        content: content?.trim() || '',
        mediaType: mediaType || 'text',
        read: false,
        createdAt: serverTimestamp(),
        deliveryStatus: 'sent' as const
      };

      // Only add mediaUrl if it exists (prevent undefined)
      if (mediaUrl) {
        messageData.mediaUrl = mediaUrl;
      }

      const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      
      // Update chat's last message
      await this.updateChatLastMessage(chatId, content, senderId);
      
      // Mark as delivered after a short delay
      setTimeout(async () => {
        await this.markMessageAsDelivered(docRef.id, chatId);
      }, 1000);

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
      throw error;
    }
  }

  // Subscribe to messages in real-time
  static subscribeToMessages(
    chatId: string,
    userId: string,
    callback: (messages: Message[]) => void,
    limitCount: number = 50
  ): () => void {
    // Validate chatId to prevent invalid queries
    if (!chatId || typeof chatId !== 'string') {
      console.error('[RealtimeMessaging] Invalid chatId provided:', chatId);
      callback([]);
      return () => {}; // Return no-op unsubscribe
    }

    // Query without orderBy to avoid composite index requirements
    // Sort client-side instead
    const messagesQuery = query(
      collection(db, 'chats', chatId, 'messages'),
      limit(limitCount)
    );

    const unsubscribe = onSnapshot(messagesQuery, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Message[];

      // Sort client-side by createdAt (handle missing timestamps)
      const sortedMessages = messages.sort((a, b) => {
        const timeA = a.createdAt?.toMillis?.() || 0;
        const timeB = b.createdAt?.toMillis?.() || 0;
        return timeA - timeB; // Chronological order
      });

      // Mark messages as read for current user
      this.markMessagesAsRead(sortedMessages, userId, chatId);
      
      callback(sortedMessages);
    }, (error) => {
      console.error('[RealtimeMessaging] Error in subscribeToMessages:', error);
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
    });

    return unsubscribe;
  }

  // Typing indicators
  static async setTypingStatus(
    userId: string,
    chatId: string,
    isTyping: boolean
  ): Promise<void> {
    try {
      const typingRef = doc(db, 'chats', chatId, 'typing', userId);
      
      if (isTyping) {
        await setDoc(typingRef, {
          userId,
          chatId,
          isTyping: true,
          lastTyped: serverTimestamp()
        });
      } else {
        await deleteDoc(typingRef);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `chats/${chatId}/typing`);
    }
  }

  // Subscribe to typing indicators
  static subscribeToTyping(
    chatId: string,
    callback: (typingUsers: string[]) => void
  ): () => void {
    const typingQuery = query(
      collection(db, 'chats', chatId, 'typing')
    );

    const unsubscribe = onSnapshot(typingQuery, (snapshot) => {
      const typingUsers = snapshot.docs
        .map(doc => doc.data().userId)
        .filter(userId => {
          // Remove typing indicators older than 5 seconds
          const typingData = doc.data();
          const now = Date.now();
          const lastTyped = typingData.lastTyped?.toDate()?.getTime() || 0;
          return now - lastTyped < 5000;
        });
      
      callback(typingUsers);
    });

    return unsubscribe;
  }

  // Online status management
  static async updateOnlineStatus(
    userId: string,
    status: 'online' | 'away' | 'busy' | 'offline'
  ): Promise<void> {
    try {
      const statusRef = doc(db, 'users', userId, 'status', 'current');
      
      if (status === 'offline') {
        await deleteDoc(statusRef);
      } else {
        await setDoc(statusRef, {
          userId,
          status,
          lastSeen: serverTimestamp()
        });
      }

      // Update user document
      const userRef = doc(db, 'users', userId);
      await updateDoc(userRef, {
        status,
        lastActive: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${userId}/status`);
    }
  }

  // Subscribe to online status
  static subscribeToOnlineStatus(
    userIds: string[],
    callback: (onlineStatuses: OnlineStatus[]) => void
  ): () => void {
    const statusQuery = query(
      collection(db, 'users'),
      where('__name__', 'in', userIds)
    );

    const unsubscribe = onSnapshot(statusQuery, (snapshot) => {
      const onlineStatuses = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          userId: doc.id,
          status: data.status || 'offline',
          lastSeen: data.lastActive
        };
      });

      callback(onlineStatuses);
    });

    return unsubscribe;
  }

  // Message reactions
  static async addMessageReaction(
    messageId: string,
    userId: string,
    emoji: string
  ): Promise<void> {
    try {
      const reactionRef = doc(db, 'messages', messageId, 'reactions', userId);
      await setDoc(reactionRef, {
        messageId,
        userId,
        emoji,
        createdAt: serverTimestamp()
      });

      // Update message reaction count
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        reactionsCount: increment(1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `messages/${messageId}/reactions`);
      throw error;
    }
  }

  // Remove message reaction
  static async removeMessageReaction(
    messageId: string,
    userId: string
  ): Promise<void> {
    try {
      const reactionRef = doc(db, 'messages', messageId, 'reactions', userId);
      await deleteDoc(reactionRef);

      // Update message reaction count
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        reactionsCount: increment(-1)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${messageId}/reactions`);
      throw error;
    }
  }

  // Message editing
  static async editMessage(
    messageId: string,
    newContent: string,
    userId: string
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      
      if (!messageSnap.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageSnap.data();
      
      // Only allow editing own messages within 15 minutes
      if (messageData.senderUid !== userId) {
        throw new Error('Cannot edit other users messages');
      }

      const createdAt = messageData.createdAt.toDate();
      const now = new Date();
      const minutesDiff = (now.getTime() - createdAt.getTime()) / (1000 * 60);
      
      if (minutesDiff > 15) {
        throw new Error('Can only edit messages within 15 minutes');
      }

      await updateDoc(messageRef, {
        content: newContent,
        edited: true,
        editedAt: serverTimestamp()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `messages/${messageId}`);
      throw error;
    }
  }

  // Message deletion
  static async deleteMessage(
    messageId: string,
    userId: string,
    isChatAdmin: boolean = false
  ): Promise<void> {
    try {
      const messageRef = doc(db, 'messages', messageId);
      const messageSnap = await getDoc(messageRef);
      
      if (!messageSnap.exists()) {
        throw new Error('Message not found');
      }

      const messageData = messageSnap.data();
      
      // Can delete own message or if chat admin
      if (messageData.senderUid !== userId && !isChatAdmin) {
        throw new Error('Cannot delete other users messages');
      }

      // Soft delete (mark as deleted) for chat continuity
      await updateDoc(messageRef, {
        deleted: true,
        deletedAt: serverTimestamp(),
        deletedBy: userId
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `messages/${messageId}`);
      throw error;
    }
  }

  // Message forwarding
  static async forwardMessage(
    originalMessageId: string,
    targetChatId: string,
    senderId: string
  ): Promise<string> {
    try {
      const originalMessageRef = doc(db, 'messages', originalMessageId);
      const messageSnap = await getDoc(originalMessageRef);
      
      if (!messageSnap.exists()) {
        throw new Error('Original message not found');
      }

      const originalData = messageSnap.data();
      
      const forwardedMessageData = {
        chatId: targetChatId,
        senderUid: senderId,
        content: originalData.content,
        mediaUrl: originalData.mediaUrl,
        mediaType: originalData.mediaType,
        read: false,
        createdAt: serverTimestamp(),
        deliveryStatus: 'sent' as const,
        forwarded: true,
        originalMessageId
      };

      const docRef = await addDoc(collection(db, 'chats', targetChatId, 'messages'), forwardedMessageData);
      
      // Update chat's last message
      await this.updateChatLastMessage(targetChatId, originalData.content, senderId);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${targetChatId}/messages`);
      throw error;
    }
  }

  // Voice messages
  static async sendVoiceMessage(
    chatId: string,
    senderId: string,
    audioBlob: Blob,
    duration: number
  ): Promise<string> {
    try {
      // Upload audio to storage (implement with your storage service)
      const audioUrl = await this.uploadAudioToStorage(audioBlob, senderId, chatId);
      
      const messageData = {
        chatId,
        senderUid: senderId,
        content: '', // Voice messages have no text content
        mediaUrl: audioUrl,
        mediaType: 'audio' as const,
        duration,
        read: false,
        createdAt: serverTimestamp(),
        deliveryStatus: 'sent' as const
      };

      const docRef = await addDoc(collection(db, 'chats', chatId, 'messages'), messageData);
      
      // Update chat's last message
      await this.updateChatLastMessage(chatId, '🎤 Voice message', senderId);
      
      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `chats/${chatId}/messages`);
      throw error;
    }
  }

  // Helper methods
  private static async markMessageAsDelivered(messageId: string, chatId: string): Promise<void> {
    try {
      const messageRef = doc(db, 'messages', messageId);
      await updateDoc(messageRef, {
        deliveryStatus: 'delivered'
      });
    } catch (error) {
      console.error('Error marking message as delivered:', error);
    }
  }

  private static async markMessagesAsRead(
    messages: Message[],
    userId: string,
    chatId: string
  ): Promise<void> {
    const unreadMessages = messages.filter(msg => 
      msg.senderUid !== userId && !msg.read
    );

    for (const message of unreadMessages) {
      try {
        const messageRef = doc(db, 'messages', message.id);
        await updateDoc(messageRef, {
          read: true,
          readAt: serverTimestamp()
        });
      } catch (error) {
        console.error(`Error marking message ${message.id} as read:`, error);
      }
    }

    // Update chat unread count
    if (unreadMessages.length > 0) {
      try {
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, {
          unreadCount: increment(-unreadMessages.length)
        });
      } catch (error) {
        console.error('Error updating chat unread count:', error);
      }
    }
  }

  private static async updateChatLastMessage(
    chatId: string,
    lastMessage: string,
    senderId: string
  ): Promise<void> {
    try {
      const chatRef = doc(db, 'chats', chatId);
      await updateDoc(chatRef, {
        lastMessage,
        lastMessageAt: serverTimestamp(),
        lastMessageSender: senderId
      });
    } catch (error) {
      console.error('Error updating chat last message:', error);
    }
  }

  private static async uploadAudioToStorage(
    audioBlob: Blob,
    userId: string,
    chatId: string
  ): Promise<string> {
    // Implement with your storage service (Firebase Storage, S3, etc.)
    // This is a placeholder implementation
    return new Promise((resolve) => {
      setTimeout(() => {
        resolve(`https://storage.example.com/audio/${userId}/${chatId}/${Date.now()}.webm`);
      }, 1000);
    });
  }

  // Connection health monitoring
  static monitorConnectionHealth(
    callback: (isHealthy: boolean) => void
  ): () => void {
    let heartbeatInterval: NodeJS.Timeout;
    let isHealthy = true;

    const checkConnection = async () => {
      try {
        // Simple ping to Firestore
        const testRef = doc(db, 'connection', 'health');
        await getDoc(testRef);
        
        if (!isHealthy) {
          isHealthy = true;
          callback(true);
        }
      } catch (error) {
        if (isHealthy) {
          isHealthy = false;
          callback(false);
        }
      }
    };

    // Check every 30 seconds
    heartbeatInterval = setInterval(checkConnection, 30000);
    checkConnection(); // Initial check

    return () => {
      if (heartbeatInterval) {
        clearInterval(heartbeatInterval);
      }
    };
  }

  // Message search within chat
  static async searchMessagesInChat(
    chatId: string,
    searchQuery: string,
    limitCount: number = 20
  ): Promise<Message[]> {
    try {
      const messagesQuery = query(
        collection(db, 'chats', chatId, 'messages'),
        where('content', '>=', searchQuery.toLowerCase()),
        where('content', '<=', searchQuery.toLowerCase() + '\uf8ff'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );

      const snapshot = await getDocs(messagesQuery);
      return snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })) as Message[];
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      return [];
    }
  }
}

// Helper function for increment
const increment = (n: number) => ({
  increment: n
});

export default RealtimeMessaging;
