import { doc, setDoc, deleteDoc, getDoc, updateDoc, increment, serverTimestamp, collection, query, where, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from './firebase';
import { Follow, FollowRequest } from '../types';

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
    // Direct follow for public accounts
    await setDoc(doc(db, 'users', currentUserId, 'following', targetUserId), {
      followerUid: currentUserId,
      followingUid: targetUserId,
      createdAt: serverTimestamp()
    });

    await setDoc(doc(db, 'users', targetUserId, 'followers', currentUserId), {
      followerUid: currentUserId,
      followingUid: targetUserId,
      createdAt: serverTimestamp()
    });

    // Update follower/following counts
    await updateDoc(doc(db, 'users', currentUserId), {
      followingCount: increment(1)
    });

    await updateDoc(doc(db, 'users', targetUserId), {
      followersCount: increment(1)
    });
  }
}

// Unfollow a user
export async function unfollowUser(currentUserId: string, targetUserId: string): Promise<void> {
  if (currentUserId === targetUserId) {
    throw new Error('Cannot unfollow yourself');
  }

  // Remove from following
  await deleteDoc(doc(db, 'users', currentUserId, 'following', targetUserId));

  // Remove from followers
  await deleteDoc(doc(db, 'users', targetUserId, 'followers', currentUserId));

  // Update follower/following counts
  await updateDoc(doc(db, 'users', currentUserId), {
    followingCount: increment(-1)
  });

  await updateDoc(doc(db, 'users', targetUserId), {
    followersCount: increment(-1)
  });
}

// Accept follow request
export async function acceptFollowRequest(currentUserId: string, requesterUserId: string): Promise<void> {
  // Update follow request status
  await updateDoc(doc(db, 'users', currentUserId, 'followRequests', requesterUserId), {
    status: 'accepted'
  });

  // Create follow relationship
  await setDoc(doc(db, 'users', requesterUserId, 'following', currentUserId), {
    followerUid: requesterUserId,
    followingUid: currentUserId,
    createdAt: serverTimestamp()
  });

  await setDoc(doc(db, 'users', currentUserId, 'followers', requesterUserId), {
    followerUid: requesterUserId,
    followingUid: currentUserId,
    createdAt: serverTimestamp()
  });

  // Update follower/following counts
  await updateDoc(doc(db, 'users', requesterUserId), {
    followingCount: increment(1)
  });

  await updateDoc(doc(db, 'users', currentUserId), {
    followersCount: increment(1)
  });

  // Delete the follow request
  await deleteDoc(doc(db, 'users', currentUserId, 'followRequests', requesterUserId));
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
