import { 
  doc, 
  collection, 
  addDoc, 
  updateDoc, 
  onSnapshot, 
  getDoc, 
  getDocs,
  query, 
  where, 
  orderBy, 
  serverTimestamp,
  deleteDoc,
  limit
} from 'firebase/firestore';
import { db } from './firebase';
import { Meeting, MeetingParticipant, CallLog, MeetingInvitation } from '../types';

// Create a new meeting (instant call)
export async function createMeeting(
  hostUid: string,
  type: 'audio' | 'video',
  participants: string[],
  chatId?: string,
  groupId?: string
): Promise<string> {
  const meetingData: Omit<Meeting, 'id'> = {
    hostUid,
    type,
    mode: 'instant',
    participants,
    status: 'created',
    recordingEnabled: false,
    createdAt: serverTimestamp() as any,
    chatId,
    groupId
  };

  const docRef = await addDoc(collection(db, 'meetings'), meetingData);
  return docRef.id;
}

// Create a scheduled meeting
export async function createScheduledMeeting(
  hostUid: string,
  type: 'audio' | 'video',
  participants: string[],
  title: string,
  description: string,
  scheduledFor: Date,
  recordingEnabled: boolean = false,
  groupId?: string
): Promise<string> {
  const meetingData: Omit<Meeting, 'id'> = {
    hostUid,
    type,
    mode: 'scheduled',
    participants,
    status: 'created',
    title,
    description,
    scheduledFor: scheduledFor as any,
    recordingEnabled,
    createdAt: serverTimestamp() as any,
    groupId
  };

  const docRef = await addDoc(collection(db, 'meetings'), meetingData);
  return docRef.id;
}

// Start a meeting
export async function startMeeting(meetingId: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'active',
    startedAt: serverTimestamp() as any
  });
}

// End a meeting
export async function endMeeting(meetingId: string): Promise<void> {
  await updateDoc(doc(db, 'meetings', meetingId), {
    status: 'ended',
    endedAt: serverTimestamp() as any
  });
}

// Join a meeting (add participant)
export async function joinMeeting(
  meetingId: string,
  userId: string,
  meetingType: 'audio' | 'video',
  role: 'host' | 'participant' = 'participant'
): Promise<void> {
  const participantData: Omit<MeetingParticipant, 'id'> = {
    userId,
    meetingId,
    joinedAt: serverTimestamp() as any,
    isMuted: false,
    isVideoOff: meetingType === 'audio',
    isScreenSharing: false,
    role
  };

  await addDoc(collection(db, `meetings/${meetingId}/participants`), participantData);
}

// Leave a meeting
export async function leaveMeeting(meetingId: string, userId: string): Promise<void> {
  const participantsRef = collection(db, `meetings/${meetingId}/participants`);
  const q = query(participantsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const participantDoc = snapshot.docs[0];
    await updateDoc(doc(db, `meetings/${meetingId}/participants`, participantDoc.id), {
      leftAt: serverTimestamp() as any
    });
  }
}

// Update participant state (mute, video, screen share)
export async function updateParticipantState(
  meetingId: string,
  userId: string,
  updates: {
    isMuted?: boolean;
    isVideoOff?: boolean;
    isScreenSharing?: boolean;
  }
): Promise<void> {
  const participantsRef = collection(db, `meetings/${meetingId}/participants`);
  const q = query(participantsRef, where('userId', '==', userId));
  const snapshot = await getDocs(q);

  if (!snapshot.empty) {
    const participantDoc = snapshot.docs[0];
    await updateDoc(doc(db, `meetings/${meetingId}/participants`, participantDoc.id), updates);
  }
}

// Send meeting invitation
export async function sendMeetingInvitation(
  meetingId: string,
  fromUid: string,
  toUid: string
): Promise<string> {
  const invitationData: Omit<MeetingInvitation, 'id'> = {
    meetingId,
    fromUid,
    toUid,
    status: 'pending',
    createdAt: serverTimestamp() as any
  };

  const docRef = await addDoc(collection(db, 'meetingInvitations'), invitationData);
  return docRef.id;
}

