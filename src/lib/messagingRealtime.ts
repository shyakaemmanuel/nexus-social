import { 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  getDoc, 
  collection, 
  query, 
  where, 
  orderBy, 
  onSnapshot,
  serverTimestamp,
  Timestamp,
  writeBatch,
  increment,
  limit,
  getDocs,
  addDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Message, Chat, TypingStatus } from '../types';

// Send a message
export async function sendMessage(
  chatId: string,
  senderUid: string,
  content: string,
  mediaUrl?: string,
  mediaType: Message['mediaType'] = 'text'
): Promise<string> {
  // Validate required parameters
  if (!chatId || typeof chatId !== 'string') {
    throw new Error('Invalid chatId: must be a non-empty string');
  }
  if (!senderUid || typeof senderUid !== 'string') {
    throw new Error('Invalid senderUid: must be a non-empty string');
  }
  if (!content?.trim() && !mediaUrl) {
    throw new Error('Message must have content or mediaUrl');
  }

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  const messageId = doc(messagesRef).id;
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
  const chatRef = doc(db, 'chats', chatId);
  
  const message: Omit<Message, 'id'> = {
    chatId,
    senderUid,
    content: content?.trim() || '',
    mediaType: mediaType || 'text',
    status: 'sent',
    createdAt: serverTimestamp() as Timestamp,
    ...(mediaUrl && { mediaUrl })
  };

  // Get chat to find recipient
  const chatSnap = await getDoc(chatRef);
  if (!chatSnap.exists()) {
    throw new Error('Chat not found');
  }
  
  const chat = chatSnap.data() as Chat;
  const recipientUid = chat.participants.find(uid => uid !== senderUid);

  // Use batch write for atomic operations
  const batch = writeBatch(db);
  
  // Add message
  batch.set(messageRef, message);
  
  // Update chat with last message
  batch.update(chatRef, {
    lastMessage: content,
    lastMessageAt: serverTimestamp(),
    lastMessageSenderId: senderUid,
    [`unreadCount.${recipientUid}`]: increment(1)
  });

  await batch.commit();
  
  return messageId;
}

// Mark messages as delivered
export async function markMessagesAsDelivered(chatId: string, userId: string): Promise<void> {
  // Query all 'sent' messages and filter by sender client-side
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    where('status', '==', 'sent')
  );
  
  const snapshot = await getDocs(messagesQuery);
  const batch = writeBatch(db);
  let hasUpdates = false;
  
  snapshot.docs.forEach(doc => {
    const message = doc.data() as Message;
    // Only mark as delivered if it's from someone else
    if (message.senderUid !== userId) {
      batch.update(doc.ref, { status: 'delivered' });
      hasUpdates = true;
    }
  });
  
  if (hasUpdates) {
    await batch.commit();
  }
}

// Mark messages as seen
export async function markMessagesAsSeen(chatId: string, userId: string): Promise<void> {
  // Query all unread messages and filter by sender client-side
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages'),
    where('status', 'in', ['sent', 'delivered'])
  );
  
  const snapshot = await getDocs(messagesQuery);
  const batch = writeBatch(db);
  let hasUpdates = false;
  
  snapshot.docs.forEach(doc => {
    const message = doc.data() as Message;
    // Only mark as seen if it's from someone else
    if (message.senderUid !== userId) {
      batch.update(doc.ref, { 
        status: 'seen',
        readAt: serverTimestamp()
      });
      hasUpdates = true;
    }
  });
  
  // Reset unread count for this user
  const chatRef = doc(db, 'chats', chatId);
  batch.update(chatRef, {
    [`unreadCount.${userId}`]: 0
  });
  
  if (hasUpdates) {
    await batch.commit();
  } else {
    // Still need to update unread count
    await updateDoc(chatRef, {
      [`unreadCount.${userId}`]: 0
    });
  }
}

// Delete a message (only sender can delete)
export async function deleteMessage(chatId: string, messageId: string, senderUid: string): Promise<void> {
  const messageRef = doc(db, 'chats', chatId, 'messages', messageId);
  const messageSnap = await getDoc(messageRef);
  
  if (!messageSnap.exists()) {
    throw new Error('Message not found');
  }
  
  const message = messageSnap.data() as Message;
  if (message.senderUid !== senderUid) {
    throw new Error('Only the sender can delete this message');
  }
  
  await deleteDoc(messageRef);
}

// Update typing status
export async function setTypingStatus(
  chatId: string, 
  userId: string, 
  isTyping: boolean
): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  await updateDoc(chatRef, {
    [`typingStatus.${userId}`]: isTyping
  });
}

