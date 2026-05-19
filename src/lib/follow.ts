import {
  collection,
  deleteDoc,
  doc,
  getCountFromServer,
  getDoc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where
} from 'firebase/firestore';
import { db } from './firebase';
import { Follow, FollowRequest, User } from '../types';

const followId = (followerId: string, followingId: string) => `${followerId}_${followingId}`;

function relationshipData(followerId: string, followingId: string) {
  return {
    followerUid: followerId,
    followingUid: followingId,
    createdAt: serverTimestamp()
  };
}

// Follow a user
export async function followUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (currentUserId === targetUserId) {
    throw new Error('Cannot follow yourself');
  }

  // Check if target user is private
  const targetUserDoc = await getDoc(doc(db, 'users', targetUserId));
  if (!targetUserDoc.exists()) {
    throw new Error('User not found');
  }

  const targetUser = targetUserDoc.data();
  const isPrivate = targetUser.isPrivate || false;

  if (isPrivate) {
    // Create follow request for private accounts
    await setDoc(doc(db, 'users', targetUserId, 'followRequests', currentUserId), {
      fromUid: currentUserId,
      toUid: targetUserId,
      status: 'pending',
      createdAt: serverTimestamp()
    });
  } else {
    const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
    const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
    const rootFollowRef = doc(db, 'follows', followId(currentUserId, targetUserId));
    const currentUserRef = doc(db, 'users', currentUserId);
    const targetUserRef = doc(db, 'users', targetUserId);

    await runTransaction(db, async (transaction) => {
      const existingFollow = await transaction.get(followingRef);
      if (existingFollow.exists()) return;

      const data = relationshipData(currentUserId, targetUserId);
      transaction.set(followingRef, data);
      transaction.set(followerRef, data);
      transaction.set(rootFollowRef, data);
      transaction.update(currentUserRef, { followingCount: increment(1) });
      transaction.update(targetUserRef, { followersCount: increment(1) });
    });
  }
}

// Unfollow a user
export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (currentUserId === targetUserId) {
    throw new Error('Cannot unfollow yourself');
  }

  const followingRef = doc(db, 'users', currentUserId, 'following', targetUserId);
  const followerRef = doc(db, 'users', targetUserId, 'followers', currentUserId);
  const rootFollowRef = doc(db, 'follows', followId(currentUserId, targetUserId));
  const currentUserRef = doc(db, 'users', currentUserId);
  const targetUserRef = doc(db, 'users', targetUserId);

  await runTransaction(db, async (transaction) => {
    const existingFollow = await transaction.get(followingRef);
    if (!existingFollow.exists()) return;

    transaction.delete(followingRef);
    transaction.delete(followerRef);
    transaction.delete(rootFollowRef);
    transaction.update(currentUserRef, { followingCount: increment(-1) });
    transaction.update(targetUserRef, { followersCount: increment(-1) });
  });
}

// Accept follow request
export async function acceptFollowRequest(currentUserId: string, requesterUserId: string): Promise<void> {
  const requestRef = doc(db, 'users', currentUserId, 'followRequests', requesterUserId);
  const followingRef = doc(db, 'users', requesterUserId, 'following', currentUserId);
  const followerRef = doc(db, 'users', currentUserId, 'followers', requesterUserId);
  const rootFollowRef = doc(db, 'follows', followId(requesterUserId, currentUserId));
  const requesterRef = doc(db, 'users', requesterUserId);
  const currentUserRef = doc(db, 'users', currentUserId);

  await runTransaction(db, async (transaction) => {
    const existingFollow = await transaction.get(followingRef);
    const data = relationshipData(requesterUserId, currentUserId);

    if (!existingFollow.exists()) {
      transaction.set(followingRef, data);
      transaction.set(followerRef, data);
      transaction.set(rootFollowRef, data);
      transaction.update(requesterRef, { followingCount: increment(1) });
      transaction.update(currentUserRef, { followersCount: increment(1) });
    }

    transaction.delete(requestRef);
  });
}

// Reject follow request
export async function rejectFollowRequest(currentUserId: string, requesterUserId: string): Promise<void> {
  await updateDoc(doc(db, 'users', currentUserId, 'followRequests', requesterUserId), {
    status: 'rejected'
  });

  // Delete the follow request
  await deleteDoc(doc(db, 'users', currentUserId, 'followRequests', requesterUserId));
}

// Check if user is following another user
export async function isFollowing(currentUserId: string, targetUserId: string): Promise<boolean> {
  const followDoc = await getDoc(doc(db, 'users', currentUserId, 'following', targetUserId));
  return followDoc.exists();
}

// Get followers list
export async function getFollowers(userId: string): Promise<Follow[]> {
  const followersQuery = query(collection(db, 'users', userId, 'followers'));
  const snapshot = await getDocs(followersQuery);
  return snapshot.docs.map(doc => doc.data() as Follow);
}

// Get following list
export async function getFollowing(userId: string): Promise<Follow[]> {
  const followingQuery = query(collection(db, 'users', userId, 'following'));
  const snapshot = await getDocs(followingQuery);
  return snapshot.docs.map(doc => doc.data() as Follow);
}

export async function getFollowCounts(userId: string): Promise<{ followers: number; following: number }> {
  const [followersSnap, followingSnap] = await Promise.all([
    getCountFromServer(collection(db, 'users', userId, 'followers')),
    getCountFromServer(collection(db, 'users', userId, 'following'))
  ]);

  return {
    followers: followersSnap.data().count,
    following: followingSnap.data().count
  };
}

export async function getSuggestedUsers(currentUserId: string, max = 5): Promise<User[]> {
  const [followingSnap, usersSnap] = await Promise.all([
    getDocs(collection(db, 'users', currentUserId, 'following')),
    getDocs(query(collection(db, 'users'), orderBy('followersCount', 'desc'), limit(50)))
  ]);

  const followingIds = new Set(followingSnap.docs.map((doc) => doc.id));

  return usersSnap.docs
    .map((docSnap) => ({ uid: docSnap.id, ...docSnap.data() } as User))
    .filter((user) => user.uid !== currentUserId && !followingIds.has(user.uid))
    .slice(0, max);
}

// Get pending follow requests
export async function getFollowRequests(userId: string): Promise<FollowRequest[]> {
  const requestsQuery = query(collection(db, 'users', userId, 'followRequests'), where('status', '==', 'pending'));
  const snapshot = await getDocs(requestsQuery);
  return snapshot.docs.map(doc => doc.data() as FollowRequest);
}

// Listen to followers changes
export function listenToFollowers(userId: string, callback: (followers: Follow[]) => void) {
  const q = query(collection(db, 'users', userId, 'followers'));
  return onSnapshot(q, (snapshot) => {
    const followers = snapshot.docs.map(doc => doc.data() as Follow);
    callback(followers);
  });
}

// Listen to following changes
export function listenToFollowing(userId: string, callback: (following: Follow[]) => void) {
  const q = query(collection(db, 'users', userId, 'following'));
  return onSnapshot(q, (snapshot) => {
    const following = snapshot.docs.map(doc => doc.data() as Follow);
    callback(following);
  });
}

// Listen to follow requests
export function listenToFollowRequests(userId: string, callback: (requests: FollowRequest[]) => void) {
  const q = query(collection(db, 'users', userId, 'followRequests'), where('status', '==', 'pending'));
  return onSnapshot(q, (snapshot) => {
    const requests = snapshot.docs.map(doc => doc.data() as FollowRequest);
    callback(requests);
  });
}
