import React, { useState, useRef, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Image, 
  Video, 
  Crop, 
  Type, 
  Smile, 
  Music, 
  Sliders, 
  Palette,
  RotateCw,
  Scissors,
  Volume2,
  VolumeX,
  Download,
  X,
  Check,
  Undo2,
  Redo2
} from 'lucide-react';

// Import sub-components (will create these)
import { ImageCanvas } from './ImageCanvas';
import { VideoCanvas } from './VideoCanvas';
import { EditorToolbar } from './EditorToolbar';
import { FilterPanel } from './FilterPanel';
import { TextOverlay } from './TextOverlay';
import { StickerPanel } from './StickerPanel';
import { VideoTimeline } from './VideoTimeline';
import { CropTool } from './CropTool';
import { AdjustmentsPanel } from './AdjustmentsPanel';

export interface MediaFile {
  file: File;
  type: 'image' | 'video';
  url: string;
  duration?: number;
  width: number;
  height: number;
}

export interface TextElement {
  id: string;
  text: string;
  x: number;
  y: number;
  fontSize: number;
  fontFamily: string;
  color: string;
  rotation: number;
  opacity: number;
}

export interface StickerElement {
  id: string;
  emoji: string;
  x: number;
  y: number;
  size: number;
  rotation: number;
  opacity: number;
}

export interface VideoSegment {
  start: number;
  end: number;
}

interface MediaEditorProps {
  mediaFile: MediaFile;
  onSave: (editedFile: File, metadata?: any) => void;
  onCancel: () => void;
}

