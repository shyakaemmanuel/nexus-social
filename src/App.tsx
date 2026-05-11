import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation, useNavigate, Outlet } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NotificationProvider, useNotifications } from './context/NotificationContext';
import { ThemeProvider } from './context/ThemeContext';
import { ChatProvider, useChat } from './context/ChatContext';
import { Home, MessageCircle, Users, User, LogIn, WifiOff, BarChart2, Video, Bell, Search as SearchIcon, Play, Settings as SettingsIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ErrorBoundary } from './components/ErrorBoundary';
import { NotificationToast } from './components/NotificationToast';
import { Tooltip } from './components/Tooltip';
import { deleteExpiredStories } from './lib/storyCleanup';

// Lazy load screens
const Feed = React.lazy(() => import('./screens/Feed'));
const Chat = React.lazy(() => import('./screens/Chat'));
const Groups = React.lazy(() => import('./screens/Groups'));
const Profile = React.lazy(() => import('./screens/Profile'));
const Search = React.lazy(() => import('./screens/Search'));
const Stats = React.lazy(() => import('./screens/Stats'));
const Meetings = React.lazy(() => import('./screens/Meetings'));
const MeetingRoom = React.lazy(() => import('./screens/MeetingRoom'));
const Reels = React.lazy(() => import('./screens/Reels'));
const Login = React.lazy(() => import('./screens/Login'));
const FollowList = React.lazy(() => import('./screens/FollowList'));
const Settings = React.lazy(() => import('./screens/Settings'));
const CreateStory = React.lazy(() => import('./screens/CreateStory'));

const OfflineOverlay = () => {
  const { isOnline } = useAuth();
  if (isOnline) return null;

  return (
    <div className="fixed inset-0 z-[9999] bg-black/80 backdrop-blur-sm flex flex-col items-center justify-center text-white p-6 text-center">
      <WifiOff size={64} className="mb-4 text-red-500" />
      <h1 className="text-2xl font-bold mb-2">No Internet Connection</h1>
      <p className="text-gray-300">Nexus Social requires an active internet connection to function. Please check your network settings.</p>
    </div>
  );
};

const BottomNav = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { unreadCount: notificationCount } = useNotifications();
  const { chats } = useChat();
  const { user } = useAuth();

  // Hide bottom nav on create story page
  if (location.pathname === '/create-story') return null;

  // Calculate unread chat count
  const unreadChatCount = user ? chats.reduce((acc, chat) => acc + (chat.unreadCount?.[user.uid] || 0), 0) : 0;

  const navItems = [
    { path: '/', icon: Home, label: 'Feed' },
    { path: '/reels', icon: Play, label: 'Reels' },
    { path: '/search', icon: SearchIcon, label: 'Search' },
    { path: '/chats', icon: MessageCircle, label: 'Chats', badge: unreadChatCount },
    { path: '/groups', icon: Users, label: 'Groups' },
    { path: '/meetings', icon: Video, label: 'Meet' },
    { path: '/profile', icon: User, label: 'Profile', badge: notificationCount },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-xl border border-border h-16 flex items-center justify-around px-6 z-50 transition-all duration-300 rounded-[2rem] shadow-2xl shadow-zinc-500/20 dark:shadow-none w-[95%] max-w-2xl">
      {navItems.map(({ path, icon: Icon, label, badge }) => {
        const isActive = location.pathname === path || (path !== '/' && location.pathname.startsWith(path));
        return (
          <Tooltip key={path} content={label} position="top" delay={300}>
            <button
              onClick={() => navigate(path)}
              className={`relative flex flex-col items-center justify-center transition-all duration-300 group ${
                isActive ? 'text-accent' : 'text-secondary hover:text-primary'
              }`}
            >
              <div className={`p-2 rounded-2xl transition-all duration-300 ${isActive ? 'bg-accent/10 scale-110' : 'group-hover:bg-surface'}`}>
                <Icon size={22} strokeWidth={isActive ? 2.5 : 2} />
              </div>
              {badge > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="nav-indicator"
                  className="absolute -bottom-1 w-1 h-1 bg-accent rounded-full shadow-[0_0_8px_rgba(var(--accent-rgb),0.8)]"
                />
              )}
            </button>
          </Tooltip>
        );
      })}
    </nav>
  );
};

const ProtectedLayout = () => {
  const { firebaseUser, loading } = useAuth();

  // Only show loading for initial auth check, not for user profile loading
  if (loading && !firebaseUser) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/login" />;
  }

  return (
    <>
      <Outlet />
      <BottomNav />
    </>
  );
};

export default function App() {
  useEffect(() => {
    // Clean up expired stories in background after app loads
    setTimeout(() => {
      deleteExpiredStories().catch(console.error);
    }, 3000); // Delay to not block initial load
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <NotificationProvider>
          <ChatProvider>
            <ErrorBoundary>
              <Router>
              <div className="min-h-screen bg-surface pb-24 transition-colors duration-300">
                <OfflineOverlay />
                <NotificationToast />
                <React.Suspense fallback={
                  <div className="flex items-center justify-center h-screen bg-background">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-8 h-8 border-4 border-accent border-t-transparent rounded-full"
                    />
                  </div>
                }>
                  <Routes>
                    <Route path="/login" element={<Login />} />
                    <Route element={<ProtectedLayout />}>
                      <Route path="/" element={<Feed />} />
                      <Route path="/create-story" element={<CreateStory />} />
                      <Route path="/search" element={<Search />} />
                      <Route path="/chats" element={<Chat />} />
                      <Route path="/chats/:chatId" element={<Chat />} />
                      <Route path="/groups" element={<Groups />} />
                      <Route path="/meetings" element={<Meetings />} />
                      <Route path="/meetings/:meetingId" element={<MeetingRoom />} />
                      <Route path="/reels" element={<Reels />} />
                      <Route path="/stats" element={<Stats />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/profile/:uid" element={<Profile />} />
                      <Route path="/profile/:uid/followers" element={<FollowList type="followers" />} />
                      <Route path="/profile/:uid/following" element={<FollowList type="following" />} />
                      <Route path="/settings" element={<Settings />} />
                    </Route>
                  </Routes>
                </React.Suspense>
              </div>
              </Router>
            </ErrorBoundary>
          </ChatProvider>
        </NotificationProvider>
      </ThemeProvider>
    </AuthProvider>
  );
}
