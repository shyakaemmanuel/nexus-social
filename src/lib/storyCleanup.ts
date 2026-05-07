import { collection, query, where, getDocs, deleteDoc, doc, Timestamp } from 'firebase/firestore';
import { db } from './firebase';

/**
 * Delete expired stories from Firestore
 * This should be called periodically (e.g., on app load or via a scheduled job)
 */
export async function deleteExpiredStories() {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'stories'),
      where('expiresAt', '<=', now)
    );

    const snapshot = await getDocs(q);
    
    if (snapshot.empty) {
      return;
    }

    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(docSnap.ref));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting expired stories:', error);
    throw error;
  }
}

/**
 * Delete expired stories for a specific user
 * @param userId - The user ID to clean up stories for
 */
export async function deleteUserExpiredStories(userId: string) {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'stories'),
      where('authorUid', '==', userId),
      where('expiresAt', '<=', now)
    );

    const snapshot = await getDocs(q);

    if (snapshot.empty) {
      return;
    }

    const deletePromises = snapshot.docs.map(docSnap => deleteDoc(doc(db, 'stories', docSnap.id)));
    await Promise.all(deletePromises);
  } catch (error) {
    console.error('Error deleting expired stories for user:', error);
  }
}
