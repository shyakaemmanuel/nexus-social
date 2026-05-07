import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { MediaFile, TextElement, StickerElement } from './MediaEditor';

interface ImageCanvasProps {
  ref: React.RefObject<HTMLCanvasElement>;
  mediaFile: MediaFile;
  filters: any;
  textElements: TextElement[];
  stickerElements: StickerElement[];
  selectedElement: string | null;
  onSelectElement: (id: string | null) => void;
  onUpdateElement: (id: string, x: number, y: number) => void;
}

export const ImageCanvas: React.FC<ImageCanvasProps> = ({
  ref: canvasRef,
  mediaFile,
  filters,
  textElements,
  stickerElements,
  selectedElement,
  onSelectElement,
  onUpdateElement
}) => {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imageRef = useRef<HTMLImageElement>(null);
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

  // Calculate image display size (fit to container)
  useEffect(() => {
    if (containerSize.width && containerSize.height && mediaFile.width && mediaFile.height) {
      const containerAspect = containerSize.width / containerSize.height;
      const imageAspect = mediaFile.width / mediaFile.height;
      
      let displayWidth, displayHeight;
      
      if (imageAspect > containerAspect) {
        displayWidth = containerSize.width * 0.9;
        displayHeight = displayWidth / imageAspect;
      } else {
        displayHeight = containerSize.height * 0.9;
        displayWidth = displayHeight * imageAspect;
      }
      
      setImageSize({ width: displayWidth, height: displayHeight });
    }
  }, [containerSize, mediaFile]);

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

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full flex items-center justify-center cursor-default"
      onClick={handleContainerClick}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Hidden canvas for export */}
      <canvas
        ref={canvasRef}
        className="hidden"
        width={mediaFile.width}
        height={mediaFile.height}
      />
      
      {/* Display image */}
      <motion.div
        className="relative"
        style={{ width: imageSize.width, height: imageSize.height }}
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.3 }}
      >
        <img
          ref={imageRef}
          src={mediaFile.url}
          alt="Edit"
          className="w-full h-full object-contain"
          style={{
            filter: `
              brightness(${filters.brightness}%) 
              contrast(${filters.contrast}%) 
              saturate(${filters.saturation}%) 
              blur(${filters.blur}px) 
              sepia(${filters.sepia}%) 
              grayscale(${filters.grayscale}%)
            `
          }}
          draggable={false}
        />
        
        {/* Text Overlays */}
        {textElements.map(textEl => (
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
        {stickerElements.map(sticker => (
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
    </div>
  );
};

export default ImageCanvas;
