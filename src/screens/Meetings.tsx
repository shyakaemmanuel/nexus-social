import React, { useEffect, useState, useRef, useCallback } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, deleteDoc, where, limit, getDocs, writeBatch, increment, arrayUnion, arrayRemove } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Meeting, MeetingParticipant, Recording } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import {
  Video, Plus, Search, Calendar, Users, X, Play, Trash2, UserPlus,
  Mic, MicOff, Video as VideoIcon, VideoOff, Monitor, Hand, Smile,
  MessageSquare, PhoneOff, Clock, Globe, Lock, Mail, Crown, Shield,
  Check, ChevronDown, Filter, TrendingUp, ArrowRight, Sparkles,
  Loader2, CheckCircle2, AlertCircle, Bell, Settings, Edit3,
  Download, Headphones, Zap, Star, Bookmark, Send, Copy, Share2,
  MoreHorizontal, Eye, EyeOff, Radio, Wifi, WifiOff, Volume2,
  VolumeX, LayoutGrid, List, ChevronLeft, ChevronRight, Pause,
  SkipForward, SkipBack, RotateCcw, Maximize, Minimize,
  AlertTriangle, Info, HelpCircle, Menu, Home, Search as SearchIcon,
  MessageCircle, User, Video as VideoCam, CalendarDays, Film,
  History, Timer, Bell as BellIcon, Settings as SettingsIcon,
  LogOut, Moon, Sun, MonitorSmartphone, Phone, PhoneIncoming,
  PhoneOutgoing, PhoneMissed, PhoneForwarded, PhoneCall, BookOpen,
  Activity, Palette
} from 'lucide-react';
import { format, formatDistanceToNow, isToday, isTomorrow, isPast, differenceInSeconds, formatRelative } from 'date-fns';

// ============ TOAST NOTIFICATION ============
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info' | 'warning'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3500);
    return () => clearTimeout(timer);
  }, [onClose]);

  const config = {
    success: { bg: 'from-emerald-600/90 to-emerald-700/90', border: 'border-emerald-500/40', icon: <CheckCircle2 size={18} /> },
    error: { bg: 'from-red-600/90 to-red-700/90', border: 'border-red-500/40', icon: <AlertCircle size={18} /> },
    info: { bg: 'from-blue-600/90 to-blue-700/90', border: 'border-blue-500/40', icon: <Bell size={18} /> },
    warning: { bg: 'from-amber-600/90 to-amber-700/90', border: 'border-amber-500/40', icon: <AlertTriangle size={18} /> }
  };

  const c = config[type];

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.9 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto"
    >
      <div className={`bg-gradient-to-r ${c.bg} ${c.border} border backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3`}>
        <span className="text-white">{c.icon}</span>
        <span className="text-white text-sm font-semibold">{message}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white ml-2 transition-colors">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};

// ============ SKELETON LOADERS ============
const RoomCardSkeleton = () => (
  <div className="bg-surface/50 rounded-2xl overflow-hidden animate-pulse border border-border/30">
    <div className="h-40 bg-surface/80" />
    <div className="p-4">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-full bg-surface" />
        <div className="flex-1"><div className="h-4 bg-surface rounded w-24 mb-1" /><div className="h-3 bg-surface rounded w-16" /></div>
      </div>
      <div className="h-4 bg-surface rounded w-3/4 mb-3" />
      <div className="flex items-center justify-between">
        <div className="flex -space-x-2">
          {[1,2,3].map(i => <div key={i} className="w-7 h-7 rounded-full bg-surface border-2 border-background" />)}
        </div>
        <div className="h-8 w-20 bg-surface rounded-lg" />
      </div>
    </div>
  </div>
);

const ScheduledCardSkeleton = () => (
  <div className="bg-surface/50 rounded-2xl p-5 animate-pulse border border-border/30">
    <div className="flex items-start gap-4">
      <div className="w-14 h-14 rounded-xl bg-surface flex-shrink-0" />
      <div className="flex-1">
        <div className="h-5 bg-surface rounded w-3/4 mb-2" />
        <div className="h-3 bg-surface rounded w-1/2 mb-2" />
        <div className="h-3 bg-surface rounded w-1/3" />
      </div>
      <div className="h-9 w-24 bg-surface rounded-lg flex-shrink-0" />
    </div>
  </div>
);

