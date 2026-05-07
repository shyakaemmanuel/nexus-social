import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { Chat, Message } from '../types';
import { useAuth } from './AuthContext';
import { 
  subscribeToChats, 
  subscribeToMessages, 
  subscribeToTypingStatus,
  sendMessage as sendMessageApi,
  markMessagesAsSeen,
  markMessagesAsDelivered,
  setTypingStatus,
  getOrCreateDirectChat,
  getChatById,
  getMessages as getMessagesApi,
  deleteChat
} from '../lib/messagingRealtime';
import { canSendMessage } from '../lib/messaging';
import { Unsubscribe } from 'firebase/firestore';

interface ChatContextType {
  chats: Chat[];
  activeChat: Chat | null;
  messages: Message[];
  typingUsers: Record<string, boolean>;
  loading: boolean;
  messagesLoading: boolean;
  hasMoreMessages: boolean;
  error: string | null;
  canMessageUser: (recipientUid: string) => Promise<boolean>;
  setActiveChat: (chat: Chat | null) => void;
  setActiveChatById: (chatId: string) => Promise<void>;
  startChat: (recipientUid: string) => Promise<string | null>;
  sendMessage: (content: string, mediaUrl?: string, mediaType?: Message['mediaType']) => Promise<void>;
  markAsRead: () => Promise<void>;
  setTyping: (isTyping: boolean) => Promise<void>;
  loadMoreMessages: () => Promise<void>;
  deleteCurrentChat: () => Promise<void>;
  refreshChats: () => void;
  clearError: () => void;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export function ChatProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [activeChat, setActiveChatState] = useState<Chat | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [typingUsers, setTypingUsers] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [hasMoreMessages, setHasMoreMessages] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const chatsUnsubscribe = useRef<Unsubscribe | null>(null);
  const messagesUnsubscribe = useRef<Unsubscribe | null>(null);
  const typingUnsubscribe = useRef<Unsubscribe | null>(null);
  const processingFollowRef = useRef(false);
  const messageLimitRef = useRef(50);
  const isSettingUpMessages = useRef(false);

  // Subscribe to user's chats
  useEffect(() => {
    if (!user) {
      setChats([]);
      setActiveChatState(null);
      setMessages([]);
      return;
    }

    setLoading(true);
    chatsUnsubscribe.current = subscribeToChats(
      user.uid,
      (chatsData) => {
        setChats(chatsData);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      }
    );

    return () => {
      chatsUnsubscribe.current?.();
    };
  }, [user]);

  // Subscribe to messages when active chat changes
  useEffect(() => {
    // Guard: Skip if already setting up or missing required data
    if (isSettingUpMessages.current || !user?.uid || !activeChat?.id) {
      if (!activeChat?.id) {
        setMessages([]);
        setTypingUsers({});
        setHasMoreMessages(true);
        messageLimitRef.current = 50;
        messagesUnsubscribe.current?.();
        typingUnsubscribe.current?.();
        messagesUnsubscribe.current = null;
        typingUnsubscribe.current = null;
      }
      return;
    }

    // Set guard to prevent concurrent setups
    isSettingUpMessages.current = true;

    // Clear previous listeners before setting up new ones
    messagesUnsubscribe.current?.();
    typingUnsubscribe.current?.();
    messagesUnsubscribe.current = null;
    typingUnsubscribe.current = null;

    const chatId = activeChat.id;
    const userId = user.uid;

    // Set up real-time message subscription as single source of truth
    try {
      messagesUnsubscribe.current = subscribeToMessages(
        chatId,
        (msgs) => {
          setMessages(msgs);
          setMessagesLoading(false);
          
          // Mark delivered for new messages from others
          const hasUnreadFromOthers = msgs.some(
            m => m.senderUid !== userId && m.status === 'sent'
          );
          if (hasUnreadFromOthers && !processingFollowRef.current) {
            markMessagesAsDelivered(chatId, userId).catch(console.error);
          }
          
          // Auto-mark as seen for received messages
          const hasUnseenFromOthers = msgs.some(
            m => m.senderUid !== userId && m.status !== 'seen'
          );
          if (hasUnseenFromOthers && !processingFollowRef.current) {
            markMessagesAsSeen(chatId, userId).catch(console.error);
          }
        },
        (err) => {
          console.error('Message subscription error:', err);
          setError(err.message);
          setMessagesLoading(false);
        }
      );

      // Subscribe to typing status
      typingUnsubscribe.current = subscribeToTypingStatus(
        chatId,
        (status) => {
          const others = Object.entries(status).reduce((acc, [uid, isTyping]) => {
            if (uid !== userId) acc[uid] = isTyping;
            return acc;
          }, {} as Record<string, boolean>);
          setTypingUsers(others);
        }
      );
    } catch (err) {
      console.error('Error setting up message listeners:', err);
      setError('Failed to connect to chat');
      setMessagesLoading(false);
    }

    // Release guard after setup
    isSettingUpMessages.current = false;

    return () => {
      messagesUnsubscribe.current?.();
      typingUnsubscribe.current?.();
      messagesUnsubscribe.current = null;
      typingUnsubscribe.current = null;
    };
  }, [activeChat?.id, user?.uid]);

