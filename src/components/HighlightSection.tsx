import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp, doc, getDoc, Timestamp, where, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { Highlight, Story } from '../types';
import { useAuth } from '../context/AuthContext';
import { Plus, Camera, X, Check, MoreVertical, Trash2, Edit3 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface HighlightSectionProps {
  userId: string;
  isOwnProfile: boolean;
  onHighlightClick: (stories: Story[], title?: string) => void;
}

export const HighlightSection: React.FC<HighlightSectionProps> = ({ userId, isOwnProfile, onHighlightClick }) => {
  const { user } = useAuth();
  const [highlights, setHighlights] = useState<Highlight[]>([]);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [activeMenu, setActiveMenu] = useState<string | null>(null);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (activeMenu && !(e.target as HTMLElement).closest('.highlight-menu')) {
        setActiveMenu(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [activeMenu]);

  useEffect(() => {
    const q = query(
      collection(db, 'users', userId, 'highlights'),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const highlightsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Highlight[];
      setHighlights(highlightsData);
    });

    return () => unsubscribe();
  }, [userId]);

  const handleHighlightClick = async (highlight: Highlight) => {
    const storyPromises = highlight.storyIds.map(id => getDoc(doc(db, 'stories', id)));
    const storySnaps = await Promise.all(storyPromises);
    const stories = storySnaps
      .filter(snap => snap.exists())
      .map(snap => ({ id: snap.id, ...snap.data() } as Story));

    if (stories.length > 0) {
      onHighlightClick(stories, highlight.title);
    }
  };

  const handleDeleteHighlight = async (highlightId: string) => {
    if (!window.confirm('Are you sure you want to delete this highlight?')) return;
    try {
      await deleteDoc(doc(db, 'users', userId, 'highlights', highlightId));
      setActiveMenu(null);
    } catch (error) {
      // Error deleting highlight
    }
  };

  return (
    <div className="flex items-center space-x-6 py-8 overflow-x-auto custom-scrollbar">
      <button
        onClick={() => setIsCreateModalOpen(true)}
        className="flex flex-col items-center space-y-2 flex-shrink-0 group cursor-pointer"
      >
        <div className="w-16 h-16 md:w-20 md:h-20 rounded-full bg-gradient-to-br from-accent to-purple-600 flex items-center justify-center shadow-lg shadow-accent/30 group-hover:shadow-xl group-hover:shadow-accent/40 transition-all transform group-hover:scale-105">
          <Plus size={24} className="text-white" />
        </div>
        <span className="text-xs font-black text-primary group-hover:text-accent transition-colors">New</span>
      </button>

      {highlights.map(highlight => (
        <div key={highlight.id} className="flex flex-col items-center space-y-2 flex-shrink-0 relative">
          <div className="relative">
            <button
              onClick={() => handleHighlightClick(highlight)}
              className="flex flex-col items-center space-y-2"
            >
              <div className="w-16 h-16 md:w-20 md:h-20 rounded-full border border-border p-1 overflow-hidden">
                <img
                  src={highlight.coverUrl || `https://picsum.photos/seed/${highlight.id}/200`}
                  alt={highlight.title}
                  className="w-full h-full rounded-full object-cover"
                />
              </div>
              <span className="text-xs font-medium text-primary truncate w-20 text-center">
                {highlight.title}
              </span>
            </button>
            {isOwnProfile && (
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setActiveMenu(activeMenu === highlight.id ? null : highlight.id);
                }}
                className="absolute -top-1 -right-1 w-6 h-6 bg-accent text-white rounded-full flex items-center justify-center shadow-lg z-10"
              >
                <MoreVertical size={12} />
              </button>
            )}
            {isOwnProfile && activeMenu === highlight.id && (
              <div className="highlight-menu absolute top-8 right-0 bg-background border border-border rounded-xl shadow-xl z-20 py-2 min-w-[120px]">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteHighlight(highlight.id);
                  }}
                  className="w-full px-4 py-2 text-left text-xs text-red-500 hover:bg-red-50 flex items-center space-x-2"
                >
                  <Trash2 size={14} />
                  <span>Delete</span>
                </button>
              </div>
            )}
          </div>
        </div>
      ))}

      <AnimatePresence>
        <CreateHighlightModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          userId={userId}
        />
      </AnimatePresence>
    </div>
  );
};