// ============ LIVE PULSE INDICATOR ============
const LivePulse = () => (
  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-500/20 border border-red-500/30">
    <span className="relative flex h-2 w-2">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
      <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" />
    </span>
    <span className="text-[10px] font-bold text-red-400 uppercase tracking-wider">Live</span>
  </span>
);

// ============ CATEGORY BADGES ============
const categoryConfig: Record<string, { color: string; icon: React.ReactNode }> = {
  Gaming: { color: 'from-purple-500 to-pink-500', icon: <Zap size={12} /> },
  Music: { color: 'from-pink-500 to-rose-500', icon: <Headphones size={12} /> },
  Study: { color: 'from-blue-500 to-cyan-500', icon: <BookOpen size={12} /> },
  Talk: { color: 'from-emerald-500 to-teal-500', icon: <MessageSquare size={12} /> },
  Tech: { color: 'from-indigo-500 to-blue-500', icon: <Monitor size={12} /> },
  Social: { color: 'from-amber-500 to-orange-500', icon: <Users size={12} /> },
  Fitness: { color: 'from-green-500 to-lime-500', icon: <Activity size={12} /> },
  Art: { color: 'from-fuchsia-500 to-purple-500', icon: <Palette size={12} /> },
};

const CategoryBadge = ({ category }: { category?: string }) => {
  if (!category) return null;
  const config = categoryConfig[category] || { color: 'from-slate-500 to-gray-500', icon: <Globe size={12} /> };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${config.color} shadow-sm`}>
      {config.icon}
      {category}
    </span>
  );
};

// ============ COUNTDOWN TIMER ============
const CountdownTimer = ({ targetDate }: { targetDate: Date }) => {
  const [timeLeft, setTimeLeft] = useState('');

  useEffect(() => {
    const update = () => {
      const diff = differenceInSeconds(targetDate, new Date());
      if (diff <= 0) { setTimeLeft('Starting now'); return; }
      const h = Math.floor(diff / 3600);
      const m = Math.floor((diff % 3600) / 60);
      const s = diff % 60;
      if (h > 0) setTimeLeft(`${h}h ${m}m`);
      else if (m > 0) setTimeLeft(`${m}m ${s}s`);
      else setTimeLeft(`${s}s`);
    };
    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return <span className="font-mono text-xs text-cyan-400 font-semibold">{timeLeft}</span>;
};

// ============ GRADIENT COVERS ============
const roomGradients = [
  'from-violet-900/80 via-purple-900/60 to-indigo-900/80',
  'from-blue-900/80 via-cyan-900/60 to-teal-900/80',
  'from-emerald-900/80 via-green-900/60 to-lime-900/80',
  'from-orange-900/80 via-amber-900/60 to-yellow-900/80',
  'from-pink-900/80 via-rose-900/60 to-red-900/80',
  'from-fuchsia-900/80 via-pink-900/60 to-purple-900/80',
  'from-sky-900/80 via-blue-900/60 to-indigo-900/80',
  'from-teal-900/80 via-emerald-900/60 to-green-900/80',
];

const getRoomGradient = (id: string) => {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return roomGradients[Math.abs(hash) % roomGradients.length];
};

// ============ AVATAR STACK ============
const AvatarStack = ({ count, max = 4 }: { count: number; max?: number }) => {
  const display = Math.min(count, max);
  const remaining = count - max;
  const colors = ['bg-violet-500', 'bg-blue-500', 'bg-emerald-500', 'bg-amber-500', 'bg-pink-500'];

  return (
    <div className="flex -space-x-2">
      {Array.from({ length: display }).map((_, i) => (
        <div key={i} className={`w-7 h-7 rounded-full ${colors[i % colors.length]} border-2 border-background flex items-center justify-center text-[9px] text-white font-bold`}>
          {String.fromCharCode(65 + i)}
        </div>
      ))}
      {remaining > 0 && (
        <div className="w-7 h-7 rounded-full bg-surface border-2 border-background flex items-center justify-center text-[9px] text-secondary font-bold">
          +{remaining}
        </div>
      )}
    </div>
  );
};

// ============ LIVE ROOM CARD ============
const LiveRoomCard = ({ meeting, participants, onJoin }: {
  meeting: Meeting & { hostName?: string; hostPhoto?: string };
  participants: MeetingParticipant[];
  onJoin: () => void;
}) => {
  const gradient = getRoomGradient(meeting.id);
  const participantCount = participants.length;
  const duration = meeting.startedAt ? formatDistanceToNow(meeting.startedAt.toDate(), { addSuffix: false }) : 'Just started';

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4, scale: 1.01 }}
      transition={{ duration: 0.2 }}
      className="group relative bg-surface/40 backdrop-blur-sm border border-border/30 rounded-2xl overflow-hidden cursor-pointer hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/5 transition-all duration-300"
      onClick={onJoin}
    >
      {/* Thumbnail */}
      <div className={`relative h-40 bg-gradient-to-br ${gradient} overflow-hidden`}>
        {/* Animated background pattern */}
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-4 left-4 w-24 h-24 rounded-full bg-white/10 blur-2xl animate-pulse" />
          <div className="absolute bottom-4 right-8 w-16 h-16 rounded-full bg-white/10 blur-xl" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/5 blur-3xl" />
        </div>
        
        {/* Live badge */}
        <div className="absolute top-3 left-3">
          <LivePulse />
        </div>

        {/* Category */}
        <div className="absolute top-3 right-3">
          <CategoryBadge category={(meeting as any).category} />
        </div>

        {/* Center play icon */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="w-14 h-14 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 group-hover:bg-white/20 transition-all duration-300">
            <Play size={24} className="text-white ml-1" />
          </div>
        </div>

        {/* Bottom gradient */}
        <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Host info */}
        <div className="flex items-center gap-3 mb-3">
          <img
            src={meeting.hostPhoto || `https://ui-avatars.com/api/?name=${meeting.hostName || 'Host'}&background=random`}
            alt=""
            className="w-9 h-9 rounded-full object-cover border border-border/50"
          />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-primary truncate">{meeting.hostName || 'Host'}</p>
            <p className="text-[11px] text-secondary">{duration}</p>
          </div>
        </div>

        {/* Title */}
        <h3 className="text-base font-bold text-primary mb-3 line-clamp-1 group-hover:text-cyan-400 transition-colors">
          {meeting.title || 'Untitled Room'}
        </h3>

        {/* Footer */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AvatarStack count={participantCount} />
            <span className="text-[11px] text-secondary font-medium">{participantCount} in room</span>
          </div>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); onJoin(); }}
            className="px-4 py-2 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-cyan-500/30 transition-all flex items-center gap-1.5"
          >
            <PhoneIncoming size={14} />
            Join
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ============ SCHEDULED MEETING CARD ============
const ScheduledMeetingCard = ({ meeting, host, onJoin, onRSVP, rsvpStatus }: {
  meeting: Meeting;
  host?: { displayName?: string; photoURL?: string };
  onJoin: () => void;
  onRSVP: (status: 'going' | 'not-going' | 'maybe') => void;
  rsvpStatus: 'going' | 'not-going' | 'maybe' | null;
}) => {
  const scheduledDate = meeting.scheduledFor?.toDate();
  const isUpcoming = scheduledDate && !isPast(scheduledDate);
  const isTodayMeeting = scheduledDate && isToday(scheduledDate);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-surface/40 backdrop-blur-sm border border-border/30 rounded-2xl p-5 hover:border-purple-500/30 hover:shadow-lg hover:shadow-purple-500/5 transition-all duration-300"
    >
      <div className="flex items-start gap-4">
        {/* Date badge */}
        <div className={`w-14 h-14 rounded-xl flex flex-col items-center justify-center flex-shrink-0 ${
          isTodayMeeting ? 'bg-gradient-to-br from-purple-500 to-cyan-500' : 'bg-surface border border-border/50'
        }`}>
          <span className={`text-[10px] font-bold uppercase ${isTodayMeeting ? 'text-white/80' : 'text-secondary'}`}>
            {scheduledDate ? format(scheduledDate, 'MMM') : 'TBD'}
          </span>
          <span className={`text-lg font-black ${isTodayMeeting ? 'text-white' : 'text-primary'}`}>
            {scheduledDate ? format(scheduledDate, 'd') : '?'}
          </span>
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-sm font-bold text-primary truncate group-hover:text-purple-400 transition-colors">
              {meeting.title || 'Untitled Meeting'}
            </h3>
            {isTodayMeeting && (
              <span className="px-1.5 py-0.5 bg-purple-500/20 text-purple-400 rounded text-[9px] font-bold uppercase">Today</span>
            )}
          </div>

          <div className="flex items-center gap-3 mb-2">
            <img
              src={host?.photoURL || `https://ui-avatars.com/api/?name=${host?.displayName || 'Host'}&background=random`}
              alt=""
              className="w-5 h-5 rounded-full object-cover"
            />
            <span className="text-[11px] text-secondary">{host?.displayName || 'Host'}</span>
            {scheduledDate && (
              <>
                <span className="text-secondary">·</span>
                <span className="text-[11px] text-secondary flex items-center gap-1">
                  <Clock size={10} />
                  {format(scheduledDate, 'h:mm a')}
                </span>
              </>
            )}
          </div>

          {/* RSVP buttons */}
          <div className="flex items-center gap-2">
            {(['going', 'maybe', 'not-going'] as const).map(status => {
              const labels = { going: 'Going', maybe: 'Maybe', 'not-going': "Can't Go" };
              const colors = {
                going: rsvpStatus === 'going' ? 'bg-emerald-500 text-white' : 'bg-surface text-secondary hover:bg-emerald-500/20 hover:text-emerald-400',
                maybe: rsvpStatus === 'maybe' ? 'bg-amber-500 text-white' : 'bg-surface text-secondary hover:bg-amber-500/20 hover:text-amber-400',
                'not-going': rsvpStatus === 'not-going' ? 'bg-red-500 text-white' : 'bg-surface text-secondary hover:bg-red-500/20 hover:text-red-400'
              };
              return (
                <button
                  key={status}
                  onClick={() => onRSVP(status)}
                  className={`px-3 py-1 rounded-lg text-[10px] font-semibold transition-all ${colors[status]}`}
                >
                  {labels[status]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Join button */}
        {isUpcoming && (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onJoin}
            className="px-4 py-2 bg-gradient-to-r from-purple-500 to-cyan-500 text-white rounded-lg text-xs font-bold hover:shadow-lg hover:shadow-purple-500/30 transition-all flex-shrink-0"
          >
            {isPast(scheduledDate!) ? 'Join Now' : 'Preview'}
          </motion.button>
        )}
      </div>
    </motion.div>
  );
};

// ============ RECORDING CARD ============
const RecordingCard = ({ recording, meeting, onDelete }: {
  recording: Recording;
  meeting?: Meeting;
  onDelete: () => void;
}) => {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="group bg-surface/40 backdrop-blur-sm border border-border/30 rounded-2xl overflow-hidden hover:border-amber-500/30 hover:shadow-lg hover:shadow-amber-500/5 transition-all duration-300"
    >
      {/* Thumbnail */}
      <div className="relative h-36 bg-gradient-to-br from-slate-800 to-slate-900 flex items-center justify-center">
        <div className="w-12 h-12 rounded-full bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center group-hover:scale-110 transition-transform">
          <Play size={20} className="text-white ml-1" />
        </div>
        <div className="absolute bottom-2 right-2 px-2 py-0.5 bg-black/60 rounded text-[10px] text-white font-mono">
          {(recording as any).duration || '0:00'}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-bold text-primary mb-1 line-clamp-1">
          {meeting?.title || 'Recording'}
        </h3>
        <p className="text-[11px] text-secondary mb-3">
          {recording.createdAt ? formatDistanceToNow(recording.createdAt.toDate(), { addSuffix: true }) : 'Recently'}
        </p>
        <div className="flex items-center gap-2">
          <button className="flex-1 px-3 py-2 bg-surface border border-border/50 rounded-lg text-xs font-semibold text-primary hover:bg-surface/80 transition-colors flex items-center justify-center gap-1.5">
            <Play size={12} /> Play
          </button>
          <button className="px-3 py-2 bg-surface border border-border/50 rounded-lg text-secondary hover:text-primary transition-colors">
            <Download size={14} />
          </button>
          <button onClick={onDelete} className="px-3 py-2 bg-surface border border-border/50 rounded-lg text-secondary hover:text-red-400 transition-colors">
            <Trash2 size={14} />
          </button>
        </div>
      </div>
    </motion.div>
  );
};

// ============ CREATE ROOM MODAL ============
const CreateRoomModal = ({ isOpen, onClose, onSuccess, onToast }: {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (meetingId: string, scheduled: boolean) => void;
  onToast: (msg: string, type: 'success' | 'error' | 'info' | 'warning') => void;
}) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [roomType, setRoomType] = useState<'video' | 'audio' | 'screen_share'>('video');
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'invite'>('public');
  const [category, setCategory] = useState('');
  const [maxParticipants, setMaxParticipants] = useState(50);
  const [isScheduled, setIsScheduled] = useState(false);
  const [scheduledDate, setScheduledDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = ['Gaming', 'Music', 'Study', 'Talk', 'Tech', 'Social', 'Fitness', 'Art', 'Other'];

  const validate = () => {
    const errs: Record<string, string> = {};
    if (!title.trim()) errs.title = 'Room name is required';
    if (title.length > 100) errs.title = 'Name must be under 100 characters';
    if (!category) errs.category = 'Please select a category';
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleCreate = async () => {
    if (!user || !validate()) return;
    setLoading(true);
    try {
      const meetingData: any = {
        title: title.trim(),
        description: description.trim(),
        hostUid: user.uid,
        type: roomType,
        mode: isScheduled ? 'scheduled' : 'instant',
        participants: [user.uid],
        status: isScheduled ? 'scheduled' : 'active',
        recordingEnabled: true,
        category,
        privacy,
        maxParticipants,
        createdAt: serverTimestamp()
      };

      if (isScheduled && scheduledDate && scheduledTime) {
        meetingData.scheduledFor = new Date(`${scheduledDate}T${scheduledTime}`);
      }

      const docRef = await addDoc(collection(db, 'meetings'), meetingData);

      // Add host as participant
      await addDoc(collection(db, 'meetings', docRef.id, 'participants'), {
        userId: user.uid,
        meetingId: docRef.id,
        joinedAt: serverTimestamp(),
        isMuted: false,
        isVideoOff: roomType === 'audio',
        isScreenSharing: false,
        role: 'host'
      });

      onSuccess(docRef.id, isScheduled);
      onClose();
      setStep(1);
      setTitle('');
      setDescription('');
      setRoomType('video');
      setPrivacy('public');
      setCategory('');
      setMaxParticipants(50);
      setIsScheduled(false);
      setScheduledDate('');
      setScheduledTime('');
      setErrors({});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'meetings');
      onToast('Failed to create room', 'error');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          className="bg-background w-full max-w-lg rounded-3xl overflow-hidden shadow-2xl border border-border/50 max-h-[90vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="p-6 border-b border-border/50">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-primary flex items-center gap-2">
                <Sparkles size={20} className="text-cyan-400" />
                Create Room
              </h2>
              <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors text-secondary">
                <X size={20} />
              </button>
            </div>
            {/* Progress */}
            <div className="flex items-center gap-2">
              {[1, 2, 3].map(s => (
                <div key={s} className="flex-1 h-1.5 rounded-full transition-all duration-300 bg-surface overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-cyan-500 to-purple-500 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: s <= step ? '100%' : '0%' }}
                    transition={{ duration: 0.3 }}
                  />
                </div>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div key="s1" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Room Name *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={e => setTitle(e.target.value)}
                      placeholder="e.g. Late Night Gaming Session"
                      className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all ${errors.title ? 'border-red-500' : 'border-border/50'}`}
                    />
                    {errors.title && <p className="text-red-400 text-xs mt-1">{errors.title}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="What's this room about?"
                      className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all resize-none h-20"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Category *</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button key={cat} onClick={() => setCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${category === cat ? 'bg-gradient-to-r from-cyan-500 to-purple-500 text-white' : 'bg-surface border border-border/50 text-secondary hover:border-cyan-500/50'}`}>
                          {cat}
                        </button>
                      ))}
                    </div>
                    {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category}</p>}
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div key="s2" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-3">Room Type</label>
                    <div className="grid grid-cols-3 gap-3">
                      {[
                        { value: 'video', icon: <Video size={20} />, label: 'Video' },
                        { value: 'audio', icon: <Headphones size={20} />, label: 'Audio' },
                        { value: 'screen_share', icon: <Monitor size={20} />, label: 'Screen' }
                      ].map(t => (
                        <button key={t.value} onClick={() => setRoomType(t.value as any)}
                          className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${roomType === t.value ? 'border-cyan-500 bg-cyan-500/10 text-cyan-400' : 'border-border/50 bg-surface text-secondary hover:border-cyan-500/30'}`}>
                          {t.icon}
                          <span className="text-xs font-semibold">{t.label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-3">Privacy</label>
                    <div className="space-y-2">
                      {[
                        { value: 'public', icon: <Globe size={16} />, label: 'Public', desc: 'Anyone can join' },
                        { value: 'private', icon: <Lock size={16} />, label: 'Private', desc: 'Link only' },
                        { value: 'invite', icon: <Mail size={16} />, label: 'Invite Only', desc: 'Approval required' }
                      ].map(p => (
                        <button key={p.value} onClick={() => setPrivacy(p.value as any)}
                          className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left ${privacy === p.value ? 'border-cyan-500 bg-cyan-500/10' : 'border-border/50 bg-surface hover:border-cyan-500/30'}`}>
                          <span className={privacy === p.value ? 'text-cyan-400' : 'text-secondary'}>{p.icon}</span>
                          <div className="flex-1">
                            <p className={`text-sm font-semibold ${privacy === p.value ? 'text-cyan-400' : 'text-primary'}`}>{p.label}</p>
                            <p className="text-[11px] text-secondary">{p.desc}</p>
                          </div>
                          {privacy === p.value && <Check size={16} className="text-cyan-400" />}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">
                      Max Participants: <span className="text-cyan-400">{maxParticipants}</span>
                    </label>
                    <input type="range" min="5" max="500" step="5" value={maxParticipants}
                      onChange={e => setMaxParticipants(Number(e.target.value))}
                      className="w-full accent-cyan-500" />
                    <div className="flex justify-between text-[10px] text-secondary mt-1">
                      <span>5</span><span>500</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div key="s3" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="space-y-4">
                  <div className="bg-surface rounded-2xl p-5 border border-border/50">
                    <h3 className="font-bold text-primary mb-3 flex items-center gap-2"><Eye size={16} className="text-cyan-400" /> Preview</h3>
                    <div className="space-y-2 text-sm">
                      {[
                        ['Name', title],
                        ['Category', category],
                        ['Type', roomType.replace('_', ' ')],
                        ['Privacy', privacy],
                        ['Max Participants', String(maxParticipants)]
                      ].map(([label, value]) => (
                        <div key={label} className="flex justify-between">
                          <span className="text-secondary">{label}</span>
                          <span className="text-primary font-medium capitalize">{value}</span>
                        </div>
                      ))}
                      {description && (
                        <div><span className="text-secondary block mb-1">Description</span><p className="text-primary text-xs">{description}</p></div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-3 p-4 bg-surface rounded-xl border border-border/50">
                    <button type="button" onClick={() => setIsScheduled(!isScheduled)}
                      className={`w-10 h-6 rounded-full transition-all relative flex-shrink-0 ${isScheduled ? 'bg-cyan-500' : 'bg-surface border border-border'}`}>
                      <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all shadow ${isScheduled ? 'right-0.5' : 'left-0.5'}`} />
                    </button>
                    <div>
                      <p className="text-sm font-semibold text-primary">Schedule for later</p>
                      <p className="text-[11px] text-secondary">Set a date and time</p>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isScheduled && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="space-y-3 overflow-hidden">
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase mb-1 block">Date</label>
                            <input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)}
                              className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-cyan-500" />
                          </div>
                          <div>
                            <label className="text-[10px] font-bold text-secondary uppercase mb-1 block">Time</label>
                            <input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)}
                              className="w-full bg-surface border border-border/50 rounded-xl px-3 py-2.5 text-sm text-primary focus:outline-none focus:border-cyan-500" />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border/50 flex gap-3">
            {step > 1 && (
              <button onClick={() => setStep(s => s - 1)} className="flex-1 py-3 border border-border rounded-xl font-semibold text-secondary hover:bg-surface transition-colors">
                Back
              </button>
            )}
            {step < 3 ? (
              <button onClick={() => { if (validate()) setStep(s => s + 1); }} className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all">
                Continue
              </button>
            ) : (
              <button onClick={handleCreate} disabled={loading || !title.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2">
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {loading ? 'Creating...' : isScheduled ? 'Schedule Room' : 'Start Room'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============ MAIN MEETINGS PAGE ============
export default function Meetings() {
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState<'active' | 'scheduled' | 'recordings'>('active');
  const [meetings, setMeetings] = useState<(Meeting & { hostName?: string; hostPhoto?: string })[]>([]);
  const [scheduledMeetings, setScheduledMeetings] = useState<Meeting[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [participants, setParticipants] = useState<Record<string, MeetingParticipant[]>>({});
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' | 'warning' } | null>(null);
  const [rsvps, setRsvps] = useState<Record<string, 'going' | 'not-going' | 'maybe'>>({});

  const showToast = useCallback((message: string, type: 'success' | 'error' | 'info' | 'warning') => {
    setToast({ message, type });
  }, []);

  // Fetch active meetings
  useEffect(() => {
    const q = query(collection(db, 'meetings'), where('status', '==', 'active'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, async (snapshot) => {
      const meetingsData = await Promise.all(snapshot.docs.map(async docSnap => {
        const data = { id: docSnap.id, ...docSnap.data() } as Meeting & { hostName?: string; hostPhoto?: string };
        // Fetch host info
        try {
          const hostSnap = await getDocs(query(collection(db, 'users'), where('__name__', '==', data.hostUid)));
          if (!hostSnap.empty) {
            const host = hostSnap.docs[0].data();
            data.hostName = host.displayName;
            data.hostPhoto = host.photoURL;
          }
        } catch {}
        return data;
      }));
      setMeetings(meetingsData);
      setLoading(false);
    });
    return () => unsub();
  }, []);

  // Fetch participants for each active meeting
  useEffect(() => {
    const unsubscribers: (() => void)[] = [];
    meetings.forEach(meeting => {
      const unsub = onSnapshot(collection(db, 'meetings', meeting.id, 'participants'), (snap) => {
        setParticipants(prev => ({
          ...prev,
          [meeting.id]: snap.docs.map(d => ({ uid: d.id, ...d.data() } as unknown as MeetingParticipant))
        }));
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach(u => u());
  }, [meetings.map(m => m.id).join(',')]);

  // Fetch scheduled meetings
  useEffect(() => {
    const q = query(collection(db, 'meetings'), where('status', '==', 'scheduled'), orderBy('scheduledFor', 'asc'), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      setScheduledMeetings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Meeting)));
    });
    return () => unsub();
  }, []);

  // Fetch recordings
  useEffect(() => {
    const q = query(collection(db, 'recordings'), orderBy('createdAt', 'desc'), limit(20));
    const unsub = onSnapshot(q, (snapshot) => {
      setRecordings(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Recording)));
    });
    return () => unsub();
  }, []);

  const handleJoinMeeting = (meetingId: string) => {
    navigate(`/meetings/${meetingId}`);
  };

  const handleRSVP = (meetingId: string, status: 'going' | 'not-going' | 'maybe') => {
    setRsvps(prev => ({ ...prev, [meetingId]: status }));
    showToast(`RSVP updated: ${status}`, 'success');
  };

  const handleDeleteRecording = async (recordingId: string) => {
    try {
      await deleteDoc(doc(db, 'recordings', recordingId));
      showToast('Recording deleted', 'info');
    } catch {
      showToast('Failed to delete recording', 'error');
    }
  };

  const handleCreateSuccess = (meetingId: string, scheduled: boolean) => {
    showToast('Room created successfully!', 'success');
    if (!scheduled) {
      setTimeout(() => navigate(`/meetings/${meetingId}`), 500);
    }
  };

  const filteredMeetings = meetings.filter(m => {
    const matchesSearch = m.title?.toLowerCase().includes(searchQuery.toLowerCase()) || m.hostName?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = filterType === 'all' || (m as any).type === filterType;
    return matchesSearch && matchesType;
  });

  const filteredScheduled = scheduledMeetings.filter(m => {
    const matchesSearch = m.title?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesSearch;
  });

  const tabs = [
    { id: 'active' as const, label: 'Active Now', icon: <Radio size={16} />, count: meetings.length },
    { id: 'scheduled' as const, label: 'Scheduled', icon: <Calendar size={16} />, count: scheduledMeetings.length },
    { id: 'recordings' as const, label: 'Recordings', icon: <Film size={16} />, count: recordings.length },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-24">
      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight flex items-center gap-2">
            <span className="bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent">Meetings</span>
          </h1>
          <p className="text-sm text-secondary mt-1">Connect in real-time rooms</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Create Room</span>
        </motion.button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
          <input
            type="text"
            placeholder="Search rooms..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-surface/50 border border-border/30 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-cyan-500/20 focus:border-cyan-500 transition-all"
          />
        </div>
        {activeTab === 'active' && (
          <div className="flex gap-2">
            {['all', 'video', 'audio', 'screen_share'].map(type => (
              <button key={type} onClick={() => setFilterType(type)}
                className={`px-3 py-2 rounded-lg text-xs font-semibold transition-all capitalize ${filterType === type ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30' : 'bg-surface/50 text-secondary border border-border/30 hover:border-cyan-500/30'}`}>
                {type === 'screen_share' ? 'Screen' : type}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-surface/30 rounded-xl p-1 border border-border/20">
        {tabs.map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id ? 'bg-surface text-primary shadow-sm' : 'text-secondary hover:text-primary'}`}>
            {tab.icon}
            <span className="hidden sm:inline">{tab.label}</span>
            {tab.count > 0 && (
              <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${activeTab === tab.id ? 'bg-cyan-500/20 text-cyan-400' : 'bg-surface text-secondary'}`}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Content */}
      {activeTab === 'active' && (
        <div>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map(i => <RoomCardSkeleton key={i} />)}
            </div>
          ) : filteredMeetings.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {filteredMeetings.map(meeting => (
                  <LiveRoomCard
                    key={meeting.id}
                    meeting={meeting}
                    participants={participants[meeting.id] || []}
                    onJoin={() => handleJoinMeeting(meeting.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="w-24 h-24 bg-surface/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border/30">
                <Radio size={40} className="text-secondary" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">No active rooms</h2>
              <p className="text-sm text-secondary mb-6 max-w-sm mx-auto">
                {searchQuery ? 'No rooms match your search.' : 'Be the first to start a room and connect with others!'}
              </p>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all inline-flex items-center gap-2">
                <Plus size={18} /> Create Room
              </motion.button>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'scheduled' && (
        <div className="space-y-3">
          {loading ? (
            <div className="space-y-3">
              {[1, 2, 3].map(i => <ScheduledCardSkeleton key={i} />)}
            </div>
          ) : filteredScheduled.length > 0 ? (
            <AnimatePresence>
              {filteredScheduled.map(meeting => (
                <ScheduledMeetingCard
                  key={meeting.id}
                  meeting={meeting}
                  onJoin={() => handleJoinMeeting(meeting.id)}
                  onRSVP={(status) => handleRSVP(meeting.id, status)}
                  rsvpStatus={rsvps[meeting.id] || null}
                />
              ))}
            </AnimatePresence>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="w-24 h-24 bg-surface/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border/30">
                <Calendar size={40} className="text-secondary" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">No scheduled meetings</h2>
              <p className="text-sm text-secondary mb-6 max-w-sm mx-auto">Schedule a room to see it here.</p>
              <motion.button whileTap={{ scale: 0.95 }} onClick={() => setIsCreateModalOpen(true)}
                className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-purple-500 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-cyan-500/30 transition-all inline-flex items-center gap-2">
                <Plus size={18} /> Schedule Room
              </motion.button>
            </motion.div>
          )}
        </div>
      )}

      {activeTab === 'recordings' && (
        <div>
          {recordings.length > 0 ? (
            <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <AnimatePresence>
                {recordings.map(recording => (
                  <RecordingCard
                    key={recording.id}
                    recording={recording}
                    onDelete={() => handleDeleteRecording(recording.id)}
                  />
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="w-24 h-24 bg-surface/50 rounded-3xl flex items-center justify-center mx-auto mb-6 border border-border/30">
                <Film size={40} className="text-secondary" />
              </div>
              <h2 className="text-xl font-bold text-primary mb-2">No recordings yet</h2>
              <p className="text-sm text-secondary">Recordings from your meetings will appear here.</p>
            </motion.div>
          )}
        </div>
      )}

      {/* Create Room Modal */}
      <CreateRoomModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
        onToast={showToast}
      />
    </div>
  );
}