  const setActiveChat = useCallback((chat: Chat | null) => {
    setActiveChatState(chat);
    setError(null);
  }, []);

  const setActiveChatById = useCallback(async (chatId: string): Promise<void> => {
    if (!user) return;
    
    try {
      // First check if chat exists in our list
      const existingChat = chats.find(c => c.id === chatId);
      if (existingChat) {
        setActiveChat(existingChat);
        return;
      }
      
      // Otherwise fetch from Firestore
      const chat = await getChatById(chatId);
      if (!chat) {
        throw new Error('Chat not found');
      }
      
      // Verify user is a participant
      if (!chat.participants.includes(user.uid)) {
        throw new Error('You do not have access to this chat');
      }
      
      setActiveChat(chat);
    } catch (err: any) {
      setError(err.message);
    }
  }, [user, chats]);

  const canMessageUser = useCallback(async (recipientUid: string): Promise<boolean> => {
    if (!user) return false;
    return canSendMessage(user.uid, recipientUid);
  }, [user]);

  const startChat = useCallback(async (recipientUid: string): Promise<string | null> => {
    if (!user) return null;
    
    // Check if messaging is allowed
    const allowed = await canSendMessage(user.uid, recipientUid);
    if (!allowed) {
      setError('You cannot message this user');
      return null;
    }

    try {
      const { chatId } = await getOrCreateDirectChat(user.uid, recipientUid);
      
      // Find chat in existing chats or wait for subscription
      const existingChat = chats.find(c => c.id === chatId);
      if (existingChat) {
        setActiveChat(existingChat);
      }
      
      return chatId;
    } catch (err: any) {
      setError(err.message);
      return null;
    }
  }, [user, chats]);

  const sendMessage = useCallback(async (
    content: string, 
    mediaUrl?: string, 
    mediaType: Message['mediaType'] = 'text'
  ): Promise<void> => {
    // Validate user and chat
    if (!user?.uid || !activeChat?.id) {
      console.error('sendMessage: Missing user or activeChat', { userUid: user?.uid, chatId: activeChat?.id });
      setError('No active chat');
      return;
    }

    // Validate message content
    const trimmedContent = content?.trim() || '';
    if (!trimmedContent && !mediaUrl) {
      setError('Message cannot be empty');
      return;
    }

    try {
      clearError();
      await sendMessageApi(activeChat.id, user.uid, trimmedContent, mediaUrl, mediaType);
      
      // Clear typing status after sending
      await setTypingStatus(activeChat.id, user.uid, false).catch(() => {});
    } catch (err: any) {
      console.error('sendMessage error:', err);
      setError(err.message || 'Failed to send message');
      throw err;
    }
  }, [user?.uid, activeChat?.id]);

  const markAsRead = useCallback(async (): Promise<void> => {
    if (!user || !activeChat) return;
    
    try {
      await markMessagesAsSeen(activeChat.id, user.uid);
    } catch (err: any) {
      console.error('Error marking as read:', err);
    }
  }, [user, activeChat]);

  const setTyping = useCallback(async (isTyping: boolean): Promise<void> => {
    if (!user || !activeChat) return;
    
    try {
      await setTypingStatus(activeChat.id, user.uid, isTyping);
    } catch (err) {
      console.error('Error setting typing status:', err);
    }
  }, [user, activeChat]);

  const loadMoreMessages = useCallback(async (): Promise<void> => {
    if (!user || !activeChat || messagesLoading || !hasMoreMessages) return;
    
    setMessagesLoading(true);
    messageLimitRef.current += 50;
    
    try {
      const olderMessages = await getMessagesApi(
        activeChat.id, 
        messageLimitRef.current
      );
      
      setMessages(olderMessages);
      setHasMoreMessages(olderMessages.length === messageLimitRef.current);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setMessagesLoading(false);
    }
  }, [user, activeChat, messagesLoading, hasMoreMessages]);

  const deleteCurrentChat = useCallback(async (): Promise<void> => {
    if (!user || !activeChat) return;
    
    try {
      await deleteChat(activeChat.id, user.uid);
      setActiveChat(null);
    } catch (err: any) {
      setError(err.message);
      throw err;
    }
  }, [user, activeChat]);

  const refreshChats = useCallback(() => {
    if (!user) return;
    
    chatsUnsubscribe.current?.();
    chatsUnsubscribe.current = subscribeToChats(
      user.uid,
      setChats,
      (err) => setError(err.message)
    );
  }, [user]);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const value: ChatContextType = {
    chats,
    activeChat,
    messages,
    typingUsers,
    loading,
    messagesLoading,
    hasMoreMessages,
    error,
    canMessageUser,
    setActiveChat,
    setActiveChatById,
    startChat,
    sendMessage,
    markAsRead,
    setTyping,
    loadMoreMessages,
    deleteCurrentChat,
    refreshChats,
    clearError
  };

  return (
    <ChatContext.Provider value={value}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat() {
  const context = useContext(ChatContext);
  if (context === undefined) {
    throw new Error('useChat must be used within a ChatProvider');
  }
  return context;
}