const CreateHighlightModal = ({ isOpen, onClose, userId }: { isOpen: boolean, onClose: () => void, userId: string }) => {
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;

    const q = query(
      collection(db, 'stories'),
      where('authorUid', '==', userId),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const storiesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Story[];
      setStories(storiesData);
    });

    return () => unsubscribe();
  }, [isOpen, userId]);

  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  const handleToggle = (id: string) => {
    setSelectedIds(prev =>
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const handleCreate = async () => {
    if (!title.trim() || selectedIds.length === 0) return;

    setLoading(true);
    try {
      const coverUrl = stories.find(s => s.id === selectedIds[0])?.mediaUrl;

      await addDoc(collection(db, 'users', userId, 'highlights'), {
        userId,
        title: title.trim(),
        coverUrl,
        storyIds: selectedIds,
        createdAt: serverTimestamp()
      });
      onClose();
      setTitle('');
      setSelectedIds([]);
    } catch (error) {
      alert('Failed to create highlight. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-black/60 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.95, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.95, opacity: 0, y: 20 }}
        className="bg-background w-full max-w-2xl rounded-[2rem] shadow-2xl flex flex-col max-h-[90vh] border border-border/50 overflow-hidden"
      >
        <div className="flex items-center justify-between p-5 sm:p-6 border-b border-border flex-shrink-0">
          <h2 className="text-xl sm:text-2xl font-black tracking-tight text-primary bg-gradient-to-r from-accent to-purple-600 bg-clip-text text-transparent">Create Highlight</h2>
          <button onClick={onClose} className="p-2.5 hover:bg-surface rounded-full transition-all active:scale-90 flex-shrink-0">
            <X size={24} className="text-secondary" />
          </button>
        </div>

        <div className="p-5 sm:p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          <div>
            <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-2">Highlight Name</label>
            <input
              type="text"
              placeholder="Enter a name for your highlight..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full bg-surface/50 backdrop-blur border border-border rounded-2xl px-5 py-4 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all placeholder:text-secondary/40"
            />
          </div>

          <div className="pb-4">
            <label className="block text-xs font-black text-secondary uppercase tracking-widest mb-3">Select Stories ({selectedIds.length} selected)</label>
            {stories.length === 0 ? (
              <div className="text-center py-12 bg-surface/30 rounded-2xl border border-dashed border-border">
                <Camera size={48} className="text-secondary/40 mx-auto mb-4" />
                <p className="text-secondary font-medium">No stories available</p>
                <p className="text-secondary/60 text-sm mt-1">Create some stories first to add them to highlights</p>
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 sm:gap-3">
                {stories.map(story => (
                  <div
                    key={story.id}
                    onClick={() => handleToggle(story.id)}
                    className="relative aspect-[9/16] rounded-2xl overflow-hidden cursor-pointer group transform transition-all hover:scale-105"
                  >
                    {story.mediaType === 'video' ? (
                      <video src={story.mediaUrl} className="w-full h-full object-cover" muted />
                    ) : (
                      <img src={story.mediaUrl} alt="Story" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    )}
                    <div className={`absolute inset-0 transition-all ${selectedIds.includes(story.id) ? 'bg-accent/30' : 'bg-black/0 group-hover:bg-black/20'}`} />
                    <div className={`absolute top-2 right-2 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center transition-all ${selectedIds.includes(story.id) ? 'bg-accent scale-110 shadow-lg shadow-accent/50' : 'bg-black/40'}`}>
                      {selectedIds.includes(story.id) && <Check size={14} className="text-white" />}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="p-5 sm:p-6 border-t border-border flex-shrink-0 bg-background">
          <button
            onClick={handleCreate}
            disabled={loading || !title.trim() || selectedIds.length === 0}
            className="w-full py-4 bg-gradient-to-r from-accent to-purple-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:shadow-lg hover:shadow-accent/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.98]"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Creating...
              </span>
            ) : (
              'Create Highlight'
            )}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
