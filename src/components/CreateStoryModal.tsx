import React, { useState, useRef, useEffect } from 'react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { addDoc, collection, serverTimestamp, Timestamp, doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { Story } from '../types';
import { useAuth } from '../context/AuthContext';
import { uploadMediaToCloudinary } from '../lib/cloudinary';
import { X, Camera, Type, Palette, Send, Trash2, Smile, UploadCloud, Plus, ChevronLeft, Check, Eraser, PenTool, Music } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface CreateStoryModalProps {
  isOpen: boolean;
  onClose: () => void;
  editStory?: Story | null;
}

const BACKGROUND_COLORS = [
  '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7',
  '#DDA0DD', '#98D8C8', '#F7DC6F', '#BB8FCE', '#85C1E9',
  '#F1948A', '#82E0AA', '#85C1E9', '#F8C471', '#D7BDE2'
];

const STICKERS = [
  '😀', '😂', '😍', '🥰', '😎', '🤩', '😊', '🥳',
  '🎉', '🎊', '🔥', '⭐', '✨', '💪', '👍', '❤️',
  '💕', '💖', '💗', '💙', '💜', '🌟', '✨', '🎈',
  '🎁', '🎈', '🎂', '🎀', '🌈', '☀️', '🌙', '⭐'
];

const PRESET_MUSIC = [
  { title: 'Chill Vibes', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3' },
  { title: 'Summer Beat', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3' },
  { title: 'Lo-Fi Dreams', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-3.mp3' },
  { title: 'Acoustic Morning', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3' },
  { title: 'Electronic Pulse', url: 'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-5.mp3' },
];

export const CreateStoryModal: React.FC<CreateStoryModalProps> = ({ isOpen, onClose, editStory }) => {
  const { user } = useAuth();
  const [storyType, setStoryType] = useState<'image' | 'video' | 'text' | null>(null);
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaPreview, setMediaPreview] = useState<string>('');
  const [textContent, setTextContent] = useState('');
  const [backgroundColor, setBackgroundColor] = useState('#FF6B6B');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [stickers, setStickers] = useState<string[]>([]);
  const [showStickerPicker, setShowStickerPicker] = useState(false);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showTools, setShowTools] = useState(false);
  const [textOverlays, setTextOverlays] = useState<Array<{ id: string; text: string; x: number; y: number; color: string; fontSize: number }>>([]);
  const [caption, setCaption] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [showCoverPicker, setShowCoverPicker] = useState(false);
  const [coverTime, setCoverTime] = useState(0);
  const [musicUrl, setMusicUrl] = useState('');
  const [musicTitle, setMusicTitle] = useState('');
  const [showOptionsPanel, setShowOptionsPanel] = useState(false);
  const [showMusicModal, setShowMusicModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const isEditing = !!editStory;

  // Populate fields when editing
  useEffect(() => {
    if (editStory && isOpen) {
      setStoryType(editStory.mediaType);
      setTextContent(editStory.textContent || '');
      setBackgroundColor(editStory.backgroundColor || '#FF6B6B');
      setStickers(editStory.stickers || []);
      setCaption(editStory.caption || '');
      setMusicUrl(editStory.musicUrl || '');
      setMusicTitle(editStory.musicTitle || '');
      setTextOverlays(editStory.textOverlays || []);
      if (editStory.mediaUrl) {
        setMediaPreview(editStory.mediaUrl);
      }
    }
  }, [editStory, isOpen]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const selectedType = file.type.startsWith('video') ? 'video' : file.type.startsWith('image') ? 'image' : null;
    if (selectedType) {
      setStoryType(selectedType);
    }

    setMediaFile(file);
    const reader = new FileReader();
    reader.onloadend = () => {
      setMediaPreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleCreateStory = async () => {
    if (!user) {
      setErrorMessage('User not authenticated. Please log in.');
      return;
    }

    if (storyType === 'text' && !textContent.trim() && textOverlays.length === 0) {
      setErrorMessage('Please add text content to your story.');
      return;
    }

    if ((storyType === 'image' || storyType === 'video') && !mediaFile && !mediaPreview) {
      setErrorMessage('Please select a file to share.');
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    setErrorMessage('');
    
    try {
      let mediaUrl = editStory?.mediaUrl || '';
      const isVideo = mediaFile?.type.startsWith('video');
      const isImage = mediaFile?.type.startsWith('image');

      // Validate file size (max 20MB for stories)
      if (mediaFile && mediaFile.size > 20 * 1024 * 1024) {
        throw new Error('File size exceeds 20MB limit for stories');
      }

      if (mediaFile && (isVideo || isImage)) {
        setUploadProgress(50);

        try {
          mediaUrl = await uploadMediaToCloudinary(mediaFile, `stories/${user.uid}`);
          setUploadProgress(100);
        } catch (error: any) {
          throw new Error(`Upload failed: ${error.message}`);
        }
      }

      const storyData: any = {
        mediaType: storyType,
        musicUrl: musicUrl || '',
        musicTitle: musicTitle || '',
      };

      if (storyType === 'text') {
        storyData.textContent = textContent || '';
        storyData.backgroundColor = backgroundColor;
        storyData.stickers = stickers;
        storyData.textOverlays = textOverlays;
      } else {
        storyData.mediaUrl = mediaUrl;
        storyData.caption = caption || '';
      }

      if (isEditing && editStory) {
        await updateDoc(doc(db, 'stories', editStory.id), storyData);
      } else {
        const expiresAt = new Date();
        expiresAt.setHours(expiresAt.getHours() + 24);
        storyData.authorUid = user.uid;
        storyData.authorName = user.displayName || 'Anonymous';
        storyData.authorPhoto = user.photoURL || '';
        storyData.createdAt = serverTimestamp();
        storyData.expiresAt = Timestamp.fromDate(expiresAt);
        storyData.viewers = [];
        storyData.reactions = [];
        storyData.replies = [];
        await addDoc(collection(db, 'stories'), storyData);
      }

      handleClose();
    } catch (error: any) {
      let errorMsg = 'Failed to save story. Please try again.';
      
      if (error?.code === 'permission-denied') {
        errorMsg = 'Permission denied. Check Firestore rules for stories collection.';
      } else if (error?.code === 'unauthenticated') {
        errorMsg = 'You must be logged in to create stories.';
      } else if (error?.message) {
        errorMsg = `Error: ${error.message}`;
      }
      
      setErrorMessage(errorMsg);
      handleFirestoreError(error, OperationType.CREATE, 'stories');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleClose = () => {
    setStoryType(null);
    setMediaFile(null);
    setMediaPreview('');
    setTextContent('');
    setBackgroundColor('#FF6B6B');
    setUploading(false);
    setUploadProgress(0);
    setStickers([]);
    setShowStickerPicker(false);
    setShowColorPicker(false);
    setShowTools(false);
    setTextOverlays([]);
    setCaption('');
    setErrorMessage('');
    setShowCoverPicker(false);
    setCoverTime(0);
    setMusicUrl('');
    setMusicTitle('');
    setShowOptionsPanel(false);
    setShowMusicModal(false);
    setShowPreview(false);
    onClose();
  };

  const addTextOverlay = () => {
    if (textContent.trim()) {
      setTextOverlays([...textOverlays, {
        id: Date.now().toString(),
        text: textContent,
        x: 50,
        y: 50,
        color: '#FFFFFF',
        fontSize: 24
      }]);
      setTextContent('');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex flex-col">
      <AnimatePresence mode="wait">
        {!storyType ? (
          // Story Type Selection - Full Screen
          <motion.div
            key="selection"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6">
              <button onClick={handleClose} className="w-12 h-12 bg-white/10 backdrop-blur-md rounded-full flex items-center justify-center hover:bg-white/20 transition-all">
                <ChevronLeft size={24} className="text-white" />
              </button>
            </div>

            {/* Content - Centered */}
            <div className="flex-1 flex flex-col justify-center items-center px-2 py-3 space-y-3">
              {/* Your Story Preview */}
              <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} className="flex flex-col items-center">
                <div className="w-14 h-14 rounded-3xl bg-gradient-to-tr from-accent via-purple-500 to-pink-500 p-[2px]">
                  <div className="w-full h-full rounded-3xl bg-background flex items-center justify-center overflow-hidden">
                    {user?.photoURL ? (
                      <img src={user.photoURL} alt="Your Story" className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center bg-surface">
                        <Camera size={32} className="text-secondary" />
                      </div>
                    )}
                  </div>
                </div>
                <div className="absolute mt-20 w-8 h-8 bg-accent rounded-full flex items-center justify-center border-3 border-background shadow-lg">
                  <Plus size={16} className="text-white" />
                </div>
                <p className="text-center text-primary text-sm font-semibold mt-6">Your Story</p>
              </motion.div>

              {/* Story Type Options */}
              <div className="flex justify-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStoryType('image')}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-accent to-orange-500 rounded-2xl flex items-center justify-center shadow-lg shadow-accent/40 hover:shadow-accent/60 transition-all">
                    <Camera size={26} className="text-white" />
                  </div>
                  <span className="text-xs text-primary font-medium">Photo</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStoryType('video')}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg shadow-purple-500/40 hover:shadow-purple-500/60 transition-all">
                    <Camera size={26} className="text-white" />
                  </div>
                  <span className="text-xs text-primary font-medium">Video</span>
                </motion.button>

                <motion.button
                  whileHover={{ scale: 1.08, y: -3 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => setStoryType('text')}
                  className="flex flex-col items-center space-y-2"
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-green-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg shadow-green-500/40 hover:shadow-green-500/60 transition-all">
                    <Type size={26} className="text-white" />
                  </div>
                  <span className="text-xs text-primary font-medium">Text</span>
                </motion.button>
              </div>
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="editor"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex-1 flex flex-col"
          >
            {/* Header with Back, Title, and Share */}
            <div className="flex items-center justify-between px-3 py-3 border-b border-border sticky top-0 z-50 bg-background/90 backdrop-blur">
              <button 
                onClick={() => setStoryType(null)} 
                className="p-2 hover:bg-surface/80 rounded-full transition-all"
              >
                <ChevronLeft size={20} />
              </button>
              <h1 className="text-base font-black tracking-tight">{isEditing ? 'Edit Story' : 'Your Story'}</h1>
              <button
                onClick={handleCreateStory}
                disabled={
                  uploading ||
                  (storyType === 'text' && !textContent.trim() && textOverlays.length === 0) ||
                  ((storyType === 'image' || storyType === 'video') && !mediaFile && !mediaPreview)
                }
                className="px-3 py-2 bg-accent text-white text-xs font-black rounded-full hover:bg-accent/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-1"
              >
                {uploading ? (
                  <>
                    <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    <span>{uploadProgress > 0 ? `${Math.round(uploadProgress)}%` : 'Sharing...'}</span>
                  </>
                ) : (
                  <>
                    <Send size={14} />
                    <span>Share</span>
                  </>
                )}
              </button>
            </div>

            {/* Upload Progress Bar */}
            {uploading && uploadProgress > 0 && (
              <div className="px-4 mt-4">
                <div className="w-full h-2 bg-white/10 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${uploadProgress}%` }}
                    className="h-full bg-gradient-to-r from-accent to-purple-600"
                  />
                </div>
                <p className="text-white/60 text-xs mt-2 text-center">Uploading... {Math.round(uploadProgress)}%</p>
              </div>
            )}

            {/* Error Message */}
            {errorMessage && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mx-3 mt-3 p-3 bg-red-500/20 border border-red-500/50 rounded-2xl"
              >
                <p className="text-red-400 text-sm text-center">{errorMessage}</p>
              </motion.div>
            )}

            {/* Story Preview Area - Mobile Phone Frame */}
            <div className="flex-1 relative flex items-center justify-center p-0.5 overflow-hidden">
              <div className="relative w-[12rem] aspect-[9/16] rounded-3xl border border-secondary/30 overflow-hidden bg-surface shadow-xl">
                {storyType === 'text' ? (
                  <div
                    className="w-full h-full flex items-center justify-center p-4"
                    style={{ backgroundColor }}
                  >
                    <textarea
                      value={textContent}
                      onChange={(e) => setTextContent(e.target.value)}
                      placeholder="Type your story..."
                      className="w-full h-full bg-transparent text-white text-xl font-bold text-center resize-none focus:outline-none placeholder-white/50"
                      maxLength={500}
                    />
                    {textOverlays.map((overlay) => (
                      <div
                        key={overlay.id}
                        className="absolute"
                        style={{
                          left: `${overlay.x}%`,
                          top: `${overlay.y}%`,
                          color: overlay.color,
                          fontSize: `${overlay.fontSize}px`,
                          transform: 'translate(-50%, -50%)'
                        }}
                      >
                        {overlay.text}
                      </div>
                    ))}
                  </div>
                ) : mediaPreview ? (
                  storyType === 'video' ? (
                    <video src={mediaPreview} className="w-full h-full object-cover" controls />
                  ) : (
                    <img src={mediaPreview} alt="Preview" className="w-full h-full object-cover" />
                  )
                ) : (
                  <label className="w-full h-full flex flex-col items-center justify-center cursor-pointer hover:bg-surface/80 transition-colors">
                    <Camera size={56} className="text-secondary mb-5" />
                    <span className="text-base font-medium text-secondary">
                      {storyType === 'video' ? 'Select a video' : 'Select an image'}
                    </span>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*,video/*"
                      capture="environment"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                  </label>
                )}

                {/* Change Media Button */}
                {storyType !== 'text' && mediaPreview && (
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute top-4 right-4 p-3 bg-black/50 backdrop-blur-md rounded-full text-white hover:bg-black/70 transition-colors"
                  >
                    <Camera size={24} />
                  </button>
                )}

                <AnimatePresence>
                  {showOptionsPanel && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 10 }}
                      className="absolute inset-0 z-40 flex items-end justify-center"
                    >
                      <button
                        type="button"
                        className="absolute inset-0 bg-transparent"
                        onClick={() => setShowOptionsPanel(false)}
                      />
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="relative z-50 mb-4 w-[calc(100%-1rem)] rounded-xl bg-white shadow-lg p-4"
                      >
                        <button
                          onClick={() => {
                            setShowMusicModal(true);
                            setShowOptionsPanel(false);
                          }}
                          className="w-full rounded-2xl bg-slate-900 text-white py-3 text-sm font-semibold mb-2"
                        >
                          Add Music
                        </button>
                        <button
                          onClick={() => {
                            setShowTools(true);
                            setShowOptionsPanel(false);
                          }}
                          className="w-full rounded-2xl bg-slate-100 text-slate-900 py-3 text-sm font-semibold mb-2"
                        >
                          Add Text
                        </button>
                        <button
                          onClick={() => {
                            setShowStickerPicker(true);
                            setShowOptionsPanel(false);
                          }}
                          className="w-full rounded-2xl bg-slate-100 text-slate-900 py-3 text-sm font-semibold"
                        >
                          Add Stickers
                        </button>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>

            {/* Caption Input for Video Stories */}
            {storyType === 'video' && mediaPreview && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="px-4 py-3 bg-black/50 backdrop-blur-md space-y-3"
              >
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="Write a caption..."
                  className="w-full bg-white/10 border border-white/20 rounded-2xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-accent/50 resize-none"
                  rows={2}
                  maxLength={500}
                />
                <button
                  onClick={() => setShowCoverPicker(!showCoverPicker)}
                  className="w-full flex items-center justify-center space-x-2 py-3 bg-white/10 border border-white/20 rounded-2xl text-white text-sm font-medium hover:bg-white/20 transition-all"
                >
                  <Camera size={16} />
                  <span>Select Cover Thumbnail</span>
                </button>

                {/* Cover Thumbnail Picker */}
                <AnimatePresence>
                  {showCoverPicker && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      exit={{ opacity: 0, height: 0 }}
                      className="space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-white/70">Adjust video to select cover</span>
                        <span className="text-xs text-accent">{coverTime.toFixed(1)}s</span>
                      </div>
                      <input
                        type="range"
                        min="0"
                        max={10}
                        step={0.1}
                        value={coverTime}
                        onChange={(e) => {
                          setCoverTime(parseFloat(e.target.value));
                          if (videoRef.current) {
                            videoRef.current.currentTime = parseFloat(e.target.value);
                          }
                        }}
                        className="w-full h-2 bg-white/20 rounded-full appearance-none cursor-pointer accent-accent"
                      />
                      <div className="aspect-[9/16] rounded-2xl overflow-hidden bg-surface">
                        <video
                          ref={videoRef}
                          src={mediaPreview}
                          className="w-full h-full object-cover"
                          onTimeUpdate={(e) => setCoverTime(e.currentTarget.currentTime)}
                        />
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* Bottom Toolbar */}
            <div className="px-3 py-3 border-t border-border bg-background/80 backdrop-blur flex items-center justify-center space-x-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="p-3 bg-surface hover:bg-surface/80 rounded-lg transition-all"
              >
                <Camera size={18} className="text-primary" />
              </button>
              {storyType === 'text' && (
                <>
                  <button
                    onClick={() => setShowColorPicker(!showColorPicker)}
                    className="p-3 bg-surface hover:bg-surface/80 rounded-lg transition-all"
                  >
                    <Palette size={18} className="text-primary" />
                  </button>
                  <button
                    onClick={() => setShowStickerPicker(!showStickerPicker)}
                    className="p-3 bg-surface hover:bg-surface/80 rounded-lg transition-all"
                  >
                    <Smile size={18} className="text-primary" />
                  </button>
                  <button
                    onClick={addTextOverlay}
                    className="p-3 bg-surface hover:bg-surface/80 rounded-lg transition-all"
                  >
                    <Type size={18} className="text-primary" />
                  </button>
                </>
              )}
              {(storyType === 'image' || storyType === 'video') && (
                <button
                  onClick={() => setShowOptionsPanel((prev) => !prev)}
                  className={`p-3 rounded-lg transition-all ${musicTitle ? 'bg-accent/40' : 'bg-surface hover:bg-surface/80'}`}
                  title="Story menu"
                >
                  <Music size={18} className="text-primary" />
                </button>
              )}
            </div>

            {/* Color Picker */}
            <AnimatePresence>
              {showColorPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 py-3 border-t border-border bg-background/80 overflow-hidden"
                  >
                    <div className="flex flex-wrap gap-1.5 justify-center px-1 py-2">
                      {BACKGROUND_COLORS.map((color) => (
                        <button
                          key={color}
                          onClick={() => setBackgroundColor(color)}
                          className={`w-8 h-8 rounded-full border-2 transition-all ${
                            backgroundColor === color ? 'border-accent scale-110' : 'border-transparent hover:scale-105'
                          }`}
                          style={{ backgroundColor }}
                        />
                      ))}
                    </div>
                  </motion.div>
                )}
            </AnimatePresence>

            {/* Sticker Picker */}
            <AnimatePresence>
              {showStickerPicker && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="px-3 py-2 border-t border-border bg-background/80 overflow-hidden"
                >
                  <div className="grid grid-cols-8 gap-1">
                    {STICKERS.map((sticker) => (
                      <button
                        key={sticker}
                        onClick={() => {
                          setStickers([...stickers, sticker]);
                          setShowStickerPicker(false);
                        }}
                        className="w-8 h-8 flex items-center justify-center hover:bg-surface rounded text-lg"
                      >
                        {sticker}
                      </button>
                    ))}
                  </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Added Stickers */}
              {stickers.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2 justify-center">
                  {stickers.map((sticker, idx) => (
                    <div
                      key={idx}
                      className="relative w-12 h-12 flex items-center justify-center bg-white/10 backdrop-blur-md rounded-full"
                    >
                      <span className="text-3xl">{sticker}</span>
                      <button
                        onClick={() => setStickers(stickers.filter((_, i) => i !== idx))}
                        className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 text-white rounded-full text-xs flex items-center justify-center"
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <AnimatePresence>
                {showMusicModal && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 z-50 flex items-center justify-center bg-black/20"
                  >
                    <button
                      type="button"
                      className="absolute inset-0 bg-transparent"
                      onClick={() => setShowMusicModal(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      className="relative z-50 w-[90%] max-w-[16rem] rounded-2xl bg-white p-4 shadow-2xl"
                    >
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-sm font-semibold text-slate-900">Add Music</span>
                        <button
                          type="button"
                          onClick={() => setShowMusicModal(false)}
                          className="text-sm text-slate-500 hover:text-slate-900"
                        >
                          Close
                        </button>
                      </div>
                      <div className="space-y-3 max-h-48 overflow-y-auto">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-slate-500">Select music for your story</span>
                          <button
                            onClick={() => { setMusicUrl(''); setMusicTitle(''); }}
                            className="text-xs text-red-500 hover:text-red-400"
                          >
                            Clear
                          </button>
                        </div>
                        {musicTitle && (
                          <div className="bg-slate-100 rounded-xl px-3 py-2 text-sm text-slate-900 space-y-2">
                            <span className="font-medium">{musicTitle}</span>
                            {musicUrl && (
                              <audio
                                src={musicUrl}
                                controls
                                className="w-full rounded-xl bg-slate-200"
                              />
                            )}
                          </div>
                        )}
                        {PRESET_MUSIC.map((music) => (
                          <button
                            key={music.url}
                            onClick={() => { setMusicUrl(music.url); setMusicTitle(music.title); }}
                            className={`w-full flex items-center space-x-3 px-3 py-2 rounded-xl transition-colors ${
                              musicUrl === music.url ? 'bg-accent/40 text-slate-900' : 'bg-slate-100 text-slate-900 hover:bg-slate-200'
                            }`}
                          >
                            <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center">
                              <Music size={16} className="text-slate-700" />
                            </div>
                            <span className="text-sm">{music.title}</span>
                            {musicUrl === music.url && (
                              <span className="ml-auto text-xs text-accent">✓ Selected</span>
                            )}
                          </button>
                        ))}
                        <div className="pt-2 border-t border-slate-200">
                          <input
                            type="text"
                            placeholder="Or paste custom music URL"
                            value={musicUrl && !PRESET_MUSIC.find(m => m.url === musicUrl) ? musicUrl : ''}
                            onChange={(e) => { setMusicUrl(e.target.value); setMusicTitle('Custom'); }}
                            className="w-full bg-slate-100 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-900 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-accent/50"
                          />
                        </div>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Caption Input for Image/Video */}
              {(storyType === 'image' || storyType === 'video') && mediaPreview && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4"
                >
                  <input
                    type="text"
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    placeholder="Add a caption..."
                    maxLength={100}
                    className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-accent/50"
                  />
                </motion.div>
              )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