// Subscribe to messages in a chat
export function subscribeToMessages(
  chatId: string,
  callback: (messages: Message[]) => void,
  onError?: (error: Error) => void
) {
  if (!chatId || typeof chatId !== 'string') {
    const error = new Error('Invalid chatId for message subscription');
    console.error(error);
    onError?.(error);
    return () => {}; // Return no-op unsubscribe
  }

  const messagesRef = collection(db, 'chats', chatId, 'messages');
  
  // Query without ordering first - order client-side to avoid index requirements
  // and handle messages that might not have createdAt yet
  const q = query(messagesRef);
  
  return onSnapshot(q, (snapshot) => {
    const messages = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Message[];
    
    // Sort client-side by createdAt (handle messages without timestamp)
    const sortedMessages = messages.sort((a, b) => {
      const timeA = a.createdAt?.toMillis?.() || 0;
      const timeB = b.createdAt?.toMillis?.() || 0;
      return timeA - timeB;
    });
    
    callback(sortedMessages);
  }, (error) => {
    console.error('Error subscribing to messages:', error);
    onError?.(error);
  });
}

// Subscribe to user's chats
export function subscribeToChats(
  userId: string,
  callback: (chats: Chat[]) => void,
  onError?: (error: Error) => void
) {
  // Query without orderBy to avoid composite index requirement
  // Sort client-side instead
  const q = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const chats = snapshot.docs
      .map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Chat[];
    
    // Sort client-side by lastMessageAt (handle null values)
    const sortedChats = chats.sort((a, b) => {
      const timeA = a.lastMessageAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0;
      const timeB = b.lastMessageAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0;
      return timeB - timeA; // Descending order
    });
    
    callback(sortedChats);
  }, (error) => {
    console.error('Error subscribing to chats:', error);
    onError?.(error);
  });
}

// Subscribe to typing status in a chat
export function subscribeToTypingStatus(
  chatId: string,
  callback: (typingStatus: Record<string, boolean>) => void
) {
  const chatRef = doc(db, 'chats', chatId);
  
  return onSnapshot(chatRef, (snapshot) => {
    if (snapshot.exists()) {
      const chat = snapshot.data() as Chat;
      callback(chat.typingStatus || {});
    }
  });
}

// Get chat by ID
export async function getChatById(chatId: string): Promise<Chat | null> {
  const chatRef = doc(db, 'chats', chatId);
  const snapshot = await getDoc(chatRef);
  
  if (!snapshot.exists()) {
    return null;
  }
  
  return { id: snapshot.id, ...snapshot.data() } as Chat;
}

// Get or create direct chat between two users
export async function getOrCreateDirectChat(
  user1Uid: string, 
  user2Uid: string
): Promise<{ chatId: string; isNew: boolean }> {
  // Check for existing chat
  const chatsQuery = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('participants', 'array-contains', user1Uid)
  );
  
  const snapshot = await getDocs(chatsQuery);
  const existingChat = snapshot.docs.find(doc => {
    const chat = doc.data() as Chat;
    return chat.participants.includes(user2Uid);
  });
  
  if (existingChat) {
    return { chatId: existingChat.id, isNew: false };
  }
  
  // Create new chat
  const chatId = doc(collection(db, 'chats')).id;
  const chatRef = doc(db, 'chats', chatId);
  
  const chat: Omit<Chat, 'id'> = {
    participants: [user1Uid, user2Uid].sort(),
    type: 'direct',
    unreadCount: { [user1Uid]: 0, [user2Uid]: 0 },
    typingStatus: {},
    createdAt: serverTimestamp() as Timestamp
  };
  
  await setDoc(chatRef, chat);
  
  return { chatId, isNew: true };
}

// Get messages for a chat (paginated)
export async function getMessages(
  chatId: string, 
  messageLimit: number = 50
): Promise<Message[]> {
  // Query without orderBy to avoid index requirements
  // Sort client-side instead
  const q = query(
    collection(db, 'chats', chatId, 'messages'),
    limit(messageLimit)
  );
  
  const snapshot = await getDocs(q);
  const messages = snapshot.docs.map(doc => ({ 
    id: doc.id, 
    ...doc.data() 
  })) as Message[];
  
  // Sort by createdAt client-side (handle null timestamps)
  return messages.sort((a, b) => {
    const timeA = a.createdAt?.toMillis?.() || 0;
    const timeB = b.createdAt?.toMillis?.() || 0;
    return timeA - timeB; // Ascending order (oldest first)
  });
}

// Delete a chat and all its messages
export async function deleteChat(chatId: string, userId: string): Promise<void> {
  const chatRef = doc(db, 'chats', chatId);
  const chatSnap = await getDoc(chatRef);
  
  if (!chatSnap.exists()) {
    throw new Error('Chat not found');
  }
  
  const chat = chatSnap.data() as Chat;
  if (!chat.participants.includes(userId)) {
    throw new Error('User is not a participant in this chat');
  }
  
  // For direct chats, both participants can delete
  // For group chats, only admins can delete
  if (chat.type === 'group') {
    // Check if user is admin (would need group data)
    throw new Error('Only group admins can delete group chats');
  }
  
  // Delete all messages
  const messagesQuery = query(
    collection(db, 'chats', chatId, 'messages')
  );
  const messagesSnap = await getDocs(messagesQuery);
  
  const batch = writeBatch(db);
  messagesSnap.docs.forEach(doc => {
    batch.delete(doc.ref);
  });
  
  // Delete chat
  batch.delete(chatRef);
  
  await batch.commit();
}
