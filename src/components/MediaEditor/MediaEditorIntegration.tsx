import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Upload, X, Edit3 } from 'lucide-react';
import { MediaEditor, MediaFile } from './MediaEditor';

interface MediaEditorIntegrationProps {
  onMediaEdited: (editedFile: File, metadata?: any) => void;
  onClose: () => void;
  initialFile?: File;
  acceptedTypes?: string[];
}

export const MediaEditorIntegration: React.FC<MediaEditorIntegrationProps> = ({
  onMediaEdited,
  onClose,
  initialFile,
  acceptedTypes = ['image/*', 'video/*']
}) => {
  const [mediaFile, setMediaFile] = useState<MediaFile | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Process file and create MediaFile object
  const processFile = async (file: File): Promise<MediaFile> => {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const mediaType = file.type.startsWith('image/') ? 'image' : 'video';
      
      if (mediaType === 'image') {
        const img = new Image();
        img.onload = () => {
          resolve({
            file,
            type: 'image',
            url,
            width: img.width,
            height: img.height
          });
        };
        img.onerror = reject;
        img.src = url;
      } else {
        const video = document.createElement('video');
        video.onloadedmetadata = () => {
          resolve({
            file,
            type: 'video',
            url,
            duration: video.duration,
            width: video.videoWidth,
            height: video.videoHeight
          });
        };
        video.onerror = reject;
        video.src = url;
      }
    });
  };

  // Handle file selection
  const handleFileSelect = async (file: File) => {
    setIsLoading(true);
    try {
      const processedFile = await processFile(file);
      setMediaFile(processedFile);
    } catch (error) {
      console.error('Error processing file:', error);
      // Handle error appropriately
    } finally {
      setIsLoading(false);
    }
  };

  // Handle initial file
  React.useEffect(() => {
    if (initialFile) {
      handleFileSelect(initialFile);
    }
  }, [initialFile]);

  // Handle file input change
  const handleFileInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await handleFileSelect(file);
    }
  };

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const file = e.dataTransfer.files[0];
    if (file && acceptedTypes.some(type => file.type.match(type))) {
      await handleFileSelect(file);
    }
  };

  // Handle save from editor
  const handleEditorSave = (editedFile: File, metadata?: any) => {
    onMediaEdited(editedFile, metadata);
    onClose();
  };

  // Reset to file selection
  const resetToSelection = () => {
    setMediaFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 bg-black z-50 flex items-center justify-center">
        {/* File Selection Screen */}
        {!mediaFile && (
          <motion.div
            className="w-full max-w-2xl mx-4"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
          >
            <div className="bg-gray-900 rounded-2xl p-8">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <h2 className="text-2xl font-bold text-white">Media Editor</h2>
                <button
                  onClick={onClose}
                  className="p-2 text-gray-400 hover:text-white transition-colors"
                >
                  <X size={24} />
                </button>
              </div>

              {/* Upload Area */}
              <div
                className="border-2 border-dashed border-gray-700 rounded-xl p-12 text-center hover:border-blue-500 transition-colors cursor-pointer"
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center space-y-4">
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full"
                    />
                    <p className="text-white">Processing file...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center space-y-4">
                    <Upload className="text-blue-500" size={48} />
                    <div>
                      <p className="text-white text-lg font-medium mb-2">
                        Drop your media here
                      </p>
                      <p className="text-gray-400 text-sm">
                        or click to browse
                      </p>
                    </div>
                    <div className="text-gray-500 text-xs">
                      Supports: Images (JPG, PNG, GIF) and Videos (MP4, MOV, WebM)
                    </div>
                  </div>
                )}
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept={acceptedTypes.join(',')}
                onChange={handleFileInputChange}
                className="hidden"
              />

              {/* Quick Actions */}
              <div className="mt-8 flex justify-center space-x-4">
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Upload size={20} />
                  <span>Choose File</span>
                </button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Editor Screen */}
        {mediaFile && (
          <MediaEditor
            mediaFile={mediaFile}
            onSave={handleEditorSave}
            onCancel={resetToSelection}
          />
        )}
      </div>
    </AnimatePresence>
  );
};

// Hook for using the media editor
export const useMediaEditor = () => {
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [editedMedia, setEditedMedia] = useState<{ file: File; metadata?: any } | null>(null);

  const openEditor = (file?: File) => {
    if (file) {
      setPendingFile(file);
    }
    setIsEditorOpen(true);
  };

  const closeEditor = () => {
    setIsEditorOpen(false);
    setPendingFile(null);
  };

  const handleMediaEdited = (file: File, metadata?: any) => {
    setEditedMedia({ file, metadata });
    closeEditor();
  };

  return {
    isEditorOpen,
    pendingFile,
    editedMedia,
    openEditor,
    closeEditor,
    handleMediaEdited,
    MediaEditorComponent: isEditorOpen && (
      <MediaEditorIntegration
        key={isEditorOpen.toString()}
        onMediaEdited={handleMediaEdited}
        onClose={closeEditor}
        initialFile={pendingFile || undefined}
      />
    )
  };
};

export default MediaEditorIntegration;