export const MediaEditor: React.FC<MediaEditorProps> = ({
  mediaFile,
  onSave,
  onCancel
}) => {
  const [activeTool, setActiveTool] = useState<string>('filters');
  const [textElements, setTextElements] = useState<TextElement[]>([]);
  const [stickerElements, setStickerElements] = useState<StickerElement[]>([]);
  const [selectedElement, setSelectedElement] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [history, setHistory] = useState<any[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  
  // Image editing state
  const [cropArea, setCropArea] = useState({ x: 0, y: 0, width: 100, height: 100 });
  const [filters, setFilters] = useState({
    brightness: 100,
    contrast: 100,
    saturation: 100,
    blur: 0,
    sepia: 0,
    grayscale: 0
  });
  const [activeFilter, setActiveFilter] = useState<string>('none');
  
  // Video editing state
  const [videoSegment, setVideoSegment] = useState<VideoSegment>({
    start: 0,
    end: mediaFile.duration || 0
  });
  const [isMuted, setIsMuted] = useState(false);
  const [backgroundMusic, setBackgroundMusic] = useState<string | null>(null);
  const [videoCurrentTime, setVideoCurrentTime] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Add to history for undo/redo
  const addToHistory = useCallback((state: any) => {
    const newHistory = history.slice(0, historyIndex + 1);
    newHistory.push(state);
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
  }, [history, historyIndex]);

  // Undo functionality
  const undo = useCallback(() => {
    if (historyIndex > 0) {
      setHistoryIndex(historyIndex - 1);
      // Restore state from history
    }
  }, [historyIndex]);

  // Redo functionality
  const redo = useCallback(() => {
    if (historyIndex < history.length - 1) {
      setHistoryIndex(historyIndex + 1);
      // Restore state from history
    }
  }, [historyIndex, history.length]);

  // Add text overlay
  const addTextElement = useCallback(() => {
    const newText: TextElement = {
      id: Date.now().toString(),
      text: 'Your Text Here',
      x: 50,
      y: 50,
      fontSize: 24,
      fontFamily: 'Arial',
      color: '#ffffff',
      rotation: 0,
      opacity: 1
    };
    setTextElements([...textElements, newText]);
    addToHistory({ textElements: [...textElements, newText] });
  }, [textElements, addToHistory]);

  // Add sticker
  const addSticker = useCallback((emoji: string) => {
    const newSticker: StickerElement = {
      id: Date.now().toString(),
      emoji,
      x: 50,
      y: 50,
      size: 48,
      rotation: 0,
      opacity: 1
    };
    setStickerElements([...stickerElements, newSticker]);
    addToHistory({ stickerElements: [...stickerElements, newSticker] });
  }, [stickerElements, addToHistory]);

  // Update element position
  const updateElementPosition = useCallback((id: string, x: number, y: number) => {
    const updateTextElements = textElements.map(el => 
      el.id === id ? { ...el, x, y } : el
    );
    const updateStickerElements = stickerElements.map(el => 
      el.id === id ? { ...el, x, y } : el
    );
    
    setTextElements(updateTextElements);
    setStickerElements(updateStickerElements);
  }, [textElements, stickerElements]);

  // Export edited media
  const exportMedia = useCallback(async () => {
    try {
      if (mediaFile.type === 'image') {
        await exportImage();
      } else {
        await exportVideo();
      }
    } catch (error) {
      console.error('Export failed:', error);
    }
  }, [mediaFile.type]);

  // Export image
  const exportImage = async () => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas size
    canvas.width = mediaFile.width;
    canvas.height = mediaFile.height;

    // Draw image with filters
    const img = new Image();
    img.onload = () => {
      // Apply CSS filters
      ctx.filter = `
        brightness(${filters.brightness}%) 
        contrast(${filters.contrast}%) 
        saturate(${filters.saturation}%) 
        blur(${filters.blur}px) 
        sepia(${filters.sepia}%) 
        grayscale(${filters.grayscale}%)
      `;
      
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      // Draw text overlays
      textElements.forEach(textEl => {
        ctx.save();
        ctx.translate(textEl.x, textEl.y);
        ctx.rotate((textEl.rotation * Math.PI) / 180);
        ctx.globalAlpha = textEl.opacity;
        ctx.font = `${textEl.fontSize}px ${textEl.fontFamily}`;
        ctx.fillStyle = textEl.color;
        ctx.fillText(textEl.text, 0, 0);
        ctx.restore();
      });

      // Draw stickers
      stickerElements.forEach(sticker => {
        ctx.save();
        ctx.translate(sticker.x, sticker.y);
        ctx.rotate((sticker.rotation * Math.PI) / 180);
        ctx.globalAlpha = sticker.opacity;
        ctx.font = `${sticker.size}px Arial`;
        ctx.fillText(sticker.emoji, 0, 0);
        ctx.restore();
      });

      // Export canvas to blob
      canvas.toBlob((blob) => {
        if (blob) {
          const editedFile = new File([blob], 'edited-image.jpg', { type: 'image/jpeg' });
          onSave(editedFile, { textElements, stickerElements, filters });
        }
      }, 'image/jpeg', 0.9);
    };

    img.src = mediaFile.url;
  };

  // Export video (simplified - would need video processing library)
  const exportVideo = async () => {
    // This would require a video processing library like FFmpeg.wasm
    console.log('Video export - would use FFmpeg.wasm');
    // For now, just return original file
    onSave(mediaFile.file, { 
      textElements, 
      stickerElements, 
      videoSegment, 
      isMuted,
      backgroundMusic 
    });
  };

  // Render toolbar based on active tool
  const renderToolPanel = () => {
    switch (activeTool) {
      case 'filters':
        return <FilterPanel filters={filters} setFilters={setFilters} />;
      case 'crop':
        return <CropTool cropArea={cropArea} setCropArea={setCropArea} />;
      case 'adjustments':
        return <AdjustmentsPanel filters={filters} setFilters={setFilters} />;
      case 'text':
        return <TextOverlay 
          elements={textElements}
          selectedElement={selectedElement}
          onUpdate={setTextElements}
          onAdd={addTextElement}
        />;
      case 'stickers':
        return <StickerPanel onAddSticker={addSticker} />;
      case 'music':
        return <div>Music panel - Coming soon</div>;
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-50 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-4 bg-gray-900">
        <button
          onClick={onCancel}
          className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors"
        >
          <X size={24} />
        </button>
        
        <div className="flex items-center space-x-2">
          <button
            onClick={undo}
            disabled={historyIndex <= 0}
            className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
          >
            <Undo2 size={20} />
          </button>
          <button
            onClick={redo}
            disabled={historyIndex >= history.length - 1}
            className="p-2 text-white hover:bg-gray-800 rounded-full transition-colors disabled:opacity-50"
          >
            <Redo2 size={20} />
          </button>
        </div>

        <button
          onClick={exportMedia}
          className="px-4 py-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors flex items-center space-x-2"
        >
          <Download size={20} />
          <span>Save</span>
        </button>
      </div>

      {/* Main Editor Area */}
      <div className="flex-1 flex">
        {/* Canvas Area */}
        <div className="flex-1 flex items-center justify-center bg-gray-950 relative">
          {mediaFile.type === 'image' ? (
            <ImageCanvas
              ref={canvasRef}
              mediaFile={mediaFile}
              filters={filters}
              textElements={textElements}
              stickerElements={stickerElements}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              onUpdateElement={updateElementPosition}
            />
          ) : (
            <VideoCanvas
              ref={videoRef}
              mediaFile={mediaFile}
              textElements={textElements}
              stickerElements={stickerElements}
              selectedElement={selectedElement}
              onSelectElement={setSelectedElement}
              onUpdateElement={updateElementPosition}
              currentTime={videoCurrentTime}
              onTimeUpdate={setVideoCurrentTime}
              segment={videoSegment}
              isMuted={isMuted}
            />
          )}
        </div>

        {/* Tool Panel */}
        <div className="w-80 bg-gray-900 overflow-y-auto">
          {renderToolPanel()}
        </div>
      </div>

      {/* Bottom Toolbar */}
      <EditorToolbar
        activeTool={activeTool}
        onToolChange={setActiveTool}
        mediaType={mediaFile.type}
      />

      {/* Video Timeline (only for videos) */}
      {mediaFile.type === 'video' && (
        <VideoTimeline
          duration={mediaFile.duration || 0}
          segment={videoSegment}
          onSegmentChange={setVideoSegment}
          currentTime={videoCurrentTime}
          onTimeChange={setVideoCurrentTime}
        />
      )}
    </div>
  );
};

export default MediaEditor;
