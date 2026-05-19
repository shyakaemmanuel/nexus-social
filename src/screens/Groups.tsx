import React, { useEffect, useState, useRef } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, updateDoc, increment, setDoc, deleteDoc, arrayUnion, arrayRemove, writeBatch, where, limit, getDoc, getDocs } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Group, GroupMember, User, Post } from '../types';
import { useAuth } from '../context/AuthContext';
import { useNotifications } from '../context/NotificationContext';
import { useTheme } from '../context/ThemeContext';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  Users, Plus, Search, Shield, UserPlus, UserMinus, X, MessageSquare,
  Globe, Lock, Mail, Crown, Camera, Upload, Check, ChevronLeft,
  Heart, MessageCircle, Share2, MoreHorizontal, Image as ImageIcon,
  Video, Calendar, Info, Grid, List, Filter, TrendingUp,
  Clock, MapPin, Link as LinkIcon, Hash, AlertCircle, CheckCircle2,
  Loader2, ArrowLeft, Bell, Settings, Edit3, Trash2, Eye, EyeOff,
  ChevronDown, ChevronRight, Sparkles, Zap, Star, Bookmark, Send
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

// ============ TOAST NOTIFICATION ============
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onClose, 3000);
    return () => clearTimeout(timer);
  }, [onClose]);

  const colors = {
    success: 'bg-emerald-500/90 border-emerald-400/50',
    error: 'bg-red-500/90 border-red-400/50',
    info: 'bg-blue-500/90 border-blue-400/50'
  };

  const icons = {
    success: <CheckCircle2 size={18} className="text-white" />,
    error: <AlertCircle size={18} className="text-white" />,
    info: <Bell size={18} className="text-white" />
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -50, scale: 0.9 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -50, scale: 0.9 }}
      className="fixed top-4 left-1/2 -translate-x-1/2 z-[9999] pointer-events-auto"
    >
      <div className={`${colors[type]} border backdrop-blur-xl rounded-2xl px-5 py-3 shadow-2xl flex items-center gap-3`}>
        {icons[type]}
        <span className="text-white text-sm font-semibold">{message}</span>
        <button onClick={onClose} className="text-white/70 hover:text-white ml-2">
          <X size={16} />
        </button>
      </div>
    </motion.div>
  );
};

// ============ SKELETON LOADER ============
const GroupCardSkeleton = () => (
  <div className="bg-surface/50 rounded-3xl overflow-hidden animate-pulse">
    <div className="h-32 bg-surface" />
    <div className="p-5 -mt-12">
      <div className="flex items-end gap-4 mb-4">
        <div className="w-20 h-20 rounded-2xl bg-surface border-4 border-background" />
        <div className="flex-1 pb-2">
          <div className="h-5 bg-surface rounded-lg w-3/4 mb-2" />
          <div className="h-3 bg-surface rounded w-1/2" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="h-3 bg-surface rounded w-full" />
        <div className="h-3 bg-surface rounded w-5/6" />
      </div>
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-surface" />
          <div className="w-6 h-6 rounded-full bg-surface -ml-2" />
          <div className="w-6 h-6 rounded-full bg-surface -ml-2" />
          <div className="h-3 bg-surface rounded w-16 ml-2" />
        </div>
        <div className="h-9 w-24 bg-surface rounded-xl" />
      </div>
    </div>
  </div>
);

// ============ PRIVACY BADGE ============
const PrivacyBadge = ({ privacy }: { privacy?: string }) => {
  const config = {
    public: { icon: <Globe size={12} />, label: 'Public', color: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    private: { icon: <Lock size={12} />, label: 'Private', color: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    invite: { icon: <Mail size={12} />, label: 'Invite Only', color: 'bg-amber-500/20 text-amber-400 border-amber-500/30' }
  };
  const c = config[privacy as keyof typeof config] || config.public;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${c.color}`}>
      {c.icon}
      {c.label}
    </span>
  );
};

// ============ CATEGORY CHIP ============
const CategoryChip = ({ category }: { category?: string }) => {
  if (!category) return null;
  const colors: Record<string, string> = {
    Technology: 'from-blue-500 to-cyan-500',
    Gaming: 'from-purple-500 to-pink-500',
    Music: 'from-pink-500 to-rose-500',
    Art: 'from-amber-500 to-orange-500',
    Sports: 'from-green-500 to-emerald-500',
    Education: 'from-indigo-500 to-blue-500',
    Lifestyle: 'from-teal-500 to-cyan-500',
    Food: 'from-red-500 to-orange-500',
    Travel: 'from-sky-500 to-blue-500',
    Business: 'from-slate-500 to-gray-500'
  };
  const gradient = colors[category] || 'from-gray-500 to-slate-500';
  return (
    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold text-white bg-gradient-to-r ${gradient} shadow-sm`}>
      {category}
    </span>
  );
};

// ============ GRADIENT COVER ============
const coverGradients = [
  'from-violet-600 via-purple-600 to-indigo-700',
  'from-blue-600 via-cyan-600 to-teal-700',
  'from-emerald-600 via-green-600 to-lime-700',
  'from-orange-600 via-amber-600 to-yellow-700',
  'from-pink-600 via-rose-600 to-red-700',
  'from-fuchsia-600 via-pink-600 to-purple-700',
  'from-sky-600 via-blue-600 to-indigo-700',
  'from-teal-600 via-emerald-600 to-green-700'
];

