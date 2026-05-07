import { doc, getDoc, collection, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from './firebase';
import { isFollowing } from './follow';
import { User } from '../types';

// Check if user can send message to another user
export async function canSendMessage(senderUid: string, recipientUid: string): Promise<boolean> {
  if (senderUid === recipientUid) {
    return false; // Cannot message yourself
  }

  // Get recipient user data
  const recipientDoc = await getDoc(doc(db, 'users', recipientUid));
  if (!recipientDoc.exists()) {
    return false;
  }

  const recipient = recipientDoc.data() as User;
  const allowDirectMessages = recipient.settings?.privacy?.allowDirectMessages || 'everyone';

  // Check based on recipient's settings
  switch (allowDirectMessages) {
    case 'none':
      return false;
    case 'following':
      return await isFollowing(senderUid, recipientUid);
    case 'everyone':
    default:
      // For public accounts, anyone can message
      // For private accounts, only followers can message
      if (recipient.isPrivate) {
        return await isFollowing(senderUid, recipientUid);
      }
      return true;
  }
}

// Create or get existing chat between two users
export async function getOrCreateChat(user1Uid: string, user2Uid: string): Promise<string> {
  // Try to find existing chat
  const chatsQuery = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('participants', '==', [user1Uid, user2Uid].sort())
  );
  
  const snapshot = await getDocs(chatsQuery);
  if (!snapshot.empty) {
    return snapshot.docs[0].id;
  }

  // Create new chat
  const chatId = doc(collection(db, 'chats')).id;
  await setDoc(doc(db, 'chats', chatId), {
    id: chatId,
    participants: [user1Uid, user2Uid].sort(),
    type: 'direct',
    createdAt: serverTimestamp()
  });

  return chatId;
}

// Check if chat exists between users
export async function chatExists(user1Uid: string, user2Uid: string): Promise<boolean> {
  const chatsQuery = query(
    collection(db, 'chats'),
    where('type', '==', 'direct'),
    where('participants', '==', [user1Uid, user2Uid].sort())
  );
  
  const snapshot = await getDocs(chatsQuery);
  return !snapshot.empty;
}

// Get user's chat list
export async function getUserChats(userId: string) {
  const chatsQuery = query(
    collection(db, 'chats'),
    where('participants', 'array-contains', userId)
  );
  
  const snapshot = await getDocs(chatsQuery);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
}