// Accept meeting invitation
export async function acceptMeetingInvitation(invitationId: string): Promise<void> {
  await updateDoc(doc(db, 'meetingInvitations', invitationId), {
    status: 'accepted'
  });
}

// Reject meeting invitation
export async function rejectMeetingInvitation(invitationId: string): Promise<void> {
  await updateDoc(doc(db, 'meetingInvitations', invitationId), {
    status: 'rejected'
  });
}

// Log a call (for call history)
export async function logCall(
  fromUid: string,
  toUid: string,
  meetingId: string,
  type: 'audio' | 'video',
  status: 'missed' | 'accepted' | 'rejected' | 'ended',
  duration?: number
): Promise<string> {
  const callLogData: Omit<CallLog, 'id'> = {
    fromUid,
    toUid,
    meetingId,
    type,
    status,
    duration,
    startedAt: status === 'accepted' || status === 'ended' ? serverTimestamp() as any : undefined,
    createdAt: serverTimestamp() as any
  };

  const docRef = await addDoc(collection(db, 'callLogs'), callLogData);
  return docRef.id;
}

// Update call log when call ends
export async function updateCallLog(callLogId: string, duration: number, status: 'ended'): Promise<void> {
  await updateDoc(doc(db, 'callLogs', callLogId), {
    duration,
    status,
    endedAt: serverTimestamp() as any
  });
}

// Get meeting by ID
export async function getMeeting(meetingId: string): Promise<Meeting | null> {
  const docSnap = await getDoc(doc(db, 'meetings', meetingId));
  if (docSnap.exists()) {
    return { id: docSnap.id, ...docSnap.data() } as Meeting;
  }
  return null;
}

// Listen to meeting changes
export function listenToMeeting(
  meetingId: string,
  callback: (meeting: Meeting | null) => void
): () => void {
  const unsubscribe = onSnapshot(doc(db, 'meetings', meetingId), (docSnap) => {
    if (docSnap.exists()) {
      callback({ id: docSnap.id, ...docSnap.data() } as Meeting);
    } else {
      callback(null);
    }
  });
  return unsubscribe;
}

// Listen to meeting participants
export function listenToParticipants(
  meetingId: string,
  callback: (participants: MeetingParticipant[]) => void
): () => void {
  const q = query(collection(db, `meetings/${meetingId}/participants`));
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const participants = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as unknown as MeetingParticipant[];
    callback(participants);
  });
  return unsubscribe;
}

// Listen to incoming meeting invitations for a user
export function listenToIncomingInvitations(
  userId: string,
  callback: (invitations: MeetingInvitation[]) => void
): () => void {
  const q = query(
    collection(db, 'meetingInvitations'),
    where('toUid', '==', userId),
    where('status', '==', 'pending'),
    orderBy('createdAt', 'desc')
  );
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const invitations = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as MeetingInvitation[];
    callback(invitations);
  });
  return unsubscribe;
}

// Get user's call history
export async function getCallHistory(userId: string, limitCount: number = 50): Promise<CallLog[]> {
  const q = query(
    collection(db, 'callLogs'),
    where('fromUid', '==', userId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as CallLog[];
}

// Get user's scheduled meetings
export function listenToScheduledMeetings(
  userId: string,
  callback: (meetings: Meeting[]) => void
): () => void {
  const q = query(
    collection(db, 'meetings'),
    where('participants', 'array-contains', userId),
    where('mode', '==', 'scheduled'),
    where('status', '==', 'created'),
    orderBy('scheduledFor', 'asc')
  );
  const unsubscribe = onSnapshot(q, (snapshot) => {
    const meetings = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Meeting[];
    callback(meetings);
  });
  return unsubscribe;
}