const getCoverGradient = (name: string) => {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return coverGradients[Math.abs(hash) % coverGradients.length];
};

// ============ GROUP CARD ============
const GroupCard: React.FC<{
  group: Group;
  isMember: boolean;
  onJoin: () => void;
  onLeave: () => void;
  onView: () => void;
  joining: boolean;
}> = ({ group, isMember, onJoin, onLeave, onView, joining }) => {
  const gradient = getCoverGradient(group.name);
  const initials = group.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -4 }}
      transition={{ duration: 0.2 }}
      className="group bg-surface/50 backdrop-blur-sm border border-border/50 rounded-3xl overflow-hidden cursor-pointer hover:border-accent/30 hover:shadow-xl hover:shadow-accent/5 transition-all duration-300"
      onClick={onView}
    >
      {/* Cover Image */}
      <div className={`relative h-32 bg-gradient-to-br ${gradient} overflow-hidden`}>
        {group.coverURL ? (
          <img src={group.coverURL} alt="" className="w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-4 left-4 w-20 h-20 rounded-full bg-white/10 blur-xl" />
            <div className="absolute bottom-4 right-8 w-16 h-16 rounded-full bg-white/10 blur-xl" />
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full bg-white/5 blur-2xl" />
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute top-3 right-3">
          <PrivacyBadge privacy={group.privacy || 'public'} />
        </div>
      </div>

      {/* Content */}
      <div className="p-5 -mt-10 relative">
        {/* Avatar */}
        <div className="flex items-end gap-4 mb-4">
          <div className="relative">
            <div className="w-20 h-20 rounded-2xl bg-surface border-4 border-background overflow-hidden shadow-lg">
              {group.photoURL ? (
                <img src={group.photoURL} alt={group.name} className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <span className="text-white font-bold text-xl">{initials}</span>
                </div>
              )}
            </div>
            {isMember && (
              <div className="absolute -bottom-1 -right-1 w-6 h-6 bg-emerald-500 rounded-full border-2 border-background flex items-center justify-center">
                <Check size={10} className="text-white" />
              </div>
            )}
          </div>
          <div className="flex-1 pb-1 min-w-0">
            <h3 className="font-bold text-base text-primary truncate">{group.name}</h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs text-secondary">{group.membersCount} members</span>
              <span className="text-secondary">·</span>
              <span className="text-xs text-secondary">
                {group.createdAt ? formatDistanceToNow(group.createdAt.toDate(), { addSuffix: false }) : 'Recently'}
              </span>
            </div>
          </div>
        </div>

        {/* Description */}
        {group.description && (
          <p className="text-sm text-secondary line-clamp-2 mb-4 leading-relaxed">{group.description}</p>
        )}

        {/* Tags */}
        <div className="flex flex-wrap gap-1.5 mb-4">
          <CategoryChip category={group.category} />
          {group.tags?.slice(0, 2).map((tag, i) => (
            <span key={i} className="px-2 py-0.5 bg-surface border border-border/50 rounded-full text-[10px] text-secondary font-medium">
              #{tag}
            </span>
          ))}
        </div>

        {/* Member Avatars */}
        <div className="flex items-center justify-between">
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-7 h-7 rounded-full bg-surface border-2 border-background flex items-center justify-center text-[8px] text-secondary font-medium">
                {String.fromCharCode(64 + i)}
              </div>
            ))}
            {group.membersCount > 3 && (
              <div className="w-7 h-7 rounded-full bg-surface border-2 border-background flex items-center justify-center text-[9px] text-secondary font-medium">
                +{group.membersCount - 3}
              </div>
            )}
          </div>

          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={(e) => { e.stopPropagation(); isMember ? onLeave() : onJoin(); }}
            disabled={joining}
            className={`px-4 py-2 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 ${
              isMember
                ? 'bg-surface border border-border text-secondary hover:bg-red-500/10 hover:text-red-400 hover:border-red-500/30'
                : 'bg-accent text-white hover:bg-accent/90 shadow-lg shadow-accent/20'
            }`}
          >
            {joining ? (
              <Loader2 size={14} className="animate-spin" />
            ) : isMember ? (
              <>
                <UserMinus size={14} />
                Leave
              </>
            ) : (
              <>
                <UserPlus size={14} />
                Join
              </>
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

// ============ CREATE GROUP MODAL ============
const CreateGroupModal = ({ isOpen, onClose, onSuccess }: { isOpen: boolean; onClose: () => void; onSuccess: () => void }) => {
  const { user } = useAuth();
  const [step, setStep] = useState(1);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [privacy, setPrivacy] = useState<'public' | 'private' | 'invite'>('public');
  const [rules, setRules] = useState<string[]>(['']);
  const [tags, setTags] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const categories = ['Technology', 'Gaming', 'Music', 'Art', 'Sports', 'Education', 'Lifestyle', 'Food', 'Travel', 'Business', 'Other'];

  const validateStep = (s: number) => {
    const errs: Record<string, string> = {};
    if (s === 1) {
      if (!name.trim()) errs.name = 'Group name is required';
      if (name.length > 50) errs.name = 'Name must be under 50 characters';
      if (!category) errs.category = 'Please select a category';
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const nextStep = () => {
    if (validateStep(step)) setStep(s => Math.min(s + 1, 4));
  };

  const prevStep = () => setStep(s => Math.max(s - 1, 1));

  const addRule = () => setRules(r => [...r, '']);
  const removeRule = (i: number) => setRules(r => r.filter((_, idx) => idx !== i));
  const updateRule = (i: number, val: string) => setRules(r => r.map((rule, idx) => idx === i ? val : rule));

  const handleCreate = async () => {
    if (!user || !name.trim()) return;
    setLoading(true);
    try {
      const groupRef = doc(collection(db, 'groups'));
      const chatRef = await addDoc(collection(db, 'chats'), {
        name,
        type: 'group',
        groupId: groupRef.id,
        participants: [user.uid],
        lastMessage: 'Group created',
        lastMessageAt: serverTimestamp(),
        createdAt: serverTimestamp()
      });

      const cleanRules = rules.filter(r => r.trim());
      const cleanTags = tags.split(',').map(t => t.trim()).filter(Boolean);

      await setDoc(groupRef, {
        name: name.trim(),
        description: description.trim(),
        creatorUid: user.uid,
        adminUids: [user.uid],
        chatId: chatRef.id,
        membersCount: 1,
        privacy,
        category,
        tags: cleanTags,
        rules: cleanRules,
        createdAt: serverTimestamp()
      });

      await setDoc(doc(db, 'groups', groupRef.id, 'members', user.uid), {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        role: 'admin',
        joinedAt: serverTimestamp()
      });

      onSuccess();
      onClose();
      setStep(1);
      setName('');
      setDescription('');
      setCategory('');
      setPrivacy('public');
      setRules(['']);
      setTags('');
      setErrors({});
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'groups');
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
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
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
              <h2 className="text-xl font-bold text-primary">Create Community</h2>
              <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors text-secondary">
                <X size={20} />
              </button>
            </div>
            {/* Progress */}
            <div className="flex items-center gap-2">
              {[1, 2, 3, 4].map(s => (
                <div key={s} className="flex-1 flex items-center gap-2">
                  <div className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${s <= step ? 'bg-accent' : 'bg-surface'}`} />
                </div>
              ))}
            </div>
            <div className="flex justify-between mt-2">
              {['Details', 'Settings', 'Rules', 'Review'].map((label, i) => (
                <span key={label} className={`text-[10px] font-semibold ${i + 1 <= step ? 'text-accent' : 'text-secondary'}`}>
                  {label}
                </span>
              ))}
            </div>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto p-6 custom-scrollbar">
            <AnimatePresence mode="wait">
              {step === 1 && (
                <motion.div
                  key="step1"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Group Name *</label>
                    <input
                      type="text"
                      value={name}
                      onChange={e => setName(e.target.value)}
                      placeholder="e.g. Photography Enthusiasts"
                      className={`w-full bg-surface border rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all ${errors.name ? 'border-red-500' : 'border-border/50'}`}
                    />
                    {errors.name && <p className="text-red-400 text-xs mt-1">{errors.name}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Description</label>
                    <textarea
                      value={description}
                      onChange={e => setDescription(e.target.value)}
                      placeholder="What is this community about?"
                      className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none h-24"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Category *</label>
                    <div className="flex flex-wrap gap-2">
                      {categories.map(cat => (
                        <button
                          key={cat}
                          onClick={() => setCategory(cat)}
                          className={`px-3 py-1.5 rounded-full text-xs font-semibold transition-all ${
                            category === cat ? 'bg-accent text-white' : 'bg-surface border border-border/50 text-secondary hover:border-accent/50'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {errors.category && <p className="text-red-400 text-xs mt-1">{errors.category}</p>}
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-2">Tags (comma separated)</label>
                    <input
                      type="text"
                      value={tags}
                      onChange={e => setTags(e.target.value)}
                      placeholder="e.g. photography, nature, art"
                      className="w-full bg-surface border border-border/50 rounded-xl px-4 py-3 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                    />
                  </div>
                </motion.div>
              )}

              {step === 2 && (
                <motion.div
                  key="step2"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-5"
                >
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-wider mb-3">Privacy</label>
                    <div className="space-y-3">
                      {[
                        { value: 'public', icon: <Globe size={20} />, label: 'Public', desc: 'Anyone can see and join' },
                        { value: 'private', icon: <Lock size={20} />, label: 'Private', desc: 'Members can invite others' },
                        { value: 'invite', icon: <Mail size={20} />, label: 'Invite Only', desc: 'Admin must approve requests' }
                      ].map(p => (
                        <button
                          key={p.value}
                          onClick={() => setPrivacy(p.value as any)}
                          className={`w-full flex items-center gap-4 p-4 rounded-2xl border transition-all text-left ${
                            privacy === p.value
                              ? 'border-accent bg-accent/10'
                              : 'border-border/50 bg-surface hover:border-accent/30'
                          }`}
                        >
                          <div className={`p-2 rounded-xl ${privacy === p.value ? 'bg-accent text-white' : 'bg-surface text-secondary'}`}>
                            {p.icon}
                          </div>
                          <div>
                            <p className={`text-sm font-semibold ${privacy === p.value ? 'text-accent' : 'text-primary'}`}>{p.label}</p>
                            <p className="text-xs text-secondary">{p.desc}</p>
                          </div>
                          {privacy === p.value && <Check size={18} className="ml-auto text-accent" />}
                        </button>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {step === 3 && (
                <motion.div
                  key="step3"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-secondary uppercase tracking-wider">Community Rules</label>
                    <button onClick={addRule} className="text-xs text-accent font-semibold hover:underline">+ Add Rule</button>
                  </div>
                  {rules.map((rule, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-xs font-bold text-secondary w-6">{i + 1}.</span>
                      <input
                        type="text"
                        value={rule}
                        onChange={e => updateRule(i, e.target.value)}
                        placeholder={`Rule ${i + 1}`}
                        className="flex-1 bg-surface border border-border/50 rounded-xl px-4 py-2.5 text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                      />
                      {rules.length > 1 && (
                        <button onClick={() => removeRule(i)} className="p-2 text-secondary hover:text-red-400 transition-colors">
                          <X size={16} />
                        </button>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-secondary mt-2">Set clear guidelines for your community members.</p>
                </motion.div>
              )}

              {step === 4 && (
                <motion.div
                  key="step4"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <div className="bg-surface rounded-2xl p-5 border border-border/50">
                    <h3 className="font-bold text-primary mb-3">Preview</h3>
                    <div className="space-y-3 text-sm">
                      <div className="flex justify-between">
                        <span className="text-secondary">Name</span>
                        <span className="text-primary font-medium">{name}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondary">Category</span>
                        <span className="text-primary font-medium">{category}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-secondary">Privacy</span>
                        <span className="text-primary font-medium capitalize">{privacy}</span>
                      </div>
                      {description && (
                        <div>
                          <span className="text-secondary block mb-1">Description</span>
                          <p className="text-primary">{description}</p>
                        </div>
                      )}
                      {tags && (
                        <div>
                          <span className="text-secondary block mb-1">Tags</span>
                          <div className="flex flex-wrap gap-1">
                            {tags.split(',').map((t, i) => (
                              <span key={i} className="px-2 py-0.5 bg-accent/10 text-accent rounded-full text-xs">{t.trim()}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {rules.filter(r => r.trim()).length > 0 && (
                        <div>
                          <span className="text-secondary block mb-1">Rules ({rules.filter(r => r.trim()).length})</span>
                          <ul className="space-y-1">
                            {rules.filter(r => r.trim()).map((r, i) => (
                              <li key={i} className="text-primary text-xs flex gap-2">
                                <span className="text-accent">{i + 1}.</span>
                                {r}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="p-6 border-t border-border/50 flex gap-3">
            {step > 1 && (
              <button onClick={prevStep} className="flex-1 py-3 border border-border rounded-xl font-semibold text-secondary hover:bg-surface transition-colors">
                Back
              </button>
            )}
            {step < 4 ? (
              <button onClick={nextStep} className="flex-1 py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-all">
                Continue
              </button>
            ) : (
              <button
                onClick={handleCreate}
                disabled={loading || !name.trim()}
                className="flex-1 py-3 bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-accent/30 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 size={18} className="animate-spin" /> : <Sparkles size={18} />}
                {loading ? 'Creating...' : 'Create Community'}
              </button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============ MANAGE ADMINS MODAL ============
const ManageAdminsModal = ({ group, isOpen, onClose, onToast }: { group: Group; isOpen: boolean; onClose: () => void; onToast: (msg: string, type: 'success' | 'error' | 'info') => void }) => {
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendNotification } = useNotifications();

  useEffect(() => {
    if (!isOpen) return;
    setLoading(true);
    const q = collection(db, 'groups', group.id, 'members');
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const membersData = snapshot.docs.map(doc => ({
        uid: doc.id,
        ...doc.data()
      } as GroupMember));
      setMembers(membersData);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [isOpen, group.id]);

  const toggleAdmin = async (userId: string, isAdmin: boolean) => {
    const groupRef = doc(db, 'groups', group.id);
    try {
      await updateDoc(groupRef, {
        adminUids: isAdmin ? arrayRemove(userId) : arrayUnion(userId)
      });
      if (!isAdmin) {
        await updateDoc(doc(db, 'groups', group.id, 'members', userId), { role: 'admin' });
        await sendNotification(userId, 'group_activity', 'Promoted to Admin', `You are now an admin in ${group.name}.`, { groupId: group.id });
        onToast('Admin promoted successfully', 'success');
      } else {
        await updateDoc(doc(db, 'groups', group.id, 'members', userId), { role: 'member' });
        onToast('Admin demoted', 'info');
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `groups/${group.id}`);
      onToast('Failed to update admin', 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="bg-background w-full max-w-md rounded-3xl overflow-hidden shadow-2xl border border-border/50 max-h-[80vh] flex flex-col"
          onClick={e => e.stopPropagation()}
        >
          <div className="p-6 border-b border-border/50 flex items-center justify-between">
            <h2 className="text-lg font-bold text-primary">Manage Admins</h2>
            <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors text-secondary">
              <X size={20} />
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-2">
            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => (
                  <div key={i} className="flex items-center gap-3 p-3 bg-surface rounded-xl animate-pulse">
                    <div className="w-10 h-10 rounded-full bg-surface" />
                    <div className="flex-1"><div className="h-4 bg-surface rounded w-24 mb-1" /><div className="h-3 bg-surface rounded w-16" /></div>
                  </div>
                ))}
              </div>
            ) : (
              members.map(member => {
                const isAdmin = group.adminUids.includes(member.uid);
                const isCreator = group.creatorUid === member.uid;
                return (
                  <div key={member.uid} className="flex items-center justify-between p-3 bg-surface rounded-xl">
                    <div className="flex items-center gap-3">
                      <img src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}&background=random`} alt="" className="w-10 h-10 rounded-full object-cover" />
                      <div>
                        <p className="text-sm font-semibold text-primary">{member.displayName}</p>
                        <div className="flex items-center gap-2">
                          {isCreator && <span className="text-[10px] text-amber-400 font-bold flex items-center gap-0.5"><Crown size={10} /> Creator</span>}
                          {isAdmin && !isCreator && <span className="text-[10px] text-accent font-bold">Admin</span>}
                          {!isAdmin && !isCreator && <span className="text-[10px] text-secondary">Member</span>}
                        </div>
                      </div>
                    </div>
                    {!isCreator && (
                      <button
                        onClick={() => toggleAdmin(member.uid, isAdmin)}
                        className={`p-2 rounded-lg transition-all ${isAdmin ? 'bg-red-500/10 text-red-400 hover:bg-red-500/20' : 'bg-accent/10 text-accent hover:bg-accent/20'}`}
                      >
                        {isAdmin ? <UserMinus size={16} /> : <Shield size={16} />}
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

// ============ GROUP DETAIL VIEW ============
const GroupDetail = ({ group, isMember, isAdmin, isCreator, onBack, onJoin, onLeave, onToast }: {
  group: Group;
  isMember: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  onBack: () => void;
  onJoin: () => void;
  onLeave: () => void;
  onToast: (msg: string, type: 'success' | 'error') => void;
}) => {
  const [activeTab, setActiveTab] = useState<'feed' | 'members' | 'media' | 'about'>('feed');
  const [members, setMembers] = useState<GroupMember[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [postText, setPostText] = useState('');
  const [posting, setPosting] = useState(false);
  const [showManageAdmins, setShowManageAdmins] = useState(false);
  const { user } = useAuth();
  const gradient = getCoverGradient(group.name);
  const initials = group.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();

  useEffect(() => {
    setLoading(true);
    // Fetch members
    const membersQ = collection(db, 'groups', group.id, 'members');
    const unsubMembers = onSnapshot(membersQ, (snap) => {
      setMembers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as GroupMember)));
    });

    // Fetch posts
    const postsQ = query(collection(db, 'groups', group.id, 'posts'), orderBy('createdAt', 'desc'), limit(20));
    const unsubPosts = onSnapshot(postsQ, (snap) => {
      setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
    });

    return () => { unsubMembers(); unsubPosts(); };
  }, [group.id]);

  const handleCreatePost = async () => {
    if (!user || !postText.trim()) return;
    setPosting(true);
    try {
      await addDoc(collection(db, 'groups', group.id, 'posts'), {
        authorUid: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL || '',
        content: postText.trim(),
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp()
      });
      setPostText('');
      onToast('Post created!', 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, `groups/${group.id}/posts`);
      onToast('Failed to create post', 'error');
    } finally {
      setPosting(false);
    }
  };

  const tabs = [
    { id: 'feed' as const, label: 'Feed', icon: <Grid size={16} /> },
    { id: 'members' as const, label: 'Members', icon: <Users size={16} /> },
    { id: 'media' as const, label: 'Media', icon: <ImageIcon size={16} /> },
    { id: 'about' as const, label: 'About', icon: <Info size={16} /> }
  ];

  return (
    <motion.div
      initial={{ opacity: 0, x: 100 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 100 }}
      className="fixed inset-0 z-[150] bg-background overflow-hidden flex flex-col"
    >
      {/* Hero Section */}
      <div className={`relative h-48 bg-gradient-to-br ${gradient} flex-shrink-0`}>
        {group.coverURL && <img src={group.coverURL} alt="" className="w-full h-full object-cover" />}
        <div className="absolute inset-0 bg-gradient-to-t from-background via-background/50 to-transparent" />
        
        {/* Back Button */}
        <button onClick={onBack} className="absolute top-4 left-4 p-2 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50 transition-colors">
          <ArrowLeft size={20} />
        </button>

        {/* Admin Button */}
        {(isCreator || isAdmin) && (
          <button onClick={() => setShowManageAdmins(true)} className="absolute top-4 right-4 p-2 bg-black/30 backdrop-blur-md rounded-full text-white hover:bg-black/50 transition-colors">
            <Settings size={18} />
          </button>
        )}

        {/* Group Info Overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-6">
          <div className="flex items-end gap-4">
            <div className="w-20 h-20 rounded-2xl bg-surface border-4 border-background overflow-hidden shadow-xl flex-shrink-0">
              {group.photoURL ? (
                <img src={group.photoURL} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className={`w-full h-full bg-gradient-to-br ${gradient} flex items-center justify-center`}>
                  <span className="text-white font-bold text-xl">{initials}</span>
                </div>
              )}
            </div>
            <div className="flex-1 min-w-0 pb-1">
              <h1 className="text-xl font-bold text-white truncate">{group.name}</h1>
              <div className="flex items-center gap-2 mt-1">
                <PrivacyBadge privacy={group.privacy || 'public'} />
                <span className="text-white/70 text-sm">{members.length} members</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex-shrink-0 border-b border-border/50">
        <div className="flex overflow-x-auto no-scrollbar">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-5 py-3 text-sm font-semibold whitespace-nowrap transition-all border-b-2 ${
                activeTab === tab.id
                  ? 'text-accent border-accent'
                  : 'text-secondary border-transparent hover:text-primary'
              }`}
            >
              {tab.icon}
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'feed' && (
          <div className="p-4 space-y-4">
            {/* Create Post */}
            {isMember && (
              <div className="bg-surface rounded-2xl p-4 border border-border/50">
                <div className="flex gap-3">
                  <img src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  <div className="flex-1">
                    <textarea
                      value={postText}
                      onChange={e => setPostText(e.target.value)}
                      placeholder="Share something with the community..."
                      className="w-full bg-transparent text-sm text-primary placeholder-secondary resize-none focus:outline-none min-h-[60px]"
                    />
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50">
                      <div className="flex gap-2">
                        <button className="p-2 text-secondary hover:text-accent transition-colors"><ImageIcon size={18} /></button>
                        <button className="p-2 text-secondary hover:text-accent transition-colors"><Video size={18} /></button>
                        <button className="p-2 text-secondary hover:text-accent transition-colors"><Calendar size={18} /></button>
                      </div>
                      <button
                        onClick={handleCreatePost}
                        disabled={!postText.trim() || posting}
                        className="px-4 py-2 bg-accent text-white rounded-xl text-sm font-semibold hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center gap-2"
                      >
                        {posting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                        Post
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Posts */}
            {loading ? (
              <div className="space-y-4">
                {[1, 2].map(i => (
                  <div key={i} className="bg-surface rounded-2xl p-4 animate-pulse">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-surface" />
                      <div className="flex-1"><div className="h-4 bg-surface rounded w-24 mb-1" /><div className="h-3 bg-surface rounded w-16" /></div>
                    </div>
                    <div className="space-y-2"><div className="h-3 bg-surface rounded w-full" /><div className="h-3 bg-surface rounded w-5/6" /></div>
                  </div>
                ))}
              </div>
            ) : posts.length > 0 ? (
              posts.map(post => (
                <div key={post.id} className="bg-surface rounded-2xl p-4 border border-border/50">
                  <div className="flex items-center gap-3 mb-3">
                    <img src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`} alt="" className="w-10 h-10 rounded-full object-cover" />
                    <div>
                      <p className="text-sm font-semibold text-primary">{post.authorName}</p>
                      <p className="text-xs text-secondary">{post.createdAt ? formatDistanceToNow(post.createdAt.toDate?.() || Date.now(), { addSuffix: true }) : 'Just now'}</p>
                    </div>
                  </div>
                  <p className="text-sm text-primary leading-relaxed mb-3">{post.content}</p>
                  <div className="flex items-center gap-4 text-secondary">
                    <button className="flex items-center gap-1.5 text-xs hover:text-accent transition-colors">
                      <Heart size={16} /> {post.likesCount || 0}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs hover:text-accent transition-colors">
                      <MessageCircle size={16} /> {post.commentsCount || 0}
                    </button>
                    <button className="flex items-center gap-1.5 text-xs hover:text-accent transition-colors">
                      <Share2 size={16} /> Share
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-16">
                <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
                  <MessageSquare size={28} className="text-secondary" />
                </div>
                <h3 className="text-lg font-semibold text-primary mb-2">No posts yet</h3>
                <p className="text-sm text-secondary">Be the first to share something with the community!</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'members' && (
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm text-secondary">{members.length} members</span>
              <div className="relative">
                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" />
                <input type="text" placeholder="Search members..." className="pl-9 pr-4 py-2 bg-surface border border-border/50 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 w-48" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              {members.map(member => (
                <div key={member.uid} className="bg-surface rounded-xl p-3 border border-border/50 flex items-center gap-3">
                  <img src={member.photoURL || `https://ui-avatars.com/api/?name=${member.displayName}&background=random`} alt="" className="w-10 h-10 rounded-full object-cover flex-shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-primary truncate">{member.displayName}</p>
                    <div className="flex items-center gap-1">
                      {group.creatorUid === member.uid && <Crown size={10} className="text-amber-400" />}
                      {group.adminUids.includes(member.uid) && <Shield size={10} className="text-accent" />}
                      <span className="text-[10px] text-secondary">
                        {group.creatorUid === member.uid ? 'Creator' : group.adminUids.includes(member.uid) ? 'Admin' : 'Member'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'media' && (
          <div className="p-4">
            <div className="text-center py-16">
              <div className="w-16 h-16 bg-surface rounded-2xl flex items-center justify-center mx-auto mb-4">
                <ImageIcon size={28} className="text-secondary" />
              </div>
              <h3 className="text-lg font-semibold text-primary mb-2">No media yet</h3>
              <p className="text-sm text-secondary">Photos and videos shared in this group will appear here.</p>
            </div>
          </div>
        )}

        {activeTab === 'about' && (
          <div className="p-4 space-y-6">
            {group.description && (
              <div>
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-2">About</h3>
                <p className="text-sm text-primary leading-relaxed">{group.description}</p>
              </div>
            )}
            <div>
              <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">Details</h3>
              <div className="bg-surface rounded-xl border border-border/50 divide-y divide-border/50">
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-secondary flex items-center gap-2"><Globe size={14} /> Privacy</span>
                  <span className="text-sm text-primary capitalize">{group.privacy || 'public'}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-secondary flex items-center gap-2"><Hash size={14} /> Category</span>
                  <span className="text-sm text-primary">{group.category || 'None'}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-secondary flex items-center gap-2"><Clock size={14} /> Created</span>
                  <span className="text-sm text-primary">{group.createdAt ? formatDistanceToNow(group.createdAt.toDate(), { addSuffix: true }) : 'Recently'}</span>
                </div>
                <div className="flex items-center justify-between p-3">
                  <span className="text-sm text-secondary flex items-center gap-2"><Users size={14} /> Members</span>
                  <span className="text-sm text-primary">{members.length}</span>
                </div>
              </div>
            </div>
            {group.rules && group.rules.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">Rules</h3>
                <div className="space-y-2">
                  {group.rules.map((rule, i) => (
                    <div key={i} className="flex items-start gap-3 bg-surface rounded-xl p-3 border border-border/50">
                      <span className="text-xs font-bold text-accent bg-accent/10 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <p className="text-sm text-primary">{rule}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {group.tags && group.tags.length > 0 && (
              <div>
                <h3 className="text-sm font-bold text-secondary uppercase tracking-wider mb-3">Tags</h3>
                <div className="flex flex-wrap gap-2">
                  {group.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-1.5 bg-surface border border-border/50 rounded-full text-xs text-secondary font-medium">#{tag}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Bottom Action Bar */}
      <div className="flex-shrink-0 p-4 border-t border-border/50 bg-background">
        {isMember ? (
          <div className="flex gap-3">
            {group.chatId && (
              <button
                onClick={() => window.location.href = `/chats/${group.chatId}`}
                className="flex-1 py-3 bg-surface border border-border rounded-xl font-semibold text-primary hover:bg-surface/80 transition-all flex items-center justify-center gap-2"
              >
                <MessageSquare size={18} />
                Chat
              </button>
            )}
            <button
              onClick={onLeave}
              className="px-6 py-3 bg-red-500/10 border border-red-500/30 text-red-400 rounded-xl font-semibold hover:bg-red-500/20 transition-all flex items-center gap-2"
            >
              <UserMinus size={18} />
              Leave
            </button>
          </div>
        ) : (
          <button
            onClick={onJoin}
            className="w-full py-3 bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-accent/30 transition-all flex items-center justify-center gap-2"
          >
            <UserPlus size={18} />
            Join Community
          </button>
        )}
      </div>

      <ManageAdminsModal group={group} isOpen={showManageAdmins} onClose={() => setShowManageAdmins(false)} onToast={onToast} />
    </motion.div>
  );
};

// ============ MAIN GROUPS PAGE ============
export default function Groups() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedGroup, setSelectedGroup] = useState<Group | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'name'>('recent');
  const [filterPrivacy, setFilterPrivacy] = useState<string>('all');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);
  const [joiningGroupId, setJoiningGroupId] = useState<string | null>(null);
  const [memberStatus, setMemberStatus] = useState<Record<string, boolean>>({});
  const { user } = useAuth();
  const { sendNotification } = useNotifications();
  const navigate = useNavigate();

  // Fetch groups
  useEffect(() => {
    const q = query(collection(db, 'groups'), orderBy('createdAt', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setGroups(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Group)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.LIST, 'groups');
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // Check membership for all groups
  useEffect(() => {
    if (!user || groups.length === 0) return;
    const unsubscribers: (() => void)[] = [];
    groups.forEach(group => {
      const unsub = onSnapshot(doc(db, 'groups', group.id, 'members', user.uid), (snap) => {
        setMemberStatus(prev => ({ ...prev, [group.id]: snap.exists() }));
      });
      unsubscribers.push(unsub);
    });
    return () => unsubscribers.forEach(u => u());
  }, [user, groups.map(g => g.id).join(',')]);

  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
  };

  const handleJoin = async (group: Group) => {
    if (!user) return;
    setJoiningGroupId(group.id);
    const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
    const groupRef = doc(db, 'groups', group.id);
    const chatRef = group.chatId ? doc(db, 'chats', group.chatId) : null;

    try {
      const batch = writeBatch(db);
      batch.set(memberRef, {
        uid: user.uid,
        displayName: user.displayName,
        photoURL: user.photoURL || '',
        role: 'member',
        joinedAt: serverTimestamp()
      });
      batch.update(groupRef, { membersCount: increment(1) });
      if (chatRef) batch.update(chatRef, { participants: arrayUnion(user.uid) });
      await batch.commit();

      const adminList = Array.from(new Set([...group.adminUids, group.creatorUid]));
      await Promise.all(adminList.map(adminId =>
        sendNotification(adminId, 'group_activity', `New member in ${group.name}`, `${user.displayName} has joined.`, { groupId: group.id })
      ));
      showToast(`Joined ${group.name}!`, 'success');
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `groups/${group.id}/members/${user.uid}`);
      showToast('Failed to join group', 'error');
    } finally {
      setJoiningGroupId(null);
    }
  };

  const handleLeave = async (group: Group) => {
    if (!user) return;
    setJoiningGroupId(group.id);
    const memberRef = doc(db, 'groups', group.id, 'members', user.uid);
    const groupRef = doc(db, 'groups', group.id);
    const chatRef = group.chatId ? doc(db, 'chats', group.chatId) : null;

    try {
      const batch = writeBatch(db);
      batch.delete(memberRef);
      batch.update(groupRef, { membersCount: increment(-1) });
      if (chatRef) batch.update(chatRef, { participants: arrayRemove(user.uid) });
      await batch.commit();
      showToast(`Left ${group.name}`, 'info');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `groups/${group.id}/members/${user.uid}`);
      showToast('Failed to leave group', 'error');
    } finally {
      setJoiningGroupId(null);
    }
  };

  const filteredGroups = groups
    .filter(g => {
      const matchesSearch = g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.description?.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPrivacy = filterPrivacy === 'all' || g.privacy === filterPrivacy;
      return matchesSearch && matchesPrivacy;
    })
    .sort((a, b) => {
      if (sortBy === 'popular') return (b.membersCount || 0) - (a.membersCount || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      return 0; // recent is default from Firestore
    });

  return (
    <div className="max-w-6xl mx-auto px-4 pt-6 pb-24">
      {/* Toast */}
      <AnimatePresence>
        {toast && <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-primary tracking-tight">Communities</h1>
          <p className="text-sm text-secondary mt-1">Discover and connect with communities</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={() => setIsCreateModalOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-accent to-purple-600 text-white rounded-xl font-semibold hover:shadow-lg hover:shadow-accent/30 transition-all"
        >
          <Plus size={18} />
          <span className="hidden sm:inline">Create</span>
        </motion.button>
      </div>

      {/* Search & Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-secondary" size={18} />
          <input
            type="text"
            placeholder="Search communities..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-11 pr-4 py-3 bg-surface border border-border/50 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={filterPrivacy}
            onChange={e => setFilterPrivacy(e.target.value)}
            className="px-4 py-3 bg-surface border border-border/50 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 appearance-none cursor-pointer"
          >
            <option value="all">All Types</option>
            <option value="public">Public</option>
            <option value="private">Private</option>
            <option value="invite">Invite Only</option>
          </select>
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as any)}
            className="px-4 py-3 bg-surface border border-border/50 rounded-xl text-sm text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 appearance-none cursor-pointer"
          >
            <option value="recent">Recent</option>
            <option value="popular">Popular</option>
            <option value="name">Name</option>
          </select>
          <div className="flex bg-surface border border-border/50 rounded-xl overflow-hidden">
            <button onClick={() => setViewMode('grid')} className={`p-3 transition-colors ${viewMode === 'grid' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'}`}>
              <Grid size={18} />
            </button>
            <button onClick={() => setViewMode('list')} className={`p-3 transition-colors ${viewMode === 'list' ? 'bg-accent text-white' : 'text-secondary hover:text-primary'}`}>
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* Categories Quick Filter */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-6 pb-2">
        {['All', 'Technology', 'Gaming', 'Music', 'Art', 'Sports', 'Education', 'Lifestyle'].map(cat => (
          <button
            key={cat}
            onClick={() => setSearchQuery(cat === 'All' ? '' : cat)}
            className={`px-4 py-2 rounded-full text-xs font-semibold whitespace-nowrap transition-all ${
              (cat === 'All' && !searchQuery) || searchQuery === cat
                ? 'bg-accent text-white'
                : 'bg-surface border border-border/50 text-secondary hover:border-accent/50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Content */}
      {loading ? (
        <div className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
          {[1, 2, 3, 4, 5, 6].map(i => <GroupCardSkeleton key={i} />)}
        </div>
      ) : filteredGroups.length > 0 ? (
        <motion.div
          layout
          className={viewMode === 'grid' ? 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}
        >
          <AnimatePresence>
            {filteredGroups.map(group => (
              <GroupCard
                key={group.id}
                group={group}
                isMember={memberStatus[group.id] || false}
                onJoin={() => handleJoin(group)}
                onLeave={() => handleLeave(group)}
                onView={() => setSelectedGroup(group)}
                joining={joiningGroupId === group.id}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      ) : (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center py-20"
        >
          <div className="w-24 h-24 bg-surface rounded-3xl flex items-center justify-center mx-auto mb-6">
            <Users size={40} className="text-secondary" />
          </div>
          <h2 className="text-xl font-bold text-primary mb-2">No communities found</h2>
          <p className="text-sm text-secondary mb-6 max-w-sm mx-auto">
            {searchQuery ? 'Try a different search term or create your own community.' : 'Be the first to create a community and start building your network!'}
          </p>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setIsCreateModalOpen(true)}
            className="px-6 py-3 bg-accent text-white rounded-xl font-semibold hover:bg-accent/90 transition-all inline-flex items-center gap-2"
          >
            <Plus size={18} />
            Create Community
          </motion.button>
        </motion.div>
      )}

      {/* Group Detail View */}
      <AnimatePresence>
        {selectedGroup && (
          <GroupDetail
            group={selectedGroup}
            isMember={memberStatus[selectedGroup.id] || false}
            isAdmin={selectedGroup.adminUids.includes(user?.uid || '')}
            isCreator={selectedGroup.creatorUid === user?.uid}
            onBack={() => setSelectedGroup(null)}
            onJoin={() => handleJoin(selectedGroup)}
            onLeave={() => handleLeave(selectedGroup)}
            onToast={showToast}
          />
        )}
      </AnimatePresence>

      {/* Create Group Modal */}
      <CreateGroupModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={() => showToast('Community created successfully!', 'success')}
      />
    </div>
  );
}
