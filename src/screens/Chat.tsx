import React, { useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion } from 'motion/react';
import ChatList from '../components/ChatList';
import ChatWindow from '../components/ChatWindow';
import { useChat } from '../context/ChatContext';
import { useAuth } from '../context/AuthContext';
import { ArrowLeft, MessageSquare } from 'lucide-react';

export default function Chat() {
  const { activeChat, setActiveChatById } = useChat();
  const { user } = useAuth();
  const navigate = useNavigate();
  const { chatId } = useParams<{ chatId: string }>();

  // Load chat from URL on mount
  useEffect(() => {
    // Validate chatId before attempting to load
    if (chatId && typeof chatId === 'string' && chatId.trim() !== '' && user) {
      setActiveChatById(chatId.trim()).catch((err) => {
        console.error('Failed to load chat:', err);
        // Chat not found or access denied
        navigate('/chats', { replace: true });
      });
    }
  }, [chatId, user, setActiveChatById, navigate]);

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center px-4">
          <div className="w-20 h-20 rounded-full bg-surface/50 flex items-center justify-center mb-4 mx-auto">
            <MessageSquare size={40} className="text-secondary" />
          </div>
          <h2 className="text-xl font-semibold mb-2">Sign in to chat</h2>
          <p className="text-secondary mb-4">You need to be logged in to access messages</p>
          <button
            onClick={() => navigate('/login')}
            className="px-6 py-2 bg-accent text-white rounded-full font-medium hover:bg-accent/90 transition-all"
          >
            Sign In
          </button>
        </div>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="h-[calc(100vh-6rem)] flex flex-col bg-background"
    >
      {/* Mobile Header */}
      <div className="lg:hidden flex items-center justify-between p-4 border-b border-border bg-background">
        {activeChat ? (
          <button
            onClick={() => navigate('/chats')}
            className="flex items-center space-x-2 text-secondary hover:text-primary transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back</span>
          </button>
        ) : (
          <div className="w-20" />
        )}
        <h1 className="font-semibold">Messages</h1>
        <div className="w-20" />
      </div>

      {/* Chat Layout */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat List - Hidden on mobile when chat is active */}
        <div className={`${activeChat ? 'hidden lg:flex' : 'flex'} w-full lg:w-80 flex-shrink-0 border-r border-border`}>
          <ChatList />
        </div>

        {/* Chat Window */}
        <div className={`${activeChat ? 'flex' : 'hidden lg:flex'} flex-1`}>
          <ChatWindow />
        </div>
      </div>
    </motion.div>
  );
}
