<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Nexus Social - Real-Time Messaging System

A complete, production-ready real-time messaging system for the Nexus Social app built with Firebase Firestore, React, and TypeScript.

## Features

### Real-Time Messaging
- **1-to-1 Direct Chat**: Private conversations between users
- **Real-time Updates**: Messages sync instantly across all devices
- **Message Status**: Sent → Delivered → Seen indicators
- **Typing Indicators**: See when the other person is typing
- **Image Sharing**: Upload and share images in conversations

### Chat Interface
- **Sidebar Conversation List**: All active chats with preview, timestamp, and unread count
- **Modern Chat UI**: WhatsApp/Messenger-style interface
- **Message Grouping**: Messages grouped by date (Today, Yesterday, etc.)
- **Smooth Scrolling**: Auto-scroll to new messages
- **Pagination**: Load older messages on scroll

### Security & Access Control
- **Participant-only Access**: Only chat participants can read messages
- **Messaging Permissions**: Based on follow relationships and user privacy settings
- **Firestore Security Rules**: Comprehensive security configuration
- **Blocked Users**: Cannot send messages to blocked users

### Data Model

#### Chat Collection
```typescript
interface Chat {
  id: string;
  participants: string[];        // Array of user IDs
  lastMessage?: string;
  lastMessageAt?: Timestamp;
  lastMessageSenderId?: string;
  type: 'direct' | 'group';
  unreadCount: Record<string, number>;
  typingStatus: Record<string, boolean>;
  createdAt: Timestamp;
}
```

#### Messages Collection
```typescript
interface Message {
  id: string;
  chatId: string;
  senderUid: string;
  content: string;
  mediaUrl?: string;            // For image messages
  mediaType: 'text' | 'image' | 'video' | 'reel';
  status: 'sent' | 'delivered' | 'seen';
  readAt?: Timestamp;
  createdAt: Timestamp;
}
```

## File Structure

```
src/
├── components/
│   ├── ChatList.tsx          # Sidebar conversation list
│   ├── ChatWindow.tsx        # Chat interface
│   └── FollowButton.tsx      # Follow/unfollow actions
├── context/
│   └── ChatContext.tsx       # Global chat state management
├── lib/
│   ├── messagingRealtime.ts  # Firebase messaging functions
│   └── firebase.ts           # Firebase configuration
├── screens/
│   └── Chat.tsx              # Chat screen with routing
└── types.ts                  # TypeScript interfaces
```

## Usage

### Starting a Chat
```tsx
import { useChat } from '../context/ChatContext';

const { startChat } = useChat();

// From a user profile
const chatId = await startChat(userId);
if (chatId) {
  navigate(`/chats/${chatId}`);
}
```

### Sending a Message
```tsx
const { sendMessage, setTyping } = useChat();

// Send text message
await sendMessage("Hello!");

// Send image
await sendMessage("", imageUrl, 'image');

// Set typing indicator
await setTyping(true);
```

### Access Control
Users can only message if:
1. They follow each other (mutual follow), OR
2. Recipient allows messages from everyone, OR
3. Recipient allows messages from people they follow AND sender is followed

Private accounts require a follow request to be accepted before messaging.

## Run Locally

**Prerequisites:** Node.js 16+

1. Install dependencies:
   ```bash
   npm install
   ```

2. Configure Firebase:
   - Create a Firebase project
   - Enable Firestore and Storage
   - Add your config to `firebase-applet-config.json`
   - In Firebase Console, enable Google sign-in under Authentication > Sign-in method
   - Add development domains under Authentication > Settings > Authorized domains: `localhost`, `127.0.0.1`, and any ngrok or preview host names you use (for example `abcd1234.ngrok.io`)

3. Deploy Firestore Security Rules:
   ```bash
   firebase deploy --only firestore:rules
   ```

4. Run the app:
   ```bash
   npm run dev
   ```

## Firestore Security Rules

Security rules are defined in `firestore.rules`. Key protections:

- Only chat participants can read chat data
- Only the message sender can create messages
- Users can only access chats they are participants in
- Profile data respects privacy settings (private accounts)

## Performance Optimizations

- **Message Pagination**: Load 50 messages initially, load more on scroll
- **Firestore Indexing**: Indexed queries for fast message retrieval
- **Efficient Listeners**: Unsubscribe from listeners when components unmount
- **Optimistic UI**: Immediate feedback for message sending
- **Batch Writes**: Atomic operations for sending messages and updating chat metadata

## Navigation

- `/chats` - Chat list (sidebar only on desktop)
- `/chats/:chatId` - Direct chat view

The URL updates automatically when selecting a chat, enabling deep linking and browser back/forward navigation.
