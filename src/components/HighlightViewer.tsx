import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, ChevronLeft, ChevronRight, MoreHorizontal } from 'lucide-react';
import { Story } from '../types';
import { db } from '../lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { VideoPlayer } from './VideoPlayer';

interface HighlightViewerProps {
  stories: Story[];
  isOpen: boolean;
  onClose: () => void;
  highlightTitle?: string;
}

export const HighlightViewer: React.FC<HighlightViewerProps> = ({ stories, isOpen, onClose, highlightTitle }) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef<NodeJS.Timeout | null>(null);
  const STORY_DURATION = 5000; // 5 seconds per story

  const currentStory = stories[currentIndex];

  useEffect(() => {
    if (!isOpen) return;

    // Reset progress
    setProgress(0);

    // Start progress interval
    if (progressInterval.current) clearInterval(progressInterval.current);

    const step = 100; // update every 100ms
    const increment = (step / STORY_DURATION) * 100;

    progressInterval.current = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          handleNext();
          return 100;
        }
        return prev + increment;
      });
    }, step);

    return () => {
      if (progressInterval.current) clearInterval(progressInterval.current);
    };
  }, [currentIndex, isOpen, currentStory]);

  const handleNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  if (!isOpen || !currentStory) return null;

  return (
    <div className="fixed inset-0 z-[200] bg-black flex items-center justify-center">
      <div className="relative w-full max-w-lg h-full md:h-[90vh] md:rounded-2xl overflow-hidden bg-zinc-900">
        {/* Progress Bars */}
        <div className="absolute top-4 left-4 right-4 z-50 flex space-x-1">
          {stories.map((_, idx) => (
            <div key={idx} className="h-1 flex-1 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full bg-white transition-all duration-100 ease-linear"
                style={{
                  width: idx < currentIndex ? '100%' : idx === currentIndex ? `${progress}%` : '0%'
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="absolute top-8 left-4 right-4 z-50 flex items-center justify-between text-white">
          <div className="flex items-center space-x-3">
            <img
              src={currentStory.authorPhoto || `https://ui-avatars.com/api/?name=${currentStory.authorName}&background=random`}
              alt={currentStory.authorName}
              className="w-8 h-8 rounded-full object-cover border border-white/20"
            />
            <div>
              <p className="font-bold text-sm shadow-sm">{currentStory.authorName}</p>
              {highlightTitle && (
                <p className="text-[10px] text-white/70 uppercase tracking-widest">{highlightTitle}</p>
              )}
            </div>
          </div>
          <div className="flex items-center space-x-4">
            <MoreHorizontal size={20} className="cursor-pointer" />
            <X size={24} className="cursor-pointer" onClick={onClose} />
          </div>
        </div>

        {/* Media */}
        <div className="w-full h-full flex items-center justify-center">
          {currentStory.mediaType === 'text' ? (
            <div
              className="w-full h-full flex items-center justify-center p-8"
              style={{ backgroundColor: currentStory.backgroundColor || '#FF6B6B' }}
            >
              <p className="text-white text-2xl md:text-3xl font-bold text-center leading-relaxed">
                {currentStory.textContent}
              </p>
              {currentStory.stickers && currentStory.stickers.length > 0 && (
                <div className="absolute inset-0 pointer-events-none">
                  {currentStory.stickers.map((sticker, idx) => (
                    <span
                      key={idx}
                      className="absolute text-6xl"
                      style={{
                        top: `${20 + (idx * 15)}%`,
                        left: `${20 + (idx * 20)}%`,
                        transform: `rotate(${idx * 15}deg)`
                      }}
                    >
                      {sticker}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ) : currentStory.mediaType === 'video' ? (
            <video
              src={currentStory.mediaUrl}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-contain"
              onEnded={handleNext}
            />
          ) : (
            <img
              src={currentStory.mediaUrl}
              alt="Story"
              className="w-full h-full object-contain"
              referrerPolicy="no-referrer"
            />
          )}
        </div>

        {/* Navigation Overlays */}
        <div className="absolute inset-0 flex">
          <div className="w-1/3 h-full cursor-pointer" onClick={handlePrev} />
          <div className="w-2/3 h-full cursor-pointer" onClick={handleNext} />
        </div>

        {/* Navigation Buttons (Desktop) */}
        <button
          onClick={handlePrev}
          className={`absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hidden md:block ${currentIndex === 0 ? 'opacity-0 pointer-events-none' : ''}`}
        >
          <ChevronLeft size={24} />
        </button>
        <button
          onClick={handleNext}
          className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-white/10 hover:bg-white/20 rounded-full text-white transition-colors hidden md:block"
        >
          <ChevronRight size={24} />
        </button>
      </div>
    </div>
  );
};
