import React, { useState, useEffect } from 'react';
import { collection, query, where, getDocs, limit, orderBy, Timestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { User, Post, Group } from '../types';
import { Search as SearchIcon, Users, MessageSquare, Hash, User as UserIcon, ArrowRight, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { UserStatusDot } from '../components/UserStatusDot';

type SearchTab = 'all' | 'users' | 'posts' | 'groups';

export default function Search() {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>('all');
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<{
    users: User[];
    posts: Post[];
    groups: Group[];
  }>({ users: [], posts: [], groups: [] });
  
  const navigate = useNavigate();

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        performSearch();
      } else if (searchQuery.trim().length === 0) {
        setResults({ users: [], posts: [], groups: [] });
      }
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [searchQuery]);

  const performSearch = async () => {
    setLoading(true);
    const q = searchQuery.toLowerCase().trim();
    
    try {
      // In a real production app, we would use Algolia or a similar search service.
      // For this implementation, we'll fetch the most recent items and filter client-side
      // to provide a smooth, case-insensitive search experience.
      
      const [usersSnap, groupsSnap, postsSnap] = await Promise.all([
        getDocs(query(collection(db, 'users'), limit(100))),
        getDocs(query(collection(db, 'groups'), limit(100))),
        getDocs(query(collection(db, 'posts'), orderBy('createdAt', 'desc'), limit(100)))
      ]);

      const users = usersSnap.docs
        .map(doc => ({ uid: doc.id, ...doc.data() } as User))
        .filter(u => u.displayName.toLowerCase().includes(q) || u.email.toLowerCase().includes(q));

      const groups = groupsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Group))
        .filter(g => g.name.toLowerCase().includes(q) || g.description?.toLowerCase().includes(q));

      const posts = postsSnap.docs
        .map(doc => ({ id: doc.id, ...doc.data() } as Post))
        .filter(p => p.content.toLowerCase().includes(q) || p.tags?.some(t => t.toLowerCase().includes(q)));

      setResults({ users, posts, groups });
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'search');
    } finally {
      setLoading(false);
    }
  };

  const renderUser = (user: User) => (
    <motion.div
      key={user.uid}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate(`/profile/${user.uid}`)}
      className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl hover:border-accent transition-all cursor-pointer group"
    >
      <div className="flex items-center space-x-4">
        <div className="relative">
          <img
            src={user.photoURL || `https://ui-avatars.com/api/?name=${user.displayName}&background=random`}
            alt={user.displayName}
            className="w-12 h-12 rounded-full object-cover"
          />
          <UserStatusDot 
            user={user} 
            className="absolute bottom-0 right-0 w-3.5 h-3.5 border-2" 
            size="sm"
          />
        </div>
        <div>
          <h3 className="font-bold text-primary">{user.displayName}</h3>
          <p className="text-xs text-secondary font-medium">{user.followersCount} followers</p>
        </div>
      </div>
      <ArrowRight size={18} className="text-zinc-300 group-hover:text-accent transition-colors" />
    </motion.div>
  );

  const renderGroup = (group: Group) => (
    <motion.div
      key={group.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/groups')} // Groups page handles selection
      className="flex items-center justify-between p-4 bg-background border border-border rounded-2xl hover:border-accent transition-all cursor-pointer group"
    >
      <div className="flex items-center space-x-4">
        <div className="w-12 h-12 bg-surface rounded-full flex items-center justify-center border border-border">
          <Users size={24} className="text-accent" />
        </div>
        <div>
          <h3 className="font-bold text-primary">{group.name}</h3>
          <p className="text-xs text-secondary font-medium line-clamp-1">{group.membersCount} members • {group.description}</p>
        </div>
      </div>
      <ArrowRight size={18} className="text-zinc-300 group-hover:text-accent transition-colors" />
    </motion.div>
  );

  const renderPost = (post: Post) => (
    <motion.div
      key={post.id}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      onClick={() => navigate('/')} // Feed page handles posts
      className="p-4 bg-background border border-border rounded-2xl hover:border-accent transition-all cursor-pointer group"
    >
      <div className="flex items-center space-x-3 mb-3">
        <img
          src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`}
          alt={post.authorName}
          className="w-8 h-8 rounded-full object-cover"
        />
        <span className="text-xs font-bold text-primary">{post.authorName}</span>
      </div>
      <p className="text-sm text-secondary line-clamp-2 mb-3">{post.content}</p>
      <div className="flex items-center space-x-4 text-[10px] font-bold text-zinc-400 uppercase tracking-widest">
        <span>{post.likesCount} likes</span>
        <span>{post.commentsCount} comments</span>
      </div>
    </motion.div>
  );

  const hasResults = results.users.length > 0 || results.posts.length > 0 || results.groups.length > 0;

  return (
    <div className="max-w-2xl mx-auto px-4 pt-8 pb-20">
      <div className="mb-8">
        <h1 className="text-3xl font-black tracking-tight mb-2">Search</h1>
        <p className="text-xs text-secondary font-bold uppercase tracking-widest">Find people, posts, and communities</p>
      </div>

      <div className="relative mb-6">
        <SearchIcon className="absolute left-4 top-4 text-zinc-400" size={20} />
        <input
          type="text"
          placeholder="Search Nexus Social..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-4 py-4 bg-background border border-border rounded-[2rem] text-sm shadow-xl shadow-zinc-200/50 dark:shadow-none focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          autoFocus
        />
        {loading && (
          <div className="absolute right-4 top-4">
            <Loader2 size={20} className="text-accent animate-spin" />
          </div>
        )}
      </div>

      <div className="flex items-center space-x-2 mb-8 overflow-x-auto pb-2 no-scrollbar">
        {(['all', 'users', 'posts', 'groups'] as SearchTab[]).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-6 py-2 rounded-full text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab 
                ? 'bg-accent text-white shadow-lg shadow-accent/20' 
                : 'bg-background text-secondary border border-border hover:bg-surface'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      <div className="space-y-8">
        <AnimatePresence mode="wait">
          {!searchQuery ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-background border border-border rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <SearchIcon size={32} className="text-zinc-300" />
              </div>
              <h2 className="text-xl font-bold mb-2">Start Searching</h2>
              <p className="text-sm text-secondary max-w-xs mx-auto">Enter a name, keyword, or community to explore the platform.</p>
            </motion.div>
          ) : loading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="h-24 bg-background border border-border rounded-2xl animate-pulse" />
              ))}
            </div>
          ) : !hasResults ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-20"
            >
              <div className="w-20 h-20 bg-background border border-border rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
                <Hash size={32} className="text-zinc-300" />
              </div>
              <h2 className="text-xl font-bold mb-2">No results found</h2>
              <p className="text-sm text-secondary max-w-xs mx-auto">We couldn't find anything matching "{searchQuery}". Try a different term.</p>
            </motion.div>
          ) : (
            <div className="space-y-8">
              {/* Users Section */}
              {(activeTab === 'all' || activeTab === 'users') && results.users.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center">
                      <UserIcon size={14} className="mr-2" />
                      People
                    </h2>
                    <span className="text-[10px] font-bold text-zinc-400">{results.users.length} found</span>
                  </div>
                  <div className="grid gap-3">
                    {results.users.map(renderUser)}
                  </div>
                </section>
              )}

              {/* Groups Section */}
              {(activeTab === 'all' || activeTab === 'groups') && results.groups.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center">
                      <Users size={14} className="mr-2" />
                      Communities
                    </h2>
                    <span className="text-[10px] font-bold text-zinc-400">{results.groups.length} found</span>
                  </div>
                  <div className="grid gap-3">
                    {results.groups.map(renderGroup)}
                  </div>
                </section>
              )}

              {/* Posts Section */}
              {(activeTab === 'all' || activeTab === 'posts') && results.posts.length > 0 && (
                <section>
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-black text-secondary uppercase tracking-widest flex items-center">
                      <MessageSquare size={14} className="mr-2" />
                      Posts
                    </h2>
                    <span className="text-[10px] font-bold text-zinc-400">{results.posts.length} found</span>
                  </div>
                  <div className="grid gap-4">
                    {results.posts.map(renderPost)}
                  </div>
                </section>
              )}
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
