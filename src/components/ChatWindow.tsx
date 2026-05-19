import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { Message, Chat } from '../types';
import { Send, ArrowLeft, Paperclip, Image, Smile, MoreVertical, Phone, Video, X, Check, CheckCheck, Loader2, User, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format, isToday, isYesterday } from 'date-fns';

interface ChatUser {
  uid: string;
  displayName: string;
  photoURL?: string;
  status?: 'online' | 'away' | 'busy' | 'offline';
  lastActive?: any;
}

export default function ChatWindow() {
  const { 
    activeChat, 
    messages, 
    typingUsers, 
    sendMessage, 
    setActiveChat, 
    setActiveChatById,
    setTyping, 
    loadMoreMessages,
    messagesLoading,
    hasMoreMessages,
    deleteCurrentChat,
    error,
    clearError
  } = useChat();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [otherUser, setOtherUser] = useState<ChatUser | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [imageUploading, setImageUploading] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [shouldScrollToBottom, setShouldScrollToBottom] = useState(true);

  // Load other participant's data
  useEffect(() => {
    const loadOtherUser = async () => {
      if (!activeChat || !user) return;
      
      const otherUid = activeChat.participants.find(uid => uid !== user.uid);
      if (!otherUid) return;
      
      const userDoc = await getDoc(doc(db, 'users', otherUid));
      if (userDoc.exists()) {
        const data = userDoc.data();
        setOtherUser({
          uid: otherUid,
          displayName: data.displayName,
          photoURL: data.photoURL,
          status: data.status || 'offline',
          lastActive: data.lastActive
        });
      }
    };
    
    loadOtherUser();
  }, [activeChat, user]);

  // Handle scroll for pagination
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return;
    const { scrollTop } = messagesContainerRef.current;
    
    // Load more messages when scrolling near top
    if (scrollTop < 100 && hasMoreMessages && !messagesLoading) {
      loadMoreMessages();
    }
    
    // Determine if we should auto-scroll on new messages
    const { scrollHeight, clientHeight } = messagesContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
    setShouldScrollToBottom(isNearBottom);
  }, [hasMoreMessages, messagesLoading, loadMoreMessages]);

  // Scroll to bottom on new messages (only if user is near bottom)
  useEffect(() => {
    if (shouldScrollToBottom) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, shouldScrollToBottom]);

  // Handle typing indicator
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputMessage(e.target.value);
    
    // Set typing status with error handling
    setTyping(true).catch(() => {});
    
    // Clear previous timeout
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
    
    // Stop typing after 3 seconds of inactivity
    typingTimeoutRef.current = setTimeout(() => {
      try {
        setTyping(false);
      } catch (err) {
        console.error('Failed to stop typing:', err);
      }
    }, 3000);
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputMessage.trim() || loading) return;
    
    setLoading(true);
    clearError?.();
    try {
      await sendMessage(inputMessage.trim());
      setInputMessage('');
      setTyping(false).catch(() => {});
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      setShouldScrollToBottom(true);
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeChat || !user) return;
    
    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }
    
    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB');
      return;
    }
    
    setImageUploading(true);
    clearError?.();
    
    try {
      const downloadURL = await uploadMediaToCloudinary(file, `chats/${activeChat.id}`);
      
      // Send as image message
      await sendMessage('', downloadURL, 'image');
      setShouldScrollToBottom(true);
    } catch (err) {
      console.error('Failed to upload image:', err);
      const message = err instanceof Error ? err.message : 'Please try again.';
      alert(`Failed to upload image. ${message}`);
    } finally {
      setImageUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleDeleteChat = async () => {
    if (!confirm('Are you sure you want to delete this conversation?')) return;
    
    try {
      await deleteCurrentChat?.();
      navigate('/chats');
    } catch (err) {
      console.error('Failed to delete chat:', err);
      alert('Failed to delete conversation');
    }
  };

  const getStatusText = () => {
    const typingUser = Object.entries(typingUsers).find(([, isTyping]) => isTyping);
    if (typingUser) {
      return 'typing...';
    }
    if (otherUser?.status === 'online') {
      return 'online';
    }
    return 'offline';
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getMessageStatus = (message: Message) => {
    if (message.senderUid !== user?.uid) return null;
    
    switch (message.status) {
      case 'sent':
        return <span className="text-xs text-secondary">✓</span>;
      case 'delivered':
        return <span className="text-xs text-secondary">✓✓</span>;
      case 'seen':
        return <span className="text-xs text-accent">✓✓</span>;
      default:
        return null;
    }
  };

  const formatMessageDate = (date: Date) => {
    if (isToday(date)) return 'Today';
    if (isYesterday(date)) return 'Yesterday';
    return format(date, 'MMM d, yyyy');
  };

  const groupMessagesByDate = () => {
    const groups: { date: string; messages: Message[] }[] = [];
    let currentGroup: { date: string; messages: Message[] } | null = null;
    
    messages.forEach((message) => {
      const timestamp = message.createdAt?.toDate ? message.createdAt.toDate() : new Date();
      const date = formatMessageDate(timestamp);
      
      if (!currentGroup || currentGroup.date !== date) {
        currentGroup = { date, messages: [] };
        groups.push(currentGroup);
      }
      
      currentGroup.messages.push(message);
    });
    
    return groups;
  };

  const isSomeoneTyping = Object.values(typingUsers).some(Boolean);

  if (!activeChat) {
    return (
      <div className="flex-1 flex items-center justify-center bg-surface/30">
        <div className="text-center text-secondary px-4">
          <div className="w-20 h-20 rounded-full bg-surface/50 flex items-center justify-center mb-4 mx-auto">
            <MessageSquare size={40} className="opacity-50" />
          </div>
          <h3 className="text-lg font-semibold text-primary mb-2">Select a conversation</h3>
          <p className="text-sm max-w-xs mx-auto">
            Choose a chat from the list or search for users to start messaging
          </p>
          <button
            onClick={() => navigate('/search')}
            className="mt-4 px-4 py-2 bg-accent text-white text-sm font-medium rounded-full hover:bg-accent/90 transition-colors"
          >
            Find people
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="flex items-center space-x-3">
          <button
            onClick={() => setActiveChat(null)}
            className="p-2 hover:bg-surface rounded-full transition-colors lg:hidden"
          >
            <ArrowLeft size={20} />
          </button>
          
          <div className="relative">
            <img
              src={otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherUser?.displayName}&background=random`}
              alt={otherUser?.displayName}
              className="w-10 h-10 rounded-full object-cover"
            />
            <span className={`absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full border-2 border-background ${getStatusColor(otherUser?.status)}`} />
          </div>
          
          <div>
            <h2 className="font-semibold">{otherUser?.displayName}</h2>
            <p className="text-xs text-secondary flex items-center">
              {getStatusText() === 'typing...' && (
                <span className="text-accent flex items-center">
                  typing
                  <span className="ml-1 flex space-x-0.5">
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                </span>
              )}
              {getStatusText() === 'online' && (
                <span className="text-green-500">online</span>
              )}
              {getStatusText() === 'offline' && (
                <span>offline</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-1">
          <button 
            onClick={() => navigate(`/profile/${otherUser?.uid}`)}
            className="p-2 hover:bg-surface rounded-full transition-colors"
            title="View Profile"
          >
            <User size={20} className="text-secondary" />
          </button>
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-2 hover:bg-surface rounded-full transition-colors"
            >
              <MoreVertical size={20} className="text-secondary" />
            </button>
            
            {showMenu && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="absolute right-0 top-full mt-2 w-48 bg-background border border-border rounded-lg shadow-lg z-50 py-1"
              >
                <button
                  onClick={() => {
                    handleDeleteChat();
                    setShowMenu(false);
                  }}
                  className="w-full px-4 py-2 text-left text-sm text-red-500 hover:bg-surface transition-colors"
                >
                  Delete conversation
                </button>
              </motion.div>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-4 space-y-4"
      >
        {/* Load more indicator */}
        {messagesLoading && hasMoreMessages && (
          <div className="flex justify-center py-2">
            <Loader2 size={20} className="animate-spin text-secondary" />
          </div>
        )}
        {groupMessagesByDate().map((group, groupIndex) => (
          <div key={group.date} className="space-y-4">
            {/* Date divider */}
            <div className="flex items-center justify-center">
              <span className="px-3 py-1 bg-surface border border-border rounded-full text-xs text-secondary">
                {group.date}
              </span>
            </div>

            {/* Messages in this group */}
            {group.messages.map((message, index) => {
              const isMe = message.senderUid === user?.uid;
              const showAvatar = !isMe && (
                index === 0 || 
                group.messages[index - 1]?.senderUid !== message.senderUid
              );

              return (
                <motion.div
                  key={message.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
                >
                  <div className={`flex items-end space-x-2 max-w-[70%] ${isMe ? 'flex-row-reverse space-x-reverse' : ''}`}>
                    {/* Avatar */}
                    {!isMe && (
                      <div className="w-8 h-8 flex-shrink-0">
                        {showAvatar ? (
                          <img
                            src={otherUser?.photoURL || `https://ui-avatars.com/api/?name=${otherUser?.displayName}&background=random`}
                            alt={otherUser?.displayName}
                            className="w-8 h-8 rounded-full object-cover"
                          />
                        ) : (
                          <div className="w-8" />
                        )}
                      </div>
                    )}

                    {/* Message bubble */}
                    <div
                      className={`px-4 py-2 rounded-2xl ${
                        isMe
                          ? 'bg-accent text-white rounded-br-md'
                          : 'bg-surface border border-border rounded-bl-md'
                      } ${message.mediaUrl ? 'p-2' : ''}`}
                    >
                      {message.mediaUrl && message.mediaType === 'image' && (
                        <div className="mb-2">
                          <img 
                            src={message.mediaUrl} 
                            alt="Shared image"
                            className="max-w-[200px] max-h-[200px] rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(message.mediaUrl, '_blank')}
                          />
                        </div>
                      )}
                      {message.content && <p className="text-sm">{message.content}</p>}
                      <div className={`flex items-center mt-1 space-x-1 ${isMe ? 'justify-end' : ''}`}>
                        <span className={`text-xs ${isMe ? 'text-white/70' : 'text-secondary'}`}>
                          {format(message.createdAt?.toDate ? message.createdAt.toDate() : new Date(), 'h:mm a')}
                        </span>
                        {getMessageStatus(message)}
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        ))}

        {/* Typing indicator */}
        <AnimatePresence>
          {isSomeoneTyping && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="flex justify-start"
            >
              <div className="flex items-center space-x-2 bg-surface border border-border rounded-2xl px-4 py-3">
                <div className="flex space-x-1">
                  <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-2 h-2 bg-secondary rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-xs text-secondary">typing...</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div ref={messagesEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-xs text-red-500 text-center">{error}</p>
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSendMessage} className="p-4 border-t border-border bg-background">
        <div className="flex items-center space-x-2">
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            onChange={handleImageUpload}
            className="hidden"
          />
          
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={imageUploading}
            className="p-2 text-secondary hover:text-primary transition-colors disabled:opacity-50"
          >
            {imageUploading ? <Loader2 size={20} className="animate-spin" /> : <Image size={20} />}
          </button>
          
          <input
            type="text"
            value={inputMessage}
            onChange={handleInputChange}
            placeholder={imageUploading ? "Uploading image..." : "Type a message..."}
            disabled={imageUploading}
            className="flex-1 px-4 py-2 bg-surface border border-border rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all disabled:opacity-50"
          />
          
          <button
            type="submit"
            disabled={!inputMessage.trim() || loading || imageUploading}
            className="p-2 bg-accent text-white rounded-full hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
          </button>
        </div>
      </form>
    </div>
  );
}
