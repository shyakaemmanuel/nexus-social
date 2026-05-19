import { Timestamp } from 'firebase/firestore';

export interface User {
  uid: string;
  displayName: string;
  email: string;
  photoURL?: string;
  bio?: string;
  createdAt: Timestamp;
  followersCount: number;
  followingCount: number;
  location?: string;
  website?: string;
  phone?: string;
  role?: 'user' | 'admin';
  status?: 'online' | 'away' | 'busy' | 'offline';
  lastActive?: Timestamp;
  settings?: UserSettings;
  isPrivate?: boolean;
}

export interface UserSettings {
  notifications: {
    messages: boolean;
    likes: boolean;
    comments: boolean;
    follows: boolean;
    groupActivity: boolean;
  };
  privacy: {
    profileVisible: boolean;
    showStatus: boolean;
    allowDirectMessages: 'everyone' | 'following' | 'none';
  };
  appearance: {
    theme: 'light' | 'dark' | 'system';
    fontSize: 'small' | 'medium' | 'large';
  };
}

export interface Post {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  mediaUrl?: string;
  mediaType?: 'image' | 'video';
  likesCount: number;
  commentsCount: number;
  tags?: string[];
  groupId?: string;
  createdAt: Timestamp;
  isPrivate?: boolean;
}

export interface Comment {
  id: string;
  postId: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: Timestamp;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  lastMessageSenderId?: string;
  type: 'direct' | 'group';
  name?: string;
  groupId?: string;
  unreadCount?: Record<string, number>;
  typingStatus?: Record<string, boolean>;
  createdAt?: Timestamp;
}

export interface Message {
  id: string;
  chatId: string;
  senderUid: string;
  content: string;
  mediaUrl?: string;
  mediaType: 'text' | 'image' | 'video' | 'reel';
  reelId?: string;
  status: 'sent' | 'delivered' | 'seen';
  readAt?: Timestamp;
  createdAt: Timestamp;
}

export interface TypingStatus {
  userId: string;
  chatId: string;
  isTyping: boolean;
  timestamp: Timestamp;
}

export interface Group {
  id: string;
  name: string;
  description?: string;
  creatorUid: string;
  adminUids: string[];
  chatId?: string;
  membersCount: number;
  photoURL?: string;
  coverURL?: string;
  privacy?: 'public' | 'private' | 'invite';
  category?: string;
  tags?: string[];
  rules?: string[];
  isPrivate?: boolean;
  createdAt: Timestamp;
}

export interface GroupMember {
  uid: string;
  displayName: string;
  photoURL?: string;
  role?: 'admin' | 'mod' | 'member';
  joinedAt?: Timestamp;
}

export interface Story {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  mediaUrl?: string;
  mediaType: 'image' | 'video' | 'text';
  textContent?: string;
  backgroundColor?: string;
  stickers?: string[];
  caption?: string;
  musicUrl?: string;
  musicTitle?: string;
  textOverlays?: Array<{ id: string; text: string; x: number; y: number; color: string; fontSize: number }>;
  createdAt: Timestamp;
  expiresAt: Timestamp;
  viewers?: string[];
  reactions?: StoryReaction[];
  replies?: StoryReply[];
  isPrivate?: boolean;
}

export interface StoryReaction {
  uid: string;
  emoji: string;
  createdAt: Timestamp;
}

export interface StoryReply {
  id: string;
  storyId: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  content: string;
  createdAt: Timestamp;
}

export interface Highlight {
  id: string;
  userId: string;
  title: string;
  coverUrl?: string;
  storyIds: string[];
  createdAt: Timestamp;
  order: number;
}

export interface Recording {
  id: string;
  meetingId: string;
  userId: string;
  url: string;
  createdAt: Timestamp;
}

export interface Reel {
  id: string;
  authorUid: string;
  authorName: string;
  authorPhoto?: string;
  videoUrl: string;
  caption?: string;
  likesCount: number;
  commentsCount: number;
  sharesCount: number;
  tags?: string[];
  category?: string;
  createdAt: Timestamp;
  isPrivate?: boolean;
}

export interface Notification {
  id: string;
  userId: string;
  type: 'message' | 'group_activity' | 'meeting_invite' | 'like' | 'comment' | 'follow' | 'follow_request';
  title: string;
  body: string;
  data?: any;
  read: boolean;
  createdAt: Timestamp;
}

export interface Follow {
  followerUid: string;
  followingUid: string;
  createdAt: Timestamp;
}

export interface FollowRequest {
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}

export interface Like {
  userId: string;
  postId?: string;
  commentId?: string;
  reelId?: string;
  storyId?: string;
  createdAt: Timestamp;
}

// Meeting types for video/audio calling
export interface Meeting {
  id: string;
  hostUid: string;
  type: 'audio' | 'video' | 'screen_share';
  mode: 'instant' | 'scheduled';
  participants: string[];
  status: 'created' | 'active' | 'ended';
  title?: string;
  description?: string;
  scheduledFor?: Timestamp;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  recordingEnabled: boolean;
  createdAt: Timestamp;
  chatId?: string;
  groupId?: string;
}

export interface MeetingParticipant {
  userId: string;
  meetingId: string;
  joinedAt: Timestamp;
  leftAt?: Timestamp;
  isMuted: boolean;
  isVideoOff: boolean;
  isScreenSharing: boolean;
  role: 'host' | 'participant';
}

export interface CallLog {
  id: string;
  fromUid: string;
  toUid: string;
  meetingId: string;
  type: 'audio' | 'video';
  status: 'missed' | 'accepted' | 'rejected' | 'ended';
  duration?: number; // in seconds
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  createdAt: Timestamp;
}

export interface MeetingInvitation {
  id: string;
  meetingId: string;
  fromUid: string;
  toUid: string;
  status: 'pending' | 'accepted' | 'rejected';
  createdAt: Timestamp;
}
