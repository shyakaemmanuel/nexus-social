import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { MediaFile, TextElement, StickerElement } from './MediaEditor';

interface VideoCanvasProps {
  ref: React.RefObject<HTMLVideoElement>;
  mediaFile: MediaFile;
  textElements: TextElement[];
  stickerElements: StickerElement[];
  selectedElement: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, x: number, y: number) => void;
  currentTime: number;
  onTimeUpdate: (time: number) => void;
  segment: { start: number; end: number };
  isMuted: boolean;
}

export const VideoCanvas: React.FC<VideoCanvasProps> = ({
  ref: videoRef,
  mediaFile,
  textElements,
  stickerElements,
  selectedElement,
  onSelectElement,
  onUpdateElement,
  currentTime,
  onTimeUpdate,
  segment,
  isMuted
}) => {
  const [videoSize, setVideoSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const [isPlaying, setIsPlaying] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Calculate container size
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const { width, height } = containerRef.current.getBoundingClientRect();
        setContainerSize({ width, height });
      }
    };

    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, []);

  // Calculate video display size
  useEffect(() => {
    if (containerSize.width && containerSize.height && mediaFile.width && mediaFile.height) {
      const containerAspect = containerSize.width / containerSize.height;
      const videoAspect = mediaFile.width / mediaFile.height;
      
      let displayWidth, displayHeight;
      
      if (videoAspect > containerAspect) {
        displayWidth = containerSize.width * 0.9;
        displayHeight = displayWidth / videoAspect;
      } else {
        displayHeight = containerSize.height * 0.9;
        displayWidth = displayHeight * videoAspect;
      }
      
      setVideoSize({ width: displayWidth, height: displayHeight });
    }
  }, [containerSize, mediaFile]);

  // Handle video time update
  const handleTimeUpdate = useCallback(() => {
    if (videoRef.current) {
      const time = videoRef.current.currentTime;
      onTimeUpdate(time);
      
      // Loop within segment
      if (time >= segment.end) {
        videoRef.current.currentTime = segment.start;
      }
    }
  }, [onTimeUpdate, segment]);

  // Handle play/pause
  const togglePlayPause = useCallback(() => {
    if (videoRef.current) {
      if (isPlaying) {
        videoRef.current.pause();
      } else {
        videoRef.current.play();
      }
      setIsPlaying(!isPlaying);
    }
  }, [isPlaying]);

  // Handle mouse down on element
  const handleElementMouseDown = useCallback((e: React.MouseEvent, elementId: string, elementX: number, elementY: number) => {
    e.preventDefault();
    e.stopPropagation();
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    setIsDragging(true);
    onSelectElement(elementId);
    setDragOffset({
      x: e.clientX - rect.left - elementX,
      y: e.clientY - rect.top - elementY
    });
  }, [onSelectElement]);

  // Handle mouse move for dragging
  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging || !selectedElement) return;
    
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    
    const newX = e.clientX - rect.left - dragOffset.x;
    const newY = e.clientY - rect.top - dragOffset.y;
    
    onUpdateElement(selectedElement, newX, newY);
  }, [isDragging, selectedElement, dragOffset, onUpdateElement]);

  // Handle mouse up
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
  }, []);

  // Handle container click (deselect)
  const handleContainerClick = useCallback(() => {
    onSelectElement(null);
  }, [onSelectElement]);

  // Filter elements based on video time (for time-based overlays)
  const getVisibleElements = () => {
    // For now, show all elements. In a real implementation, you'd have
    // timing data for each element and filter based on currentTime
    return {
      textElements,
      stickerElements
    };
  };

  const visibleElements = getVisibleElements();

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center cursor-default bg-black"
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Video Element */}
      <motion.div
        className="relative"
        style={{ width: videoSize.width, height: videoSize.height }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <video
          ref={videoRef}
          src={mediaFile.url}
          className="w-full h-full object-contain"
          muted={isMuted}
          onTimeUpdate={handleTimeUpdate}
          onLoadedMetadata={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = segment.start;
            }
          }}
          draggable={false}
        />
        
        {/* Text Overlays */}
        {visibleElements.textElements.map(textEl => (
          <motion.div
            key={textEl.id}
            className={`absolute cursor-move select-none ${
              selectedElement === textEl.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            }`}
            style={{
              left: textEl.x,
              top: textEl.y,
              fontSize: textEl.fontSize,
              fontFamily: textEl.fontFamily,
              color: textEl.color,
              transform: `rotate(${textEl.rotation}deg)`,
              opacity: textEl.opacity,
              textShadow: '2px 2px 4px rgba(0,0,0,0.5)'
            }}
            onMouseDown={(e) => handleElementMouseDown(e, textEl.id, textEl.x, textEl.y)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            whileDrag={{ scale: 1.05 }}
          >
            {textEl.text}
          </motion.div>
        ))}
        
        {/* Sticker Overlays */}
        {visibleElements.stickerElements.map(sticker => (
          <motion.div
            key={sticker.id}
            className={`absolute cursor-move select-none ${
              selectedElement === sticker.id ? 'ring-2 ring-blue-500 ring-offset-2' : ''
            }`}
            style={{
              left: sticker.x,
              top: sticker.y,
              fontSize: sticker.size,
              transform: `rotate(${sticker.rotation}deg)`,
              opacity: sticker.opacity
            }}
            onMouseDown={(e) => handleElementMouseDown(e, sticker.id, sticker.x, sticker.y)}
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.2 }}
            whileDrag={{ scale: 1.05 }}
          >
            {sticker.emoji}
          </motion.div>
        ))}
      </motion.div>

      {/* Video Controls Overlay */}
      <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 flex items-center space-x-4 bg-black/50 backdrop-blur-sm rounded-full px-6 py-3">
        <button
          onClick={togglePlayPause}
          className="text-white hover:text-blue-400 transition-colors"
        >
          {isPlaying ? '⏸️' : '▶️'}
        </button>
        
        <div className="text-white text-sm font-mono">
          {Math.floor(currentTime)}s / {Math.floor(segment.end)}s
        </div>
        
        <button
          onClick={() => {
            if (videoRef.current) {
              videoRef.current.currentTime = segment.start;
            }
          }}
          className="text-white hover:text-blue-400 transition-colors"
        >
          ⏮️
        </button>
      </div>

      {/* Selection indicator */}
      {selectedElement && (
        <motion.div
          className="absolute inset-0 pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="absolute top-2 right-2 bg-blue-600 text-white px-2 py-1 rounded text-xs">
            Drag to move
          </div>
        </motion.div>
      )}

      {/* Video segment indicator */}
      <div className="absolute top-2 left-2 bg-black/50 backdrop-blur-sm rounded px-2 py-1">
        <div className="text-white text-xs">
          Segment: {Math.floor(segment.start)}s - {Math.floor(segment.end)}s
        </div>
      </div>
    </div>
  );
};

export default VideoCanvas;
