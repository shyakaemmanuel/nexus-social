import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, getDoc, where } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { useFirestoreListener } from '../lib/firestoreListenerManager';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { Message, Chat, User } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { ChevronLeft, Send, Image as ImageIcon, MoreVertical, Phone, Video, Play, Check, CheckCheck, X, PhoneCall, ShieldAlert } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { VideoPlayer } from '../components/VideoPlayer';
import { ChatVideoCall } from '../components/ChatVideoCall';
import { createMeeting, startMeeting, sendMeetingInvitation, logCall } from '../lib/meetings';

export default function ChatRoom() {
  const { chatId } = useParams<{ chatId: string }>();
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const { addListener, removeListener } = useFirestoreListener();
  const [messages, setMessages] = useState<Message[]>([]);
  const [chat, setChat] = useState<Chat | null>(null);
  const [otherUser, setOtherUser] = useState<User | null>(null);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [isInitiator, setIsInitiator] = useState(false);
  const [currentCallId, setCurrentCallId] = useState<string | null>(null);
  const [incomingCall, setIncomingCall] = useState<{ from: string, fromName: string, callId: string } | null>(null);
  const [isBlockedByOther, setIsBlockedByOther] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!chatId || !user) return;

    // Fetch chat metadata
    getDoc(doc(db, 'chats', chatId)).then(docSnap => {
      if (docSnap.exists()) {
        const chatData = docSnap.data() as Chat;
        setChat(chatData);
        
        if (chatData.type === 'direct') {
          const otherId = chatData.participants.find(id => id !== user.uid);
          if (otherId) {
            getDoc(doc(db, 'users', otherId)).then(uSnap => {
              if (uSnap.exists()) setOtherUser(uSnap.data() as User);
            }).catch(err => handleFirestoreError(err, OperationType.GET, `users/${otherId}`));
          }
        }
      }
    }).catch(err => handleFirestoreError(err, OperationType.GET, `chats/${chatId}`));

    // Listen to messages
    const q = query(
      collection(db, 'chats', chatId, 'messages'),
      orderBy('createdAt', 'asc')
    );

    addListener({
      id: 'ChatRoom-messages',
      query: q,
      context: 'ChatRoom-messages',
      onNext: (snapshot) => {
        const msgs = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Message[];
        setMessages(msgs);
        setLoading(false);
        setTimeout(() => scrollRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      },
      onError: (error) => {
        handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/messages`);
      }
    });

    return () => removeListener('ChatRoom-messages');
  }, [chatId, user, addListener, removeListener]);

  useEffect(() => {
    if (!chatId || !user) return;

    // Listen for incoming call signals
    const q = query(
      collection(db, 'chats', chatId, 'signaling'),
      where('type', '==', 'call-init'),
      where('to', '==', user.uid),
      where('timestamp', '>', new Date(Date.now() - 30000)) // Only last 30 seconds
    );

    addListener({
      id: 'ChatRoom-signaling',
      query: q,
      context: 'ChatRoom-signaling',
      onNext: (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const signal = change.doc.data();
          setIncomingCall({ 
            from: signal.from, 
            fromName: signal.fromName,
            callId: signal.callId
          });
        }
      });
    },
    onError: (error) => {
      handleFirestoreError(error, OperationType.LIST, `chats/${chatId}/signaling`);
    }
    });

    return () => removeListener('ChatRoom-signaling');
  }, [chatId, user, addListener, removeListener]);

  useEffect(() => {
    if (!chatId || !user || messages.length === 0) return;

    const unreadMessages = messages.filter(msg => 
      msg.senderUid !== user.uid && !msg.read
    );

    if (unreadMessages.length > 0) {
      unreadMessages.forEach(msg => {
        const path = `chats/${chatId}/messages/${msg.id}`;
        updateDoc(doc(db, 'chats', chatId, 'messages', msg.id), {
          read: true,
          readAt: serverTimestamp()
        }).catch(err => handleFirestoreError(err, OperationType.UPDATE, path));
      });
    }
  }, [messages, chatId, user]);

  useEffect(() => {
    if (!user || !otherUser) return;
    
    // Check if other user has blocked current user
    const checkBlocked = async () => {
      const path = `users/${otherUser.uid}/blockedUsers/${user.uid}`;
      try {
        const blockedSnap = await getDoc(doc(db, 'users', otherUser.uid, 'blockedUsers', user.uid));
        setIsBlockedByOther(blockedSnap.exists());
      } catch (error) {
        handleFirestoreError(error, OperationType.GET, path);
      }
    };
    
    checkBlocked();
  }, [user, otherUser]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!newMessage.trim() || !chatId || !user) return;

    const text = newMessage;
    setNewMessage('');

    try {
      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderUid: user.uid,
        content: text,
        mediaType: 'text',
        read: false,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: text,
        lastMessageAt: serverTimestamp()
      });

      // Send notifications to other participants
      if (chat) {
        const recipients = chat.participants.filter(id => id !== user.uid);
        await Promise.all(recipients.map(recipientId => 
          sendNotification(
            recipientId,
            'message',
            chat.type === 'group' ? `New message in ${chat.name}` : `New message from ${user.displayName}`,
            text,
            { chatId, senderUid: user.uid }
          )
        ));
      }
    } catch (error) {
      // Error sending message
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !chatId || !user) return;

    const isVideo = file.type.startsWith('video');
    setUploading(true);
    try {
      const url = await uploadMediaToCloudinary(file, `chats/${chatId}`);

      await addDoc(collection(db, 'chats', chatId, 'messages'), {
        chatId,
        senderUid: user.uid,
        content: isVideo ? 'Sent a video' : 'Sent an image',
        mediaUrl: url,
        mediaType: isVideo ? 'video' : 'image',
        read: false,
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'chats', chatId), {
        lastMessage: isVideo ? '🎥 Video' : '📷 Photo',
        lastMessageAt: serverTimestamp()
      });

      // Send notifications to other participants
      if (chat) {
        const recipients = chat.participants.filter(id => id !== user.uid);
        const content = isVideo ? 'Sent a video' : 'Sent a photo';
        await Promise.all(recipients.map(recipientId => 
          sendNotification(
            recipientId,
            'message',
            chat.type === 'group' ? `New message in ${chat.name}` : `New message from ${user.displayName}`,
            content,
            { chatId, senderUid: user.uid }
          )
        ));
      }
    } catch (error) {
      // Error uploading file
    } finally {
      setUploading(false);
    }
  };

  const startCall = async (callType: 'audio' | 'video' = 'video') => {
    if (!chatId || !user || !otherUser) return;

    try {
      // Create a new meeting
      const meetingId = await createMeeting(
        user.uid,
        callType,
        [user.uid, otherUser.uid],
        chatId
      );

      // Start the meeting
      await startMeeting(meetingId);

      // Log the call
      await logCall(user.uid, otherUser.uid, meetingId, callType, 'accepted');

      // Send meeting invitation
      await sendMeetingInvitation(meetingId, user.uid, otherUser.uid);

      // Navigate to meeting room
      navigate(`/meeting/${meetingId}`);
    } catch (error) {
      console.error('Error starting call:', error);
      handleFirestoreError(error, OperationType.CREATE, 'meetings');
    }
  };

  const acceptCall = () => {
    if (!incomingCall) return;
    setCurrentCallId(incomingCall.callId);
    setIncomingCall(null);
    setIsInitiator(false);
    setIsCallActive(true);
  };

  const rejectCall = async () => {
    if (!chatId || !user || !incomingCall) return;
    
    await addDoc(collection(db, 'chats', chatId, 'signaling'), {
      type: 'leave',
      from: user.uid,
      to: incomingCall.from,
      callId: incomingCall.callId,
      timestamp: serverTimestamp()
    });
    setIncomingCall(null);
  };

  const chatName = chat?.type === 'group' ? chat.name : otherUser?.displayName || 'Chat';
  const photo = chat?.type === 'group' ? `https://ui-avatars.com/api/?name=${chat.name}&background=random` : otherUser?.photoURL || `https://ui-avatars.com/api/?name=${chatName}&background=random`;

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'online': return 'bg-green-500';
      case 'away': return 'bg-yellow-500';
      case 'busy': return 'bg-red-500';
      default: return 'bg-zinc-400';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background max-w-2xl mx-auto border-x border-border relative overflow-hidden shadow-2xl shadow-zinc-200/50 dark:shadow-none">
      {/* Header */}
      <div className="bg-background/80 backdrop-blur-xl border-b border-border p-6 flex items-center justify-between sticky top-0 z-20">
        <div className="flex items-center space-x-4">
          <button onClick={() => navigate('/chats')} className="p-2.5 hover:bg-surface rounded-2xl transition-all active:scale-90">
            <ChevronLeft size={24} />
          </button>
          <div className="relative group cursor-pointer" onClick={() => navigate(`/profile/${otherUser?.uid}`)}>
            <div className="absolute -inset-1 bg-gradient-to-tr from-accent to-purple-500 rounded-full opacity-0 group-hover:opacity-100 transition-opacity blur-[2px]" />
            <img src={photo} alt={chatName} className="relative w-12 h-12 rounded-full object-cover border-2 border-background shadow-sm" />
            {chat?.type === 'direct' && (
              <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full border-4 border-background ${getStatusColor(otherUser?.status)}`} />
            )}
          </div>
          <div>
            <h2 className="font-black text-sm tracking-tight">{chatName}</h2>
            <p className={`text-[10px] font-black uppercase tracking-widest ${otherUser?.status === 'online' ? 'text-accent' : 'text-secondary'}`}>
              {chat?.type === 'group' ? 'Group Chat' : (otherUser?.status || 'Offline')}
            </p>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button 
            onClick={() => startCall('video')}
            className="p-3 text-secondary hover:text-accent hover:bg-accent/5 rounded-2xl transition-all"
          >
            <Video size={20} />
          </button>
          <button 
            onClick={() => startCall('audio')}
            className="p-3 text-secondary hover:text-accent hover:bg-accent/5 rounded-2xl transition-all"
          >
            <Phone size={20} />
          </button>
          <button className="p-3 text-secondary hover:text-primary hover:bg-surface rounded-2xl transition-all">
            <MoreVertical size={20} />
          </button>
        </div>
      </div>

      {/* Messages Area */}
      <div className="flex-1 overflow-y-auto p-6 space-y-8 no-scrollbar bg-surface/5">
        {messages.map((msg, idx) => {
          const isMe = msg.senderUid === user?.uid;
          const showDate = idx === 0 || (msg.createdAt && messages[idx-1].createdAt && 
            format(msg.createdAt.toDate(), 'yyyy-MM-dd') !== format(messages[idx-1].createdAt.toDate(), 'yyyy-MM-dd'));

          return (
            <React.Fragment key={msg.id}>
              {showDate && msg.createdAt && (
                <div className="flex justify-center my-8">
                  <span className="bg-background border border-border px-4 py-1.5 rounded-full text-[10px] font-black text-secondary uppercase tracking-[0.2em] shadow-sm">
                    {format(msg.createdAt.toDate(), 'MMMM d, yyyy')}
                  </span>
                </div>
              )}
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-[2rem] px-6 py-4 shadow-sm relative group ${
                    isMe 
                      ? 'bg-accent text-white rounded-tr-none shadow-lg shadow-accent/20' 
                      : 'bg-background text-primary rounded-tl-none border border-border shadow-zinc-200/50'
                  }`}
                >
                  {msg.mediaUrl && (
                    <div className="mb-3 overflow-hidden rounded-2xl shadow-inner">
                      {msg.mediaType === 'video' ? (
                        <VideoPlayer src={msg.mediaUrl} className="w-full aspect-video" />
                      ) : msg.mediaType === 'reel' ? (
                        <div 
                          className="relative aspect-[9/16] w-56 bg-black cursor-pointer group/reel"
                          onClick={() => navigate(`/reels?id=${msg.reelId}`)}
                        >
                          <video src={msg.mediaUrl} className="w-full h-full object-cover opacity-80 group-hover/reel:opacity-100 transition-opacity" />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="p-4 bg-white/20 backdrop-blur-md rounded-full text-white shadow-xl">
                              <Play size={24} fill="currentColor" />
                            </div>
                          </div>
                          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/80 to-transparent">
                            <p className="text-[10px] text-white font-black uppercase tracking-widest">Watch Reel</p>
                          </div>
                        </div>
                      ) : (
                        <img
                          src={msg.mediaUrl}
                          alt="Shared"
                          className="w-full h-auto cursor-pointer hover:opacity-90 transition-opacity"
                          referrerPolicy="no-referrer"
                        />
                      )}
                    </div>
                  )}
                  <p className="text-sm leading-relaxed font-medium">{msg.content}</p>
                  <div className={`text-[9px] mt-2 flex justify-end items-center space-x-1.5 ${isMe ? 'text-white/70' : 'text-secondary'}`}>
                    <span className="font-bold">{msg.createdAt ? format(msg.createdAt.toDate(), 'HH:mm') : '...'}</span>
                    {isMe && (
                      msg.read 
                        ? <CheckCheck size={12} className="text-white" /> 
                        : <Check size={12} className="text-white/50" />
                    )}
                  </div>
                </div>
              </motion.div>
            </React.Fragment>
          );
        })}
        <div ref={scrollRef} />
      </div>

      {/* Input Area */}
      <div className="bg-background/80 backdrop-blur-xl p-6 border-t border-border sticky bottom-0 z-20">
        {isBlockedByOther ? (
          <div className="flex items-center justify-center py-4 px-6 bg-red-50 rounded-2xl border border-red-100 shadow-inner">
            <ShieldAlert size={18} className="text-red-500 mr-3" />
            <p className="text-red-600 text-[10px] font-black uppercase tracking-[0.2em]">Communication Restricted</p>
          </div>
        ) : (
          <form onSubmit={handleSend} className="flex items-center space-x-4">
            <label className="p-3 bg-surface border border-border text-secondary hover:text-accent hover:border-accent rounded-2xl cursor-pointer transition-all active:scale-90">
              <ImageIcon size={22} />
              <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileUpload} disabled={uploading} />
            </label>
            <div className="flex-1 relative">
              <input
                type="text"
                placeholder="Message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                className="w-full bg-surface border border-border rounded-[1.5rem] px-6 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all shadow-inner"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center space-x-2">
                <button type="button" className="text-xl hover:scale-110 transition-transform">😊</button>
              </div>
            </div>
            <button
              type="submit"
              disabled={!newMessage.trim() || uploading}
              className="p-4 bg-accent text-white rounded-2xl shadow-lg shadow-accent/20 hover:bg-accent/90 transition-all disabled:opacity-50 active:scale-90 flex items-center justify-center"
            >
              <Send size={22} />
            </button>
          </form>
        )}
      </div>

      {/* Video Call Overlay */}
      <AnimatePresence>
        {isCallActive && chatId && user && currentCallId && (
          <ChatVideoCall
            chatId={chatId}
            callId={currentCallId}
            currentUser={user}
            otherUser={otherUser}
            isInitiator={isInitiator}
            onClose={() => {
              setIsCallActive(false);
              setCurrentCallId(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* Incoming Call Overlay */}
      <AnimatePresence>
        {incomingCall && (
          <motion.div
            initial={{ y: -100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -100, opacity: 0 }}
            className="absolute top-4 left-4 right-4 bg-zinc-900 border border-white/10 rounded-2xl p-4 shadow-2xl z-50 flex items-center justify-between"
          >
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-accent/20 rounded-full flex items-center justify-center text-accent">
                <PhoneCall size={24} className="animate-bounce" />
              </div>
              <div>
                <p className="text-white text-sm font-bold">{incomingCall.fromName}</p>
                <p className="text-zinc-400 text-[10px]">Incoming video call...</p>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button 
                onClick={rejectCall}
                className="p-3 bg-red-500 hover:bg-red-600 text-white rounded-xl transition-colors"
              >
                <X size={20} />
              </button>
              <button 
                onClick={acceptCall}
                className="p-3 bg-green-500 hover:bg-green-600 text-white rounded-xl transition-colors"
              >
                <Video size={20} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
