import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, collection, query, where, orderBy, updateDoc, setDoc, deleteDoc, serverTimestamp, QueryDocumentSnapshot, DocumentData } from 'firebase/firestore';
import { updateProfile } from 'firebase/auth';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { uploadToCloudinary } from '../lib/cloudinary';
import { useFirestoreListener } from '../lib/firestoreListenerManager';
import { User, Post, Story as StoryType, Recording } from '../types';
import { useAuth } from '../context/AuthContext';
import { Settings, Grid, Bookmark, Tag, LogOut, Edit3, MapPin, Link as LinkIcon, Calendar, Play, X, Heart, MessageCircle, Video, ShieldAlert, ShieldCheck, Loader2, MoreVertical, Camera, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { HighlightSection } from '../components/HighlightSection';
import { StoryViewer } from '../components/StoryViewer';
import { HighlightViewer } from '../components/HighlightViewer';
import { ThemeToggle } from '../components/ThemeToggle';
import { PostDetailModal } from '../components/PostDetailModal';
import { Logo } from '../components/Logo';
import FollowButton from '../components/FollowButton';
import Markdown from 'react-markdown';
import { useChat } from '../context/ChatContext';
import { getSuggestedUsers, unfollowUser } from '../lib/follow';

import { UserStatusDot } from '../components/UserStatusDot';

import { NotificationCenter } from '../components/NotificationCenter';

export default function Profile() {
  const { uid } = useParams();
  const { user: currentUser } = useAuth();
  const { startChat } = useChat();
  const navigate = useNavigate();
  const { addListener, removeListener } = useFirestoreListener();
  const targetUid = uid || currentUser?.uid;

  const [profile, setProfile] = useState<User | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [savedPosts, setSavedPosts] = useState<Post[]>([]);
  const [recordings, setRecordings] = useState<Recording[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingSaved, setLoadingSaved] = useState(false);
  const [loadingRecordings, setLoadingRecordings] = useState(false);
  const [activeTab, setActiveTab] = useState<'posts' | 'reels' | 'saved' | 'recordings' | 'tagged'>('posts');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({ displayName: '', bio: '', location: '', website: '', status: 'online' as User['status'] });
  const [uploading, setUploading] = useState(false);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);
  const [liveCounts, setLiveCounts] = useState<{ followers: number | null; following: number | null }>({
    followers: null,
    following: null
  });
  const [blockLoading, setBlockLoading] = useState(false);
  const [suggestedUsers, setSuggestedUsers] = useState<User[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [selectedStories, setSelectedStories] = useState<StoryType[] | null>(null);
  const [selectedHighlightTitle, setSelectedHighlightTitle] = useState<string | null>(null);
  const listenersSetupRef = useRef(false);

  // Reset ref when targetUid changes to allow re-setup
  useEffect(() => {
    listenersSetupRef.current = false;
    setLiveCounts({ followers: null, following: null });
  }, [targetUid]);

  useEffect(() => {
    if (!targetUid) return;

    // Set loading false immediately
    setLoading(false);

    // Prevent duplicate listeners
    if (listenersSetupRef.current) return;
    listenersSetupRef.current = true;

    // Fetch profile
    addListener({
      id: 'Profile-userProfile',
      query: doc(db, 'users', targetUid),
      context: 'Profile-userProfile',
      onNext: (docSnap) => {
        if (docSnap.exists()) {
          const userData = { uid: docSnap.id, ...docSnap.data() } as User;
          setProfile(userData);
          setEditForm({
            displayName: userData.displayName || '',
            bio: userData.bio || '',
            location: userData.location || '',
            website: userData.website || '',
            status: userData.status || 'online'
          });
        }
      },
      onError: (error) => {
        console.error('Error loading profile:', error);
      }
    });

    addListener({
      id: 'Profile-followers-count',
      query: collection(db, 'users', targetUid, 'followers'),
      context: 'Profile-followers-count',
      onNext: (snapshot) => {
        setLiveCounts((prev) => ({ ...prev, followers: snapshot.size }));
      },
      onError: (error) => {
        console.error('Error loading followers count:', error);
      }
    });

    addListener({
      id: 'Profile-following-count',
      query: collection(db, 'users', targetUid, 'following'),
      context: 'Profile-following-count',
      onNext: (snapshot) => {
        setLiveCounts((prev) => ({ ...prev, following: snapshot.size }));
      },
      onError: (error) => {
        console.error('Error loading following count:', error);
      }
    });

    // Check if following
    if (currentUser && currentUser.uid !== targetUid) {
      addListener({
        id: 'Profile-following',
        query: doc(db, 'users', currentUser.uid, 'following', targetUid),
        context: 'Profile-following',
        onNext: (docSnap) => {
          setIsFollowing(docSnap.exists());
        },
        onError: (error) => {
          console.error('Error checking follow status:', error);
        }
      });

      // Check if blocked
      addListener({
        id: 'Profile-blocked',
        query: doc(db, 'users', currentUser.uid, 'blockedUsers', targetUid),
        context: 'Profile-blocked',
        onNext: (docSnap) => {
          setIsBlocked(docSnap.exists());
        },
        onError: (error) => {
          console.error('Error checking block status:', error);
        }
      });
    }

    return () => {
      removeListener('Profile-userProfile');
      removeListener('Profile-followers-count');
      removeListener('Profile-following-count');
      removeListener('Profile-following');
      removeListener('Profile-blocked');
      listenersSetupRef.current = false;
    };
  }, [targetUid, currentUser, addListener, removeListener]);

  useEffect(() => {
    if (!currentUser?.uid) return;

    setLoadingSuggestions(true);
    getSuggestedUsers(currentUser.uid, 5)
      .then(setSuggestedUsers)
      .catch((error) => console.error('Error loading suggested users:', error))
      .finally(() => setLoadingSuggestions(false));
  }, [currentUser?.uid]);

  useEffect(() => {
    if (!targetUid) return;

    // Fetch user posts
    const q = query(
      collection(db, 'posts'),
      where('authorUid', '==', targetUid),
      orderBy('createdAt', 'desc')
    );

    addListener({
      id: 'Profile-posts',
      query: q,
      context: 'Profile-posts',
      onNext: (snapshot) => {
        const postsData = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
          id: doc.id,
          ...(doc.data() as Omit<Post, 'id'>)
        })) as Post[];
        setPosts(postsData);
      },
      onError: (error) => {
        console.error('Error loading posts:', error);
      }
    });

    return () => removeListener('Profile-posts');
  }, [targetUid, addListener, removeListener]);

  useEffect(() => {
    if (activeTab === 'saved' && currentUser && currentUser.uid === targetUid) {
      setLoadingSaved(true);
      const q = query(
        collection(db, 'users', currentUser.uid, 'savedPosts'),
        orderBy('savedAt', 'desc')
      );

      addListener({
        id: 'Profile-savedPosts',
        query: q,
        context: 'Profile-savedPosts',
        onNext: async (snapshot) => {
          const postIds = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => doc.data().postId as string);
          const postPromises = postIds.map((id: string) => getDoc(doc(db, 'posts', id)));
          try {
            const postSnaps = await Promise.all(postPromises);
            const postsData = postSnaps
              .filter(snap => snap.exists())
              .map(snap => ({ id: snap.id, ...snap.data() } as Post));
            
            setSavedPosts(postsData);
            setLoadingSaved(false);
          } catch (error) {
            console.error('Error loading saved posts:', error);
          }
        },
        onError: (error) => {
          console.error('Error loading saved posts:', error);
        }
      });
    } else {
      removeListener('Profile-savedPosts');
    }

    return () => removeListener('Profile-savedPosts');
  }, [activeTab, currentUser, targetUid, addListener, removeListener]);

  useEffect(() => {
    if (activeTab === 'recordings' && targetUid) {
      setLoadingRecordings(true);
      const q = query(
        collection(db, 'recordings'),
        where('userId', '==', targetUid),
        orderBy('createdAt', 'desc')
      );

      addListener({
        id: 'Profile-recordings',
        query: q,
        context: 'Profile-recordings',
        onNext: (snapshot) => {
          const recordingsData = snapshot.docs.map((doc: QueryDocumentSnapshot<DocumentData>) => ({
            id: doc.id,
            ...(doc.data() as Omit<Recording, 'id'>)
          })) as Recording[];
          setRecordings(recordingsData);
          setLoadingRecordings(false);
        },
        onError: (error) => {
          console.error('Error loading recordings:', error);
        }
      });
    } else {
      removeListener('Profile-recordings');
    }

    return () => removeListener('Profile-recordings');
  }, [activeTab, targetUid, addListener, removeListener]);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/login');
  };

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !currentUser) return;

    setUploading(true);
    try {
      const photoURL = await uploadToCloudinary(file, `profiles/${currentUser.uid}`);

      await updateDoc(doc(db, 'users', currentUser.uid), { photoURL });
      await updateProfile(auth.currentUser!, { photoURL });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'users', currentUser.uid), {
        ...editForm,
        updatedAt: serverTimestamp()
      });
      await updateProfile(auth.currentUser!, { displayName: editForm.displayName });
      setIsEditing(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!currentUser || !profile || blockLoading) return;
    setBlockLoading(true);

    const blockRef = doc(db, 'users', currentUser.uid, 'blockedUsers', profile.uid);
    try {
      if (isBlocked) {
        await deleteDoc(blockRef);
      } else {
        await setDoc(blockRef, { blockedUid: profile.uid, blockedAt: serverTimestamp() });
        if (isFollowing) await unfollowUser(currentUser.uid, profile.uid);
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `users/${currentUser.uid}/blockedUsers`);
    } finally {
      setBlockLoading(false);
    }
  };

  const handleDeletePost = async (postId: string) => {
    if (!window.confirm('Are you sure you want to delete this post?')) return;
    try {
      await deleteDoc(doc(db, 'posts', postId));
      setSelectedPost(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `posts/${postId}`);
    }
  };

  if (loading && !profile) {
    return (
      <div className="flex items-center justify-center h-screen bg-background">
        <Loader2 className="animate-spin text-accent" size={48} />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex flex-col items-center justify-center h-screen bg-background p-6 text-center">
        <ShieldAlert size={64} className="text-red-500 mb-4" />
        <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
        <p className="text-secondary mb-6">The profile you're looking for doesn't exist or has been removed.</p>
        <button onClick={() => navigate('/')} className="px-8 py-3 bg-accent text-white rounded-full font-bold">Go Home</button>
      </div>
    );
  }

  const isOwnProfile = currentUser?.uid === targetUid;
  const followersCount = liveCounts.followers ?? profile.followersCount ?? 0;
  const followingCount = liveCounts.following ?? profile.followingCount ?? 0;

  const handleHighlightClick = (stories: StoryType[], highlightTitle?: string) => {
    setSelectedStories(stories);
    setSelectedHighlightTitle(highlightTitle || null);
  };

  return (
    <div className="nexus-page">
      {/* Header / Cover Area */}
      <div className="relative h-44 overflow-hidden border-b border-border bg-[linear-gradient(135deg,#eaf4ff_0%,#fff7ed_48%,var(--color-background)_100%)] dark:bg-[linear-gradient(135deg,#102033_0%,#211a23_48%,var(--color-background)_100%)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-transparent to-transparent" />
        <div className="absolute left-4 top-5">
          <Logo variant="icon" size="sm" onClick={() => navigate('/')} />
        </div>
        <div className="absolute right-4 top-5 flex items-center gap-2">
          <NotificationCenter />
          <ThemeToggle />
          {isOwnProfile && (
            <button 
              onClick={() => navigate('/settings')} 
              className="nexus-icon-button border border-border bg-background/70 backdrop-blur-md hover:text-accent"
              title="Settings"
            >
              <Settings size={20} />
            </button>
          )}
          {isOwnProfile && (
            <button onClick={handleLogout} className="nexus-icon-button border border-border bg-background/70 backdrop-blur-md hover:bg-red-50 hover:text-red-500">
              <LogOut size={20} />
            </button>
          )}
        </div>
      </div>

      {/* Profile Info */}
      <div className="relative z-10 -mt-16 px-4">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-4">
            <div className="relative group">
              <div className="absolute -inset-1 rounded-full bg-gradient-to-tr from-accent via-fuchsia-500 to-amber-400 opacity-80 blur-[2px] transition-opacity group-hover:opacity-100" />
              <div className="relative h-32 w-32 overflow-hidden rounded-full border-4 border-background bg-background shadow-2xl">
                <img
                  src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}&background=random`}
                  alt={profile.displayName}
                  className="w-full h-full object-cover"
                />
                {!isOwnProfile && (
                  <UserStatusDot
                    user={profile}
                    className="absolute bottom-4 right-4 w-6 h-6 border-4"
                    size="lg"
                  />
                )}
                {isOwnProfile && (
                  <label className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer backdrop-blur-[2px]">
                    <Camera className="text-white" size={32} />
                    <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                  </label>
                )}
              </div>
              {uploading && (
                <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-full z-20">
                  <Loader2 className="animate-spin text-white" size={32} />
                </div>
              )}
            </div>

            <div>
              <div className="mb-1 flex items-center gap-2">
                <h1 className="min-w-0 truncate text-3xl font-black tracking-tight text-primary">{profile.displayName}</h1>
                {profile.role === 'admin' && <ShieldCheck className="text-accent" size={20} />}
              </div>
              <p className="mb-4 text-sm font-semibold text-secondary">@{profile.displayName?.toLowerCase().replace(/\s/g, '')}</p>
              
              <div className="grid grid-cols-3 rounded-2xl border border-border bg-surface p-3">
                <div className="text-center">
                  <p className="text-xl font-black text-primary">{posts.length}</p>
                  <p className="text-[10px] font-bold text-secondary">Posts</p>
                </div>
                <button 
                  onClick={() => navigate(`/profile/${profile.uid}/followers`)}
                  className="text-center transition-opacity hover:opacity-70"
                >
                  <p className="text-xl font-black text-primary">{followersCount}</p>
                  <p className="text-[10px] font-bold text-secondary">Followers</p>
                </button>
                <button 
                  onClick={() => navigate(`/profile/${profile.uid}/following`)}
                  className="text-center transition-opacity hover:opacity-70"
                >
                  <p className="text-xl font-black text-primary">{followingCount}</p>
                  <p className="text-[10px] font-bold text-secondary">Following</p>
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isOwnProfile ? (
              <button 
                onClick={() => setIsEditing(true)}
                className="nexus-primary-button flex-1 bg-accent text-white shadow-lg shadow-accent/20"
              >
                <Edit3 size={16} />
                <span>Edit Profile</span>
              </button>
            ) : (
              <>
                <FollowButton
                  targetUserId={profile.uid}
                  targetUserName={profile.displayName}
                  isPrivate={profile.isPrivate}
                  size="md"
                  onFollowChange={(isFollowing) => setIsFollowing(isFollowing)}
                />
                
                {/* Message Button */}
                <button
                  onClick={async () => {
                    const chatId = await startChat(profile.uid);
                    if (chatId) {
                      navigate(`/chats/${chatId}`);
                    }
                  }}
                  disabled={isBlocked}
                  className="nexus-soft-button flex-1"
                >
                  <MessageCircle size={16} />
                  <span>Message</span>
                </button>

                <button 
                  onClick={handleToggleBlock}
                  disabled={blockLoading}
                  className={`grid h-11 w-11 place-items-center rounded-full border transition-all active:scale-95 ${
                    isBlocked 
                      ? 'bg-red-500 border-red-500 text-white' 
                      : 'bg-surface border-border text-secondary hover:text-red-500 hover:border-red-500'
                  }`}
                >
                  {blockLoading ? <Loader2 size={18} className="animate-spin" /> : isBlocked ? <ShieldCheck size={18} /> : <ShieldAlert size={18} />}
                </button>
              </>
            )}
            <button className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface text-secondary transition-all hover:text-primary">
              <MoreVertical size={18} />
            </button>
          </div>
        </div>

        {/* Bio & Details */}
        <div className="mt-6 grid grid-cols-1 gap-5">
          <div className="space-y-5">
            <div className="rounded-2xl border border-border bg-surface/70 p-4 backdrop-blur-sm">
              <h3 className="mb-3 text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">Bio</h3>
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <Markdown>{profile.bio || "No bio yet."}</Markdown>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {profile.location && (
                <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-secondary">
                  <MapPin size={14} className="text-accent" />
                  <span>{profile.location}</span>
                </div>
              )}
              {profile.website && (
                <a 
                  href={profile.website.startsWith('http') ? profile.website : `https://${profile.website}`} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-accent transition-all hover:bg-accent/5"
                >
                  <LinkIcon size={14} />
                  <span>{profile.website.replace(/^https?:\/\//, '')}</span>
                </a>
              )}
              <div className="flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-2 text-xs font-semibold text-secondary">
                <Calendar size={14} className="text-accent" />
                <span>Joined {profile.createdAt && typeof profile.createdAt.toDate === 'function' ? format(profile.createdAt.toDate(), 'MMMM yyyy') : 'Recently'}</span>
              </div>
            </div>

            {isOwnProfile && (loadingSuggestions || suggestedUsers.length > 0) && (
              <section className="rounded-2xl border border-border bg-surface/70 p-4">
                <div className="mb-3 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-accent" />
                    <h3 className="text-[10px] font-bold uppercase tracking-[0.18em] text-secondary">People you may know</h3>
                  </div>
                  <button
                    onClick={() => navigate('/search')}
                    className="text-[10px] font-black text-accent"
                  >
                    See all
                  </button>
                </div>

                {loadingSuggestions ? (
                  <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {[1, 2, 3].map((item) => (
                      <div key={item} className="h-28 min-w-[150px] rounded-xl bg-background/70 animate-pulse" />
                    ))}
                  </div>
                ) : (
                  <div className="flex gap-3 overflow-x-auto pb-1 no-scrollbar">
                    {suggestedUsers.map((user) => (
                      <div key={user.uid} className="min-w-[170px] rounded-xl border border-border bg-background p-3">
                        <button
                          onClick={() => navigate(`/profile/${user.uid}`)}
                          className="mb-3 flex w-full items-center gap-3 text-left"
                        >
                          <img
                            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
                            alt={user.displayName}
                            className="h-10 w-10 rounded-full object-cover"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-sm font-black text-primary">{user.displayName}</p>
                            <p className="text-[10px] font-semibold text-secondary">{user.followersCount || 0} followers</p>
                          </div>
                        </button>
                        <FollowButton
                          targetUserId={user.uid}
                          targetUserName={user.displayName}
                          isPrivate={user.isPrivate}
                          size="sm"
                          className="w-full justify-center"
                          onFollowChange={(nowFollowing) => {
                            if (nowFollowing) {
                              setSuggestedUsers((prev) => prev.filter((suggested) => suggested.uid !== user.uid));
                            }
                          }}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          <div className="space-y-6">
            <HighlightSection 
              userId={targetUid ?? ''} 
              isOwnProfile={isOwnProfile} 
              onHighlightClick={(stories, title) => handleHighlightClick(stories, title)} 
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="mt-8 border-b border-border">
          <div className="flex items-center justify-around overflow-x-auto no-scrollbar">
            {[
              { id: 'posts', icon: Grid, label: 'Posts' },
              { id: 'reels', icon: Play, label: 'Reels' },
              { id: 'recordings', icon: Video, label: 'Meets' },
              { id: 'saved', icon: Bookmark, label: 'Saved', hide: !isOwnProfile },
              { id: 'tagged', icon: Tag, label: 'Tagged' }
            ].filter(tab => !tab.hide).map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`relative flex min-w-[64px] items-center justify-center gap-1.5 border-b-2 py-4 transition-all ${
                  activeTab === tab.id 
                    ? 'border-accent text-accent' 
                    : 'border-transparent text-secondary hover:text-primary'
                }`}
              >
                <tab.icon size={18} />
                <span className="text-[10px] font-bold">{tab.label}</span>
                {activeTab === tab.id && (
                  <motion.div 
                    layoutId="activeTab"
                    className="absolute -bottom-[2px] left-0 right-0 h-0.5 bg-accent shadow-[0_0_10px_rgba(var(--accent-rgb),0.5)]" 
                  />
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Content Grid */}
        <div className="mt-4">
          {activeTab === 'posts' && (
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
              {posts.map(post => (
                <motion.div
                  key={post.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedPost(post)}
                  className="relative aspect-square rounded-xl sm:rounded-3xl overflow-hidden cursor-pointer group border border-border shadow-sm"
                >
                  {post.mediaUrl ? (
                    <>
                      {post.mediaType === 'video' ? (
                        <div className="w-full h-full relative">
                          <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
                          <div className="absolute top-3 right-3 p-1.5 bg-black/40 backdrop-blur-md rounded-lg text-white">
                            <Play size={14} fill="currentColor" />
                          </div>
                        </div>
                      ) : (
                        <img src={post.mediaUrl} alt="Post" className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" referrerPolicy="no-referrer" />
                      )}
                    </>
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center p-4 text-center">
                      <p className="text-[10px] font-medium line-clamp-4">{post.content}</p>
                    </div>
                  )}
                  <div className="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-all backdrop-blur-[2px]">
                    <div className="flex items-center space-x-6 text-white">
                      <div className="flex items-center space-x-2">
                        <Heart size={20} fill="currentColor" />
                        <span className="font-black text-sm">{post.likesCount}</span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <MessageCircle size={20} fill="currentColor" />
                        <span className="font-black text-sm">{post.commentsCount}</span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
              {posts.length === 0 && (
                <div className="col-span-3 text-center py-20 bg-surface/30 rounded-[3rem] border border-dashed border-border">
                  <div className="w-20 h-20 bg-background rounded-[2rem] flex items-center justify-center mx-auto mb-6 border border-border shadow-sm">
                    <Grid size={32} className="text-zinc-200" />
                  </div>
                  <h4 className="text-lg font-bold mb-2">No posts yet</h4>
                  <p className="text-sm text-secondary">When {profile.displayName} shares something, it will appear here.</p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'saved' && (
            <div className="grid grid-cols-3 gap-1 sm:gap-4">
              {loadingSaved ? (
                [1, 2, 3].map(i => <div key={i} className="aspect-square bg-surface animate-pulse rounded-3xl" />)
              ) : savedPosts.map(post => (
                <motion.div
                  key={post.id}
                  whileHover={{ y: -4 }}
                  onClick={() => setSelectedPost(post)}
                  className="relative aspect-square rounded-xl sm:rounded-3xl overflow-hidden cursor-pointer group border border-border"
                >
                  {post.mediaUrl ? (
                    <img src={post.mediaUrl} alt="Post" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <div className="w-full h-full bg-surface flex items-center justify-center p-4 text-center">
                      <p className="text-[10px] font-medium line-clamp-4">{post.content}</p>
                    </div>
                  )}
                </motion.div>
              ))}
            </div>
          )}

          {activeTab === 'recordings' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {loadingRecordings ? (
                [1, 2].map(i => <div key={i} className="h-48 bg-surface animate-pulse rounded-3xl" />)
              ) : recordings.map(rec => (
                <motion.div
                  key={rec.id}
                  whileHover={{ y: -4 }}
                  className="bg-surface border border-border rounded-[2rem] overflow-hidden group shadow-sm"
                >
                  <div className="aspect-video bg-black relative">
                    <video src={rec.url} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 transition-opacity" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="w-12 h-12 bg-accent text-white rounded-full flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                        <Play size={24} fill="currentColor" />
                      </div>
                    </div>
                  </div>
                  <div className="p-6">
                    <h4 className="font-black text-sm mb-1 truncate">Meeting Recording</h4>
                    <p className="text-[10px] font-black text-secondary uppercase tracking-widest">
                      {rec.createdAt ? format(rec.createdAt.toDate(), 'MMM d, yyyy') : 'Recently'}
                    </p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit Profile Modal */}
      <AnimatePresence>
        {isEditing && (
          <div className="fixed inset-5 z-[100] flex items-center justify-center px-3 py-3 bg-black/70 backdrop-blur-x0">
            <motion.div
              initial={{ opacity: 0, y: 100 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 100 }}
              className="bg-background w-full max-w-[92vw] sm:max-w-[360px] mx-auto min-h-[calc(100vh-5rem)] max-h-[calc(100vh-3rem)] rounded-[2rem] border border-border shadow-2xl overflow-y-auto custom-scrollbar-thin custom-scrollbar-thumb-surface/50 custom-scrollbar-track-transparent"
            >
              <div className="sticky top-0 z-10 bg-background/80 backdrop-blur-md px-5 py-4 border-b border-border flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black tracking-tight">Edit Profile</h2>
                </div>
                <button onClick={() => setIsEditing(false)} className="p-1.5 hover:bg-surface rounded-xl transition-all flex-shrink-0">
                  <X size={18} />
                </button>
              </div>
              
              <div className="p-5 space-y-4">
                {/* Profile Picture Preview in Edit */}
                <div className="flex flex-col items-center space-y-2">
                  <div className="relative group">
                    <div className="absolute -inset-0.5 bg-gradient-to-tr from-accent to-purple-500 rounded-2xl blur-[1px] opacity-60" />
                    <div className="relative w-20 h-20 rounded-2xl bg-background border-3 border-background overflow-hidden shadow-lg">
                      <img 
                        src={profile.photoURL || `https://ui-avatars.com/api/?name=${profile.displayName}&background=random`} 
                        alt={profile.displayName} 
                        className="w-full h-full object-cover"
                      />
                      <label className="absolute inset-0 bg-black/40 flex items-center justify-center cursor-pointer backdrop-blur-[2px] opacity-0 hover:opacity-100 transition-opacity">
                        <Camera className="text-white" size={14} />
                        <input type="file" className="hidden" accept="image/*" onChange={handlePhotoUpload} />
                      </label>
                    </div>
                    {uploading && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-2xl z-20">
                        <Loader2 className="animate-spin text-white" size={14} />
                      </div>
                    )}
                  </div>
                  <p className="text-[8px] font-black text-secondary uppercase tracking-widest">Tap to change</p>
                </div>

                <form onSubmit={handleUpdateProfile} className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-secondary uppercase tracking-[0.1em]">Display Name</label>
                    <input
                      type="text"
                      value={editForm.displayName}
                      onChange={(e) => setEditForm({ ...editForm, displayName: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                      required
                      placeholder="Your name"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-secondary uppercase tracking-[0.1em]">Bio</label>
                    <textarea
                      value={editForm.bio}
                      onChange={(e) => setEditForm({ ...editForm, bio: e.target.value })}
                      className="w-full bg-surface border border-border rounded-lg p-3 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none h-20"
                      placeholder="Tell about yourself..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-secondary uppercase tracking-[0.1em]">Location</label>
                      <input
                        type="text"
                        value={editForm.location}
                        onChange={(e) => setEditForm({ ...editForm, location: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        placeholder="City, Country"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black text-secondary uppercase tracking-[0.1em]">Website</label>
                      <input
                        type="text"
                        value={editForm.website}
                        onChange={(e) => setEditForm({ ...editForm, website: e.target.value })}
                        className="w-full bg-surface border border-border rounded-lg px-3.5 py-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                        placeholder="URL"
                      />
                    </div>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[8px] font-black text-secondary uppercase tracking-[0.1em]">Status</label>
                    <div className="flex gap-1.5">
                      {(['online', 'away', 'busy'] as const).map((status) => (
                        <button
                          key={status}
                          type="button"
                          onClick={() => setEditForm({ ...editForm, status })}
                          className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-2 rounded-lg border text-[7px] font-bold transition-all ${
                            editForm.status === status
                              ? 'bg-accent/10 border-accent text-accent shadow-sm'
                              : 'bg-surface border-border text-secondary hover:border-accent/30'
                          }`}
                        >
                          <div className={`w-1.5 h-1.5 rounded-full ${
                            status === 'online' ? 'bg-green-500' :
                            status === 'away' ? 'bg-yellow-500' : 'bg-red-500'
                          }`} />
                          <span className="capitalize">{status}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="flex gap-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setIsEditing(false)}
                      className="flex-1 py-2.5 border border-border rounded-lg text-[8px] font-black uppercase tracking-widest text-secondary hover:bg-surface transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={loading}
                      className="flex-1 py-2.5 bg-accent text-white rounded-lg text-[8px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
                    >
                      {loading ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedPost && (
          <PostDetailModal
            post={selectedPost}
            isOpen={!!selectedPost}
            onClose={() => setSelectedPost(null)}
            onDelete={handleDeletePost}
          />
        )}
        {selectedStories && selectedHighlightTitle ? (
          <HighlightViewer
            stories={selectedStories}
            isOpen={!!selectedStories}
            onClose={() => {
              setSelectedStories(null);
              setSelectedHighlightTitle(null);
            }}
            highlightTitle={selectedHighlightTitle}
          />
        ) : selectedStories && (
          <StoryViewer
            stories={selectedStories}
            isOpen={!!selectedStories}
            onClose={() => setSelectedStories(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
