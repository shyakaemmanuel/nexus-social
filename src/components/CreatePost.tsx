import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Image as ImageIcon, Tag, Send, X, Plus, UploadCloud, AlertCircle, Edit3 } from 'lucide-react';
import { collection, addDoc, serverTimestamp, doc, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { useAuth } from '../context/AuthContext';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { TagInput } from './TagInput';
import { UserStatusDot } from './UserStatusDot';
import { useMediaEditor } from './MediaEditor/MediaEditorIntegration';
import { User } from '../types';

export const CreatePost = () => {
  const { user } = useAuth();
  const { 
    openEditor, 
    editedMedia, 
    MediaEditorComponent 
  } = useMediaEditor();
  const [author, setAuthor] = useState<User | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [content, setContent] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [media, setMedia] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showTagInput, setShowTagInput] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const dropZoneRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    const unsubscribe = onSnapshot(doc(db, 'users', user.uid), (docSnap) => {
      if (docSnap.exists()) {
        setAuthor(docSnap.data() as User);
      }
    });
    return () => unsubscribe();
  }, [user]);

  useEffect(() => {
    // Use edited media if available, otherwise use original media
    const currentMedia = editedMedia?.file || media;
    if (!currentMedia) {
      setMediaPreview(null);
      return;
    }
    const url = URL.createObjectURL(currentMedia);
    setMediaPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [media, editedMedia]);

  const validateFile = (file: File): boolean => {
    const maxSize = 10 * 1024 * 1024; // 10MB
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'video/mp4', 'video/webm', 'video/ogg'];

    if (!validTypes.includes(file.type)) {
      setFileError('Invalid file type. Please upload an image (JPEG, PNG, GIF, WebP) or video (MP4, WebM, OGG).');
      return false;
    }

    if (file.size > maxSize) {
      setFileError('File size exceeds 10MB limit.');
      return false;
    }

    setFileError(null);
    return true;
  };

  const handleFileSelect = (file: File | null) => {
    if (!file) {
      setMedia(null);
      setFileError(null);
      return;
    }

    if (validateFile(file)) {
      setMedia(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelect(file);
    }
  };

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !media && !editedMedia) return;
    if (!user) return;

    setLoading(true);
    setUploadProgress(0);
    try {
      let mediaUrl = '';
      let mediaType: 'image' | 'video' | undefined;
      const mediaToUpload = editedMedia?.file || media;

      if (mediaToUpload) {
        setUploadProgress(50);
        try {
          mediaUrl = await uploadMediaToCloudinary(mediaToUpload, `posts/${user.uid}`);
          mediaType = mediaToUpload.type.startsWith('video') ? 'video' : 'image';
          setUploadProgress(100);
        } catch (error: any) {
          console.error('Upload error:', error);
          throw new Error(`Upload failed: ${error.message}`);
        }
      }

      await addDoc(collection(db, 'posts'), {
        authorUid: user.uid,
        authorName: user.displayName,
        authorPhoto: user.photoURL || '',
        content,
        tags,
        mediaUrl,
        mediaType,
        likesCount: 0,
        commentsCount: 0,
        createdAt: serverTimestamp()
      });

      setContent('');
      setTags([]);
      setMedia(null);
      setFileError(null);
      setShowTagInput(false);
      setIsExpanded(false);
      setUploadProgress(0);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'posts');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {MediaEditorComponent}
      <div className="bg-background border border-border rounded-[2rem] p-4 mb-8 shadow-nexus transition-all duration-300 hover:shadow-nexus-lg">
        {!isExpanded ? (
          <div 
            onClick={() => setIsExpanded(true)}
            className="flex items-center space-x-4 cursor-pointer group"
          >
            <div className="relative">
              <img
                src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`}
                alt="Profile"
                className="w-10 h-10 rounded-full object-cover border border-border group-hover:scale-105 transition-transform"
              />
              {author && (
                <UserStatusDot 
                  user={author} 
                  className="absolute bottom-0 right-0 w-3 h-3 border-2" 
                  size="sm"
                />
              )}
            </div>
            <div className="flex-1 bg-surface border border-border rounded-full py-2.5 px-5 text-secondary text-sm font-medium group-hover:border-accent/30 transition-colors">
              What's on your mind, {user?.displayName?.split(' ')[0]}?
            </div>
            <div className="p-2 bg-accent/10 text-accent rounded-full group-hover:bg-accent group-hover:text-white transition-all">
              <Plus size={20} />
            </div>
          </div>
        ) : (
          <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center space-x-3">
                <div className="relative">
                  <img
                    src={user?.photoURL || `https://ui-avatars.com/api/?name=${user?.displayName}&background=random`}
                    alt="Profile"
                    className="w-10 h-10 rounded-full object-cover border border-border"
                  />
                  {author && (
                    <UserStatusDot 
                      user={author} 
                      className="absolute bottom-0 right-0 w-3 h-3 border-2" 
                      size="sm"
                    />
                  )}
                </div>
                <div>
                  <p className="text-sm font-bold text-primary">{user?.displayName}</p>
                  <p className="text-[10px] text-secondary font-bold uppercase tracking-widest">Creating new post</p>
                </div>
              </div>
              <button 
                onClick={() => setIsExpanded(false)}
                className="p-2 hover:bg-surface rounded-full transition-colors text-secondary"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handlePost} className="space-y-4">
              <textarea
                placeholder="Share your thoughts..."
                value={content}
                onChange={(e) => setContent(e.target.value)}
                autoFocus
                className="w-full bg-surface border border-border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none min-h-[120px]"
              />

              <AnimatePresence>
                {showTagInput && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <TagInput tags={tags} setTags={setTags} />
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {fileError && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center space-x-2 p-3 bg-red-50 border border-red-200 rounded-xl text-red-600 text-xs"
                  >
                    <AlertCircle size={16} />
                    <span>{fileError}</span>
                    <button
                      type="button"
                      onClick={() => setFileError(null)}
                      className="ml-auto hover:text-red-800"
                    >
                      <X size={14} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {mediaPreview && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="relative rounded-2xl overflow-hidden border border-border bg-surface aspect-video shadow-inner"
                  >
                    {media?.type.startsWith('video') ? (
                      <video src={mediaPreview} className="w-full h-full object-cover" muted playsInline />
                    ) : (
                      <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                    )}
                    <div className="absolute top-3 right-3 flex space-x-2">
                      <button
                        type="button"
                        onClick={() => openEditor(media)}
                        className="p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors backdrop-blur-sm"
                        title="Edit media"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => setMedia(null)}
                        className="p-2 bg-black/60 text-white rounded-full hover:bg-black/80 transition-colors backdrop-blur-sm"
                      >
                        <X size={16} />
                      </button>
                    </div>
                    {loading && uploadProgress > 0 && (
                      <div className="absolute bottom-0 left-0 right-0 h-1 bg-black/50">
                        <div
                          className="h-full bg-accent transition-all duration-300"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <AnimatePresence>
                {!mediaPreview && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    ref={dropZoneRef}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    className={`relative border-2 border-dashed rounded-2xl p-8 text-center transition-all ${
                      isDragging
                        ? 'border-accent bg-accent/5'
                        : 'border-border hover:border-accent/50 hover:bg-accent/5'
                    }`}
                  >
                    <UploadCloud size={32} className={`mx-auto mb-3 ${isDragging ? 'text-accent' : 'text-secondary'}`} />
                    <p className="text-sm text-secondary mb-2">
                      {isDragging ? 'Drop your file here' : 'Drag and drop media here'}
                    </p>
                    <p className="text-xs text-secondary/60">
                      Images (JPEG, PNG, GIF, WebP) or videos (MP4, WebM, OGG) up to 10MB
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <div className="flex items-center justify-between pt-2">
                <div className="flex items-center space-x-2">
                  <label className="flex items-center space-x-2 text-secondary hover:text-accent cursor-pointer transition-all p-2 hover:bg-accent/5 rounded-xl">
                    <ImageIcon size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Media</span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      className="hidden"
                      onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                    />
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTagInput(!showTagInput)}
                    className={`flex items-center space-x-2 transition-all p-2 rounded-xl ${showTagInput ? 'bg-accent/10 text-accent' : 'text-secondary hover:text-accent hover:bg-accent/5'}`}
                  >
                    <Tag size={20} />
                    <span className="text-[10px] font-black uppercase tracking-widest hidden sm:inline">Tags</span>
                  </button>
                </div>
                <button
                  type="submit"
                  disabled={loading || (!content.trim() && !media && !editedMedia) || !!fileError}
                  className="bg-accent text-white px-8 py-3 rounded-full text-[10px] font-black uppercase tracking-[0.2em] hover:bg-accent/90 transition-all disabled:opacity-50 flex items-center space-x-2 shadow-lg shadow-accent/20 active:scale-95"
                >
                  {loading ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-white border-t-transparent rounded-full"
                      />
                      <span>{uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : 'Posting...'}</span>
                    </>
                  ) : (
                    <>
                      <Send size={16} />
                      <span>Post</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </motion.div>
        )}
      </div>
    </>
  );
};
