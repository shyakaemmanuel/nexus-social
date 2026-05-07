import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Plus, Image as ImageIcon, FolderPlus, Check } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, updateDoc, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { uploadToCloudinary } from '../lib/cloudinary';
import { Story } from '../types';

interface CreateHighlightModalProps {
  isOpen: boolean;
  onClose: () => void;
  onHighlightCreated?: () => void;
}

export const CreateHighlightModal: React.FC<CreateHighlightModalProps> = ({ isOpen, onClose, onHighlightCreated }) => {
  const { user } = useAuth();
  const [title, setTitle] = useState('');
  const [coverImage, setCoverImage] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState<string>('');
  const [selectedStories, setSelectedStories] = useState<Story[]>([]);
  const [userStories, setUserStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<'info' | 'stories' | 'cover'>('info');

  React.useEffect(() => {
    if (!isOpen || !user) return;

    const fetchUserStories = async () => {
      try {
        const q = query(
          collection(db, 'stories'),
          where('authorUid', '==', user.uid),
          orderBy('createdAt', 'desc')
        );
        const snapshot = await getDocs(q);
        const stories = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Story[];
        setUserStories(stories);
      } catch (error) {
        console.error('Error fetching stories:', error);
      }
    };

    fetchUserStories();
  }, [isOpen, user]);

  const handleCoverSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setCoverImage(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setCoverPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateHighlight = async () => {
    if (!user || !title.trim()) return;
    if (selectedStories.length === 0) return;

    setLoading(true);
    try {
      let coverUrl = '';
      if (coverImage) {
        coverUrl = await uploadToCloudinary(coverImage, `highlights/${user.uid}`);
      } else if (selectedStories.length > 0) {
        coverUrl = selectedStories[0].mediaUrl || '';
      }

      // Get the highest order number
      const highlightsQuery = query(collection(db, 'users', user.uid, 'highlights'));
      const highlightsSnapshot = await getDocs(highlightsQuery);
      const maxOrder = highlightsSnapshot.docs.reduce((max, doc) => Math.max(max, doc.data().order || 0), 0);

      await addDoc(collection(db, 'users', user.uid, 'highlights'), {
        title: title.trim(),
        coverUrl: coverUrl,
        storyIds: selectedStories.map(s => s.id),
        createdAt: serverTimestamp(),
        order: maxOrder + 1
      });

      onHighlightCreated?.();
      handleClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'highlights');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTitle('');
    setCoverImage(null);
    setCoverPreview('');
    setSelectedStories([]);
    setUserStories([]);
    setStep('info');
    onClose();
  };

  const toggleStorySelection = (story: Story) => {
    setSelectedStories(prev => {
      const isSelected = prev.some(s => s.id === story.id);
      if (isSelected) {
        return prev.filter(s => s.id !== story.id);
      } else {
        return [...prev, story];
      }
    });
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/80 backdrop-blur-xl">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        className="bg-background w-full max-w-lg rounded-[2rem] overflow-hidden shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-border">
          <h2 className="text-xl font-bold text-primary">Create Highlight</h2>
          <button onClick={handleClose} className="p-2 hover:bg-surface rounded-full transition-colors">
            <X size={24} className="text-primary" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          {step === 'info' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-primary mb-2">Highlight Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Travel, Food, Memories"
                  className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
                  maxLength={30}
                />
              </div>

              <button
                onClick={() => setStep('stories')}
                disabled={!title.trim()}
                className="w-full py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            </div>
          )}

          {step === 'stories' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-primary mb-3">Select Stories</label>
                <p className="text-xs text-secondary mb-4">Choose stories to include in this highlight</p>
                <div className="grid grid-cols-3 gap-3 max-h-64 overflow-y-auto custom-scrollbar">
                  {userStories.map(story => (
                    <div
                      key={story.id}
                      onClick={() => toggleStorySelection(story)}
                      className={`relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-all ${
                        selectedStories.some(s => s.id === story.id)
                          ? 'border-accent ring-2 ring-accent/20'
                          : 'border-border hover:border-accent/50'
                      }`}
                    >
                      {story.mediaType === 'image' && story.mediaUrl ? (
                        <img src={story.mediaUrl} alt="Story" className="w-full h-full object-cover" />
                      ) : story.mediaType === 'video' && story.mediaUrl ? (
                        <video src={story.mediaUrl} className="w-full h-full object-cover" />
                      ) : (
                        <div
                          className="w-full h-full flex items-center justify-center"
                          style={{ backgroundColor: story.backgroundColor || '#FF6B6B' }}
                        >
                          <span className="text-white text-xs font-bold text-center px-2">{story.textContent?.slice(0, 20)}...</span>
                        </div>
                      )}
                      {selectedStories.some(s => s.id === story.id) && (
                        <div className="absolute top-2 right-2 bg-accent text-white rounded-full p-1">
                          <Check size={14} />
                        </div>
                      )}
                    </div>
                  ))}
                  {userStories.length === 0 && (
                    <p className="col-span-3 text-center text-secondary text-sm py-8">No stories available</p>
                  )}
                </div>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('info')}
                  className="flex-1 py-3 border border-border rounded-xl font-bold text-secondary hover:bg-surface transition-all"
                >
                  Back
                </button>
                <button
                  onClick={() => setStep('cover')}
                  disabled={selectedStories.length === 0}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {step === 'cover' && (
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-primary mb-3">Cover Image</label>
                <p className="text-xs text-secondary mb-4">Choose a custom cover or use the first selected story</p>

                <div className="aspect-square rounded-2xl overflow-hidden bg-surface border-2 border-dashed border-border flex items-center justify-center mb-4">
                  {coverPreview ? (
                    <img src={coverPreview} alt="Cover preview" className="w-full h-full object-cover" />
                  ) : selectedStories.length > 0 && selectedStories[0].mediaUrl ? (
                    <img src={selectedStories[0].mediaUrl} alt="Default cover" className="w-full h-full object-cover" />
                  ) : (
                    <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-surface/80 transition-colors">
                      <ImageIcon size={48} className="text-secondary mb-4" />
                      <span className="text-sm font-medium text-secondary">Select Cover Image</span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverSelect}
                      />
                    </label>
                  )}
                </div>

                {!coverPreview && (
                  <label className="flex items-center justify-center w-full py-3 bg-surface border border-border rounded-xl hover:border-accent transition-colors cursor-pointer">
                    <ImageIcon size={18} className="text-secondary mr-2" />
                    <span className="text-sm font-medium text-primary">Choose Custom Cover</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCoverSelect}
                    />
                  </label>
                )}
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => setStep('stories')}
                  className="flex-1 py-3 border border-border rounded-xl font-bold text-secondary hover:bg-surface transition-all"
                >
                  Back
                </button>
                <button
                  onClick={handleCreateHighlight}
                  disabled={loading}
                  className="flex-1 py-3 bg-accent text-white rounded-xl font-bold hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center space-x-2"
                >
                  {loading ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <>
                      <FolderPlus size={18} />
                      <span>Create</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
};
