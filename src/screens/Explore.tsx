import React, { useState, useEffect } from 'react';
import { Search, TrendingUp, Hash, Grid, List } from 'lucide-react';
import { collection, query, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Post } from '../types';
import { PostInteractions } from '../components/PostInteractions';

export const Explore: React.FC = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [activeCategory, setActiveCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All', icon: Grid },
    { id: 'trending', name: 'Trending', icon: TrendingUp },
    { id: 'popular', name: 'Popular', icon: Hash },
  ];

  useEffect(() => {
    loadPosts();
  }, []);

  const loadPosts = async () => {
    try {
      // Query posts ordered by likes count (trending)
      const postsQuery = query(
        collection(db, 'posts'),
        orderBy('likesCount', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(postsQuery);
      const postsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Post[];
      setPosts(postsData);
    } catch (error) {
      console.error('Error loading posts:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredPosts = posts.filter(post => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      post.content?.toLowerCase().includes(query) ||
      post.authorName?.toLowerCase().includes(query) ||
      post.tags?.some(tag => tag.toLowerCase().includes(query))
    );
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-700">
        <div className="relative mb-4">
          <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search posts, users, tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 bg-gray-100 dark:bg-gray-800 rounded-lg text-gray-900 dark:text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Categories */}
        <div className="flex gap-2 overflow-x-auto pb-2">
          {categories.map((category) => {
            const Icon = category.icon;
            return (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full font-medium transition-colors whitespace-nowrap ${
                  activeCategory === category.id
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700'
                }`}
              >
                <Icon size={16} />
                {category.name}
              </button>
            );
          })}
        </div>
      </div>

      {/* View Mode Toggle */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-700">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {filteredPosts.length} posts
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setViewMode('grid')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'grid'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <Grid size={18} />
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={`p-2 rounded-lg transition-colors ${
              viewMode === 'list'
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400'
            }`}
          >
            <List size={18} />
          </button>
        </div>
      </div>

      {/* Posts Grid */}
      <div className="flex-1 overflow-y-auto p-4">
        {filteredPosts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <Search size={48} className="mb-4 opacity-50" />
            <p className="text-lg">No posts found</p>
            <p className="text-sm">Try searching for something else</p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="relative aspect-square bg-gray-100 dark:bg-gray-800 rounded-lg overflow-hidden cursor-pointer group"
              >
                {post.mediaUrl ? (
                  <img
                    src={post.mediaUrl}
                    alt={post.content}
                    className="w-full h-full object-cover transition-transform group-hover:scale-105"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center p-4">
                    <p className="text-sm text-gray-600 dark:text-gray-400 line-clamp-4">
                      {post.content}
                    </p>
                  </div>
                )}
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-4 text-white">
                  <div className="flex items-center gap-1">
                    <span className="font-bold">{post.likesCount}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="font-bold">{post.commentsCount}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPosts.map((post) => (
              <div
                key={post.id}
                className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden"
              >
                {/* Post Header */}
                <div className="flex items-center gap-3 p-4 border-b border-gray-200 dark:border-gray-700">
                  <img
                    src={post.authorPhoto || `https://ui-avatars.com/api/?name=${post.authorName}&background=random`}
                    alt={post.authorName}
                    className="w-10 h-10 rounded-full object-cover"
                  />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{post.authorName}</h3>
                    <p className="text-xs text-gray-500 dark:text-gray-400">
                      {post.createdAt?.toDate().toLocaleDateString()}
                    </p>
                  </div>
                </div>

                {/* Post Content */}
                {post.mediaUrl && (
                  <img
                    src={post.mediaUrl}
                    alt={post.content}
                    className="w-full max-h-96 object-cover"
                  />
                )}
                {post.content && (
                  <div className="p-4">
                    <p className="text-gray-900 dark:text-white">{post.content}</p>
                  </div>
                )}

                {/* Post Interactions */}
                <PostInteractions
                  postId={post.id}
                  initialLikesCount={post.likesCount}
                  initialCommentsCount={post.commentsCount}
                  authorName={post.authorName}
                  authorPhoto={post.authorPhoto}
                />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
