import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Settings as SettingsIcon,
  User,
  Bell,
  Lock,
  Eye,
  Palette,
  LogOut,
  Trash2,
  ChevronRight,
  Smartphone,
  Globe,
  ShieldCheck,
  ChevronLeft,
  Moon,
  Sun,
  Monitor,
  Check,
  Loader2,
  AlertCircle,
  MessageCircle,
  MessageSquare,
  Database,
  HelpCircle,
  FileText,
  MessageSquareText,
  ShieldAlert,
  Download,
  HardDrive,
  Camera,
  Mail,
  Phone,
  MapPin,
  Link as LinkIcon
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { doc, updateDoc, collection, query, where, getDocs, deleteDoc } from 'firebase/firestore';
import { useFirestoreListener } from '../lib/firestoreListenerManager';
import { updateProfile } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { UserSettings, User as UserType } from '../types';

type SettingsSection = 'main' | 'profile' | 'notifications' | 'privacy' | 'appearance' | 'account' | 'admin' | 'content' | 'story' | 'storage' | 'help' | 'about';

export default function Settings() {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();
  const { addListener, removeListener } = useFirestoreListener();
  const [activeSection, setActiveSection] = useState<SettingsSection>('main');
  const [loading, setLoading] = useState(false);
  const [userData, setUserData] = useState<UserType | null>(null);
  const [profileForm, setProfileForm] = useState({
    displayName: '',
    bio: '',
    email: '',
    phone: '',
    location: '',
    website: ''
  });
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string>('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [errors, setErrors] = useState<{ displayName?: string; bio?: string }>({});
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Default settings if none exist
  const defaultSettings: UserSettings = {
    notifications: {
      messages: true,
      likes: true,
      comments: true,
      follows: true,
      groupActivity: true
    },
    privacy: {
      profileVisible: true,
      showStatus: true,
      allowDirectMessages: 'everyone'
    },
    appearance: {
      theme: 'system',
      fontSize: 'medium'
    }
  };

  useEffect(() => {
    if (!user) return;
    
    addListener({
      id: 'Settings-userProfile',
      query: doc(db, 'users', user.uid),
      context: 'Settings-userProfile',
      onNext: (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as UserType;
          setUserData(data);
          setProfileForm({
            displayName: data.displayName || '',
            bio: data.bio || '',
            email: user.email || '',
            phone: data.phone || '',
            location: data.location || '',
            website: data.website || ''
          });
          setHasUnsavedChanges(false);
          setErrors({});
        }
      },
      onError: (error) => {
        handleFirestoreError(error, OperationType.GET, 'users');
      }
    });

    return () => removeListener('Settings-userProfile');
  }, [user, addListener, removeListener]);

  // Track unsaved changes
  useEffect(() => {
    if (!userData) return;
    const hasChanges = 
      profileForm.displayName !== userData.displayName ||
      profileForm.bio !== userData.bio ||
      profileForm.phone !== userData.phone ||
      profileForm.location !== userData.location ||
      profileForm.website !== userData.website ||
      photoFile !== null;
    setHasUnsavedChanges(hasChanges);
  }, [profileForm, photoFile, userData]);

  // Warn on unsaved changes
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasUnsavedChanges]);

  const currentSettings = userData?.settings || defaultSettings;

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('text-sm', 'text-base', 'text-lg');
    const sizeMap: Record<string, string> = {
      small: 'text-[14px]',
      medium: 'text-[16px]',
      large: 'text-[18px]'
    };
    root.style.fontSize = sizeMap[currentSettings.appearance.fontSize] || '16px';
  }, [currentSettings.appearance.fontSize]);

  const updateSettings = async (newSettings: Partial<UserSettings>) => {
    if (!user) return;
    setLoading(true);
    try {
      const updatedSettings = { ...currentSettings, ...newSettings };
      await updateDoc(doc(db, 'users', user.uid), {
        settings: updatedSettings
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    if (window.confirm('Are you sure you want to log out?')) {
      await logout();
      navigate('/login');
    }
  };

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotoPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCancelProfile = () => {
    if (hasUnsavedChanges) {
      if (window.confirm('You have unsaved changes. Are you sure you want to leave?')) {
        setActiveSection('main');
        setPhotoFile(null);
        setPhotoPreview('');
        setErrors({});
      }
    } else {
      setActiveSection('main');
    }
  };

  const handleSaveProfile = async () => {
    if (!user) return;

    // Validate form
    const newErrors: { displayName?: string; bio?: string } = {};
    if (!profileForm.displayName.trim()) {
      newErrors.displayName = 'Username is required';
    }
    if (profileForm.bio.length > 150) {
      newErrors.bio = 'Bio must be 150 characters or less';
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);
    try {
      let photoUrl = userData?.photoURL;

      if (photoFile) {
        photoUrl = await uploadToCloudinary(photoFile, `profile-photos/${user.uid}`);
      }

      await updateDoc(doc(db, 'users', user.uid), {
        displayName: profileForm.displayName,
        bio: profileForm.bio,
        phone: profileForm.phone,
        location: profileForm.location,
        website: profileForm.website,
        photoURL: photoUrl
      });

      await updateProfile(auth.currentUser!, { displayName: profileForm.displayName });

      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
      
      setPhotoFile(null);
      setPhotoPreview('');
      setActiveSection('main');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${user.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const renderHeader = (title: string, showBack = true) => (
    <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-xl border-b border-border p-6 flex items-center">
      {showBack && (
        <button 
          onClick={() => setActiveSection('main')}
          className="mr-4 p-2 hover:bg-surface rounded-full transition-all active:scale-95"
        >
          <ChevronLeft size={24} />
        </button>
      )}
      <div className="flex flex-col">
        <h1 className="text-2xl font-black tracking-tighter">{title}</h1>
        <p className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">{user?.displayName}'s Nexus</p>
      </div>
    </div>
  );

  const SectionButton = ({ icon: Icon, title, subtitle, onClick, color = 'accent' }: any) => (
    <button 
      onClick={onClick}
      className="w-full flex items-center justify-between p-6 bg-background border border-border rounded-[2rem] hover:shadow-nexus transition-all active:scale-[0.98] group"
    >
      <div className="flex items-center space-x-4">
        <div className={`p-3 bg-${color}/10 text-${color} rounded-2xl group-hover:scale-110 transition-transform`}>
          <Icon size={24} />
        </div>
        <div className="text-left">
          <h3 className="font-bold text-sm tracking-tight">{title}</h3>
          <p className="text-xs text-secondary font-medium">{subtitle}</p>
        </div>
      </div>
      <ChevronRight size={20} className="text-secondary group-hover:translate-x-1 transition-transform" />
    </button>
  );

  const ToggleItem = ({ title, subtitle, active, onToggle }: any) => (
    <div className="flex items-center justify-between p-6 bg-background border border-border rounded-[2rem]">
      <div className="flex-1 mr-4">
        <h3 className="font-bold text-sm tracking-tight">{title}</h3>
        <p className="text-xs text-secondary font-medium leading-relaxed">{subtitle}</p>
      </div>
      <button 
        onClick={onToggle}
        className={`relative w-14 h-8 transition-colors rounded-full focus:outline-none focus:ring-2 focus:ring-accent/20 ${active ? 'bg-accent' : 'bg-surface border border-border'}`}
      >
        <div className={`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform transform ${active ? 'translate-x-6 shadow-md' : 'shadow-sm'}`} />
      </button>
    </div>
  );

  const SelectItem = ({ title, options, value, onChange }: any) => (
    <div className="p-6 bg-background border border-border rounded-[2rem] space-y-4">
      <h3 className="font-bold text-sm tracking-tight">{title}</h3>
      <div className="grid grid-cols-1 gap-2">
        {options.map((opt: any) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            className={`flex items-center justify-between p-4 rounded-2xl transition-all border ${value === opt.value ? 'bg-accent/5 border-accent text-accent' : 'bg-surface border-transparent text-secondary hover:border-border'}`}
          >
            <span className="text-xs font-bold uppercase tracking-widest">{opt.label}</span>
            {value === opt.value && <Check size={16} />}
          </button>
        ))}
      </div>
    </div>
  );

  return (
    <div className="max-w-xl mx-auto min-h-screen bg-surface pb-32">
      <AnimatePresence mode="wait">
        {activeSection === 'profile' && (
          <motion.div
            key="profile"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="flex flex-col h-screen"
          >
            {renderHeader('Edit Profile')}
            
            {/* Scrollable form content */}
            <div className="flex-1 overflow-y-auto px-6 pt-4 pb-32">
              <div className="bg-background border border-border rounded-[2rem] p-6 space-y-6">
                {/* Profile Picture Section */}
                <div className="flex items-center space-x-6">
                  <div className="relative group">
                    <img
                      src={photoPreview || userData?.photoURL || 'https://via.placeholder.com/150'}
                      alt="Profile"
                      className="w-24 h-24 rounded-full object-cover border-2 border-border transition-transform group-hover:scale-105"
                    />
                    <label className="absolute bottom-0 right-0 w-8 h-8 bg-accent text-white rounded-full flex items-center justify-center cursor-pointer shadow-lg hover:bg-accent/90 transition-colors">
                      <Camera size={16} />
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoSelect}
                      />
                    </label>
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">{profileForm.displayName}</h3>
                    <p className="text-xs text-secondary">{profileForm.email}</p>
                  </div>
                </div>

                {/* Form Fields */}
                <div className="space-y-5">
                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">
                      Username <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={profileForm.displayName}
                      onChange={(e) => {
                        setProfileForm({ ...profileForm, displayName: e.target.value });
                        if (errors.displayName) setErrors({ ...errors, displayName: undefined });
                      }}
                      placeholder="Enter your username"
                      className={`w-full px-4 py-3 bg-surface border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all ${
                        errors.displayName 
                          ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                          : 'border-border focus:ring-accent/20 focus:border-accent'
                      }`}
                    />
                    {errors.displayName && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{errors.displayName}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2">
                      Bio <span className="text-gray-400 font-normal">({profileForm.bio.length}/150)</span>
                    </label>
                    <textarea
                      value={profileForm.bio}
                      onChange={(e) => {
                        setProfileForm({ ...profileForm, bio: e.target.value });
                        if (errors.bio) setErrors({ ...errors, bio: undefined });
                      }}
                      placeholder="Tell us about yourself"
                      rows={3}
                      maxLength={150}
                      className={`w-full px-4 py-3 bg-surface border rounded-xl text-sm focus:outline-none focus:ring-2 transition-all resize-none ${
                        errors.bio 
                          ? 'border-red-500 focus:ring-red-500/20 focus:border-red-500' 
                          : 'border-border focus:ring-accent/20 focus:border-accent'
                      }`}
                    />
                    {errors.bio && (
                      <p className="mt-1 text-xs text-red-500 font-medium">{errors.bio}</p>
                    )}
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2 flex items-center space-x-2">
                      <Mail size={14} />
                      <span>Email</span>
                    </label>
                    <input
                      type="email"
                      value={profileForm.email}
                      disabled
                      className="w-full px-4 py-3 bg-surface/50 border border-border rounded-xl text-sm focus:outline-none opacity-60 cursor-not-allowed"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2 flex items-center space-x-2">
                      <Phone size={14} />
                      <span>Phone</span>
                    </label>
                    <input
                      type="tel"
                      value={profileForm.phone}
                      onChange={(e) => setProfileForm({ ...profileForm, phone: e.target.value })}
                      placeholder="Add phone number"
                      className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2 flex items-center space-x-2">
                      <MapPin size={14} />
                      <span>Location</span>
                    </label>
                    <input
                      type="text"
                      value={profileForm.location}
                      onChange={(e) => setProfileForm({ ...profileForm, location: e.target.value })}
                      placeholder="Add your location"
                      className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-secondary uppercase tracking-widest mb-2 flex items-center space-x-2">
                      <LinkIcon size={14} />
                      <span>Website</span>
                    </label>
                    <input
                      type="url"
                      value={profileForm.website}
                      onChange={(e) => setProfileForm({ ...profileForm, website: e.target.value })}
                      placeholder="Add your website"
                      className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Sticky Footer with Save Button */}
            <div className="fixed bottom-0 left-0 right-0 bg-background/95 backdrop-blur-xl border-t border-border p-4 safe-area-inset-bottom">
              <div className="max-w-xl mx-auto flex space-x-4">
                <button
                  onClick={handleCancelProfile}
                  className="flex-1 py-4 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-surface transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  disabled={loading || !hasUnsavedChanges}
                  className="flex-1 py-4 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/20 relative overflow-hidden"
                >
                  {loading ? (
                    <span className="flex items-center justify-center">
                      <Loader2 size={16} className="animate-spin mr-2" />
                      Saving...
                    </span>
                  ) : (
                    'Save Changes'
                  )}
                </button>
              </div>
              {saveSuccess && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mt-3 text-center text-xs font-bold text-green-500"
                >
                  ✓ Profile saved successfully
                </motion.div>
              )}
            </div>
          </motion.div>
        )}

        {activeSection === 'main' && (
          <motion.div
            key="main"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="space-y-4"
          >
            {renderHeader('Settings', false)}

            <div className="px-6 space-y-4 pt-4">
              <div className="bg-background border border-border rounded-[2.5rem] p-6 flex items-center space-x-4 mb-8">
                <img
                  src={user?.photoURL || 'https://via.placeholder.com/150'}
                  className="w-16 h-16 rounded-full object-cover border-2 border-accent/20"
                />
                <div>
                  <h2 className="text-xl font-bold tracking-tight">{user?.displayName}</h2>
                  <p className="text-xs text-secondary font-medium">{user?.email}</p>
                </div>
              </div>

              <SectionButton
                icon={User}
                title="Personal Information"
                subtitle="Manage your profile data and visibility"
                onClick={() => setActiveSection('profile')}
              />
              <SectionButton 
                icon={Bell} 
                title="Notifications" 
                subtitle="Customize how you stay updated"
                onClick={() => setActiveSection('notifications')}
                color="orange"
              />
              <SectionButton 
                icon={ShieldCheck} 
                title="Privacy & Security" 
                subtitle="Control who can interact with you"
                onClick={() => setActiveSection('privacy')}
                color="green"
              />
              <SectionButton 
                icon={Palette} 
                title="Appearance" 
                subtitle="Change theme and visual filters"
                onClick={() => setActiveSection('appearance')}
                color="purple"
              />
              <SectionButton
                icon={Lock}
                title="Account Settings"
                subtitle="Subscription and security data"
                onClick={() => setActiveSection('account')}
                color="red"
              />
              <SectionButton
                icon={MessageSquare}
                title="Content & Interaction"
                subtitle="Manage comments, messages, and filters"
                onClick={() => setActiveSection('content')}
                color="blue"
              />
              <SectionButton
                icon={MessageSquareText}
                title="Story & Highlights"
                subtitle="Control story visibility and highlights"
                onClick={() => setActiveSection('story')}
                color="pink"
              />
              <SectionButton
                icon={HardDrive}
                title="Data & Storage"
                subtitle="Manage storage and download data"
                onClick={() => setActiveSection('storage')}
                color="cyan"
              />
              <SectionButton
                icon={HelpCircle}
                title="Help & Support"
                subtitle="Get help and report problems"
                onClick={() => setActiveSection('help')}
                color="yellow"
              />
              <SectionButton
                icon={FileText}
                title="About & Legal"
                subtitle="Terms, privacy, and app info"
                onClick={() => setActiveSection('about')}
                color="gray"
              />

              {userData?.role === 'admin' && (
                <SectionButton 
                  icon={ShieldCheck} 
                  title="Admin Dashboard" 
                  subtitle="Platform-wide management"
                  onClick={() => setActiveSection('admin')}
                  color="zinc"
                />
              )}

              <div className="pt-8 space-y-4">
                <button 
                  onClick={handleLogout}
                  className="w-full flex items-center justify-center space-x-2 p-6 bg-red-50 text-red-500 border border-red-100 rounded-[2rem] hover:bg-red-100 transition-all font-black uppercase tracking-widest text-xs"
                >
                  <LogOut size={20} />
                  <span>Logout from Nexus</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'notifications' && (
          <motion.div 
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Notifications')}
            <div className="px-6 space-y-4 pt-4">
              <ToggleItem 
                title="Direct Messages" 
                subtitle="Get notified when someone sends you a message"
                active={currentSettings.notifications.messages}
                onToggle={() => updateSettings({ notifications: { ...currentSettings.notifications, messages: !currentSettings.notifications.messages } })}
              />
              <ToggleItem 
                title="New Likes" 
                subtitle="Know when your content receives appreciation"
                active={currentSettings.notifications.likes}
                onToggle={() => updateSettings({ notifications: { ...currentSettings.notifications, likes: !currentSettings.notifications.likes } })}
              />
              <ToggleItem 
                title="Comments" 
                subtitle="Stay updated on discussions on your posts"
                active={currentSettings.notifications.comments}
                onToggle={() => updateSettings({ notifications: { ...currentSettings.notifications, comments: !currentSettings.notifications.comments } })}
              />
              <ToggleItem 
                title="New Followers" 
                subtitle="Get notified when someone joins your network"
                active={currentSettings.notifications.follows}
                onToggle={() => updateSettings({ notifications: { ...currentSettings.notifications, follows: !currentSettings.notifications.follows } })}
              />
            </div>
          </motion.div>
        )}

        {activeSection === 'appearance' && (
          <motion.div 
            key="appearance"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Appearance')}
            <div className="px-6 space-y-4 pt-4">
              <div className="bg-background border border-border rounded-[2rem] p-6">
                <h3 className="font-bold text-sm tracking-tight mb-6">Theme Selection</h3>
                <div className="grid grid-cols-3 gap-3">
                  <button 
                    onClick={() => setTheme('light')}
                    className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${theme === 'light' ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}
                  >
                    <Sun size={24} className={theme === 'light' ? 'text-accent' : 'text-secondary'} />
                    <span className="text-[10px] font-black uppercase mt-2 tracking-widest">Light</span>
                  </button>
                  <button 
                    onClick={() => setTheme('dark')}
                    className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${theme === 'dark' ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}
                  >
                    <Moon size={24} className={theme === 'dark' ? 'text-accent' : 'text-secondary'} />
                    <span className="text-[10px] font-black uppercase mt-2 tracking-widest">Dark</span>
                  </button>
                  <button 
                    onClick={() => setTheme('system')}
                    className={`flex flex-col items-center p-4 rounded-2xl border-2 transition-all ${theme === 'system' ? 'border-accent bg-accent/5' : 'border-border hover:border-accent/30'}`}
                  >
                    <Monitor size={24} className={theme === 'system' ? 'text-accent' : 'text-secondary'} />
                    <span className="text-[10px] font-black uppercase mt-2 tracking-widest">System</span>
                  </button>
                </div>
              </div>

              <SelectItem 
                title="Font Size"
                options={[
                  { label: 'Smallest', value: 'small' },
                  { label: 'Default - Nexus', value: 'medium' },
                  { label: 'Large Reader', value: 'large' }
                ]}
                value={currentSettings.appearance.fontSize}
                onChange={(fontSize: any) => updateSettings({ appearance: { ...currentSettings.appearance, fontSize } })}
              />
            </div>
          </motion.div>
        )}

        {activeSection === 'privacy' && (
          <motion.div
            key="privacy"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Privacy & Safety')}
            <div className="px-6 space-y-4 pt-4">
              <ToggleItem
                title="Public Profile"
                subtitle="Allow anyone to see your content and profile"
                active={currentSettings.privacy.profileVisible}
                onToggle={() => updateSettings({ privacy: { ...currentSettings.privacy, profileVisible: !currentSettings.privacy.profileVisible } })}
              />
              <ToggleItem
                title="Online Status"
                subtitle="Show when you are active on the platform"
                active={currentSettings.privacy.showStatus}
                onToggle={() => updateSettings({ privacy: { ...currentSettings.privacy, showStatus: !currentSettings.privacy.showStatus } })}
              />
              <SelectItem
                title="Direct Messages"
                options={[
                  { label: 'Everyone', value: 'everyone' },
                  { label: 'Following only', value: 'following' },
                  { label: 'Nobody', value: 'none' }
                ]}
                value={currentSettings.privacy.allowDirectMessages}
                onChange={(allowDirectMessages: any) => updateSettings({ privacy: { ...currentSettings.privacy, allowDirectMessages } })}
              />

              <SectionButton
                icon={ShieldAlert}
                title="Blocked Users"
                subtitle="Manage users you've blocked"
                onClick={() => {}}
                color="red"
              />

              <div className="pt-4">
                <button
                  onClick={() => navigate('/stats')}
                  className="w-full flex items-center justify-between p-6 bg-background border border-border rounded-[2rem] hover:shadow-nexus transition-all"
                >
                  <div className="flex items-center space-x-4">
                    <div className="p-3 bg-zinc-100 text-zinc-500 rounded-2xl">
                      <Eye size={24} />
                    </div>
                    <div className="text-left">
                      <h3 className="font-bold text-sm tracking-tight">Activity Log</h3>
                      <p className="text-xs text-secondary font-medium">View your platform history</p>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-secondary" />
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'account' && (
          <motion.div
            key="account"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Account')}
            <div className="px-6 space-y-4 pt-4">
              <ToggleItem
                title="Private Account"
                subtitle="Only approved followers can see your posts"
                active={!currentSettings.privacy.profileVisible}
                onToggle={() => updateSettings({ privacy: { ...currentSettings.privacy, profileVisible: currentSettings.privacy.profileVisible } })}
              />
              <SectionButton
                icon={Lock}
                title="Change Password"
                subtitle="Update your password for security"
                onClick={() => {}}
                color="blue"
              />
              <SectionButton
                icon={Smartphone}
                title="Two-Factor Authentication"
                subtitle="Add an extra layer of security"
                onClick={() => {}}
                color="green"
              />
              <SectionButton
                icon={Globe}
                title="Login Activity"
                subtitle="View and manage active sessions"
                onClick={() => {}}
                color="purple"
              />
              <div className="bg-red-50 border border-red-100 rounded-[2rem] p-6 space-y-4">
                <div className="flex items-center space-x-3 text-red-500">
                  <AlertCircle size={24} />
                  <h3 className="font-bold text-sm tracking-tight">Danger Zone</h3>
                </div>
                <p className="text-xs text-red-400 font-medium leading-relaxed">
                  Deleting your account is permanent. All your data, posts, messages and nexus history will be wiped from our servers.
                </p>
                <button
                  className="w-full py-4 bg-red-500 text-white rounded-2xl font-black uppercase tracking-widest text-[10px] shadow-lg shadow-red-500/20 active:scale-95 transition-all"
                >
                  Permanently Delete Account
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'content' && (
          <motion.div
            key="content"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Content & Interaction')}
            <div className="px-6 space-y-4 pt-4">
              <ToggleItem
                title="Allow Comments"
                subtitle="Let people comment on your posts"
                active={currentSettings.privacy.profileVisible}
                onToggle={() => updateSettings({ privacy: { ...currentSettings.privacy, profileVisible: !currentSettings.privacy.profileVisible } })}
              />
              <SelectItem
                title="Who Can Send Messages"
                options={[
                  { label: 'Everyone', value: 'everyone' },
                  { label: 'People You Follow', value: 'following' },
                  { label: 'No One', value: 'none' }
                ]}
                value={currentSettings.privacy.allowDirectMessages}
                onChange={(allowDirectMessages: any) => updateSettings({ privacy: { ...currentSettings.privacy, allowDirectMessages } })}
              />
              <div className="bg-background border border-border rounded-[2rem] p-6">
                <h3 className="font-bold text-sm tracking-tight mb-4">Hidden Words</h3>
                <p className="text-xs text-secondary font-medium mb-4">Hide comments containing specific words or phrases</p>
                <input
                  type="text"
                  placeholder="Add word or phrase"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent"
                />
              </div>
            </div>
          </motion.div>
        )}

        {activeSection === 'story' && (
          <motion.div
            key="story"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Story & Highlights')}
            <div className="px-6 space-y-4 pt-4">
              <ToggleItem
                title="Allow Story Replies"
                subtitle="Let people reply to your stories with messages"
                active={currentSettings.notifications.comments}
                onToggle={() => updateSettings({ notifications: { ...currentSettings.notifications, comments: !currentSettings.notifications.comments } })}
              />
              <ToggleItem
                title="Auto-Save Stories"
                subtitle="Automatically save your stories to archive"
                active={true}
                onToggle={() => {}}
              />
              <SelectItem
                title="Who Can View Stories"
                options={[
                  { label: 'Everyone', value: 'everyone' },
                  { label: 'Following Only', value: 'following' },
                  { label: 'Close Friends', value: 'close_friends' }
                ]}
                value="everyone"
                onChange={() => {}}
              />
            </div>
          </motion.div>
        )}

        {activeSection === 'storage' && (
          <motion.div
            key="storage"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Data & Storage')}
            <div className="px-6 space-y-4 pt-4">
              <div className="bg-background border border-border rounded-[2rem] p-6">
                <h3 className="font-bold text-sm tracking-tight mb-4">Storage Usage</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Photos & Videos</span>
                    <span className="text-xs font-bold">245 MB</span>
                  </div>
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-accent w-1/3" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Messages</span>
                    <span className="text-xs font-bold">12 MB</span>
                  </div>
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-purple-500 w-1/10" />
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-secondary">Other Data</span>
                    <span className="text-xs font-bold">8 MB</span>
                  </div>
                  <div className="w-full h-2 bg-surface rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500 w-1/20" />
                  </div>
                </div>
              </div>
              <button className="w-full flex items-center justify-between p-6 bg-background border border-border rounded-[2rem] hover:shadow-nexus transition-all">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-cyan-100 text-cyan-500 rounded-2xl">
                    <Download size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-sm tracking-tight">Download Your Data</h3>
                    <p className="text-xs text-secondary font-medium">Get a copy of all your information</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-secondary" />
              </button>
              <button className="w-full flex items-center justify-between p-6 bg-background border border-border rounded-[2rem] hover:shadow-nexus transition-all">
                <div className="flex items-center space-x-4">
                  <div className="p-3 bg-orange-100 text-orange-500 rounded-2xl">
                    <Database size={24} />
                  </div>
                  <div className="text-left">
                    <h3 className="font-bold text-sm tracking-tight">Clear Cache</h3>
                    <p className="text-xs text-secondary font-medium">Free up storage space</p>
                  </div>
                </div>
                <ChevronRight size={20} className="text-secondary" />
              </button>
            </div>
          </motion.div>
        )}

        {activeSection === 'help' && (
          <motion.div
            key="help"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('Help & Support')}
            <div className="px-6 space-y-4 pt-4">
              <SectionButton
                icon={HelpCircle}
                title="Help Center"
                subtitle="Browse our FAQs and guides"
                onClick={() => {}}
                color="yellow"
              />
              <SectionButton
                icon={AlertCircle}
                title="Report a Problem"
                subtitle="Tell us about bugs or issues"
                onClick={() => {}}
                color="red"
              />
              <SectionButton
                icon={MessageCircle}
                title="Contact Support"
                subtitle="Get in touch with our team"
                onClick={() => {}}
                color="blue"
              />
            </div>
          </motion.div>
        )}

        {activeSection === 'about' && (
          <motion.div
            key="about"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="space-y-4"
          >
            {renderHeader('About & Legal')}
            <div className="px-6 space-y-4 pt-4">
              <SectionButton
                icon={FileText}
                title="Terms of Service"
                subtitle="Read our terms and conditions"
                onClick={() => {}}
                color="gray"
              />
              <SectionButton
                icon={ShieldAlert}
                title="Privacy Policy"
                subtitle="Learn how we protect your data"
                onClick={() => {}}
                color="green"
              />
              <SectionButton
                icon={Globe}
                title="Licenses"
                subtitle="Open source licenses and attributions"
                onClick={() => {}}
                color="blue"
              />
              <div className="bg-background border border-border rounded-[2rem] p-6 text-center">
                <h3 className="font-bold text-sm tracking-tight mb-2">Nexus Social</h3>
                <p className="text-xs text-secondary">Version 1.0.0</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading && (
        <div className="fixed bottom-32 left-1/2 -translate-x-1/2 z-50">
          <div className="bg-accent text-white px-6 py-3 rounded-full flex items-center space-x-3 shadow-2xl glass-dark">
            <Loader2 size={16} className="animate-spin" />
            <span className="text-[10px] font-black uppercase tracking-widest">Saving Nexus Config</span>
          </div>
        </div>
      )}
    </div>
  );
}
