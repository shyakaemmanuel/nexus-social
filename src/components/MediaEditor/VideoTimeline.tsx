import React, { useRef, useEffect, useState, useCallback } from 'react';
import { motion } from 'motion/react';
import { Scissors, Play, Pause, Volume2, VolumeX } from 'lucide-react';

interface VideoTimelineProps {
  duration: number;
  segment: { start: number; end: number };
  onSegmentChange: (segment: { start: number; end: number }) => void;
  currentTime: number;
  onTimeChange: (time: number) => void;
}

export const VideoTimeline: React.FC<VideoTimelineProps> = ({
  duration,
  segment,
  onSegmentChange,
  currentTime,
  onTimeChange
}) => {
  const timelineRef = useRef<HTMLDivElement>(null);
  const [isDraggingStart, setIsDraggingStart] = useState(false);
  const [isDraggingEnd, setIsDraggingEnd] = useState(false);
  const [isDraggingPlayhead, setIsDraggingPlayhead] = useState(false);
  const [timelineWidth, setTimelineWidth] = useState(0);

  // Update timeline width
  useEffect(() => {
    const updateWidth = () => {
      if (timelineRef.current) {
        setTimelineWidth(timelineRef.current.offsetWidth);
      }
    };

    updateWidth();
    window.addEventListener('resize', updateWidth);
    return () => window.removeEventListener('resize', updateWidth);
  }, []);

  // Convert time to pixels
  const timeToPixels = useCallback((time: number) => {
    return (time / duration) * timelineWidth;
  }, [duration, timelineWidth]);

  // Convert pixels to time
  const pixelsToTime = useCallback((pixels: number) => {
    return (pixels / timelineWidth) * duration;
  }, [duration, timelineWidth]);

  // Handle timeline click
  const handleTimelineClick = useCallback((e: React.MouseEvent) => {
    if (!timelineRef.current) return;
    
    const rect = timelineRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const time = pixelsToTime(x);
    
    onTimeChange(Math.max(0, Math.min(duration, time)));
  }, [pixelsToTime, duration, onTimeChange]);

  // Handle start handle drag
  const handleStartMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingStart(true);
  }, []);

  // Handle end handle drag
  const handleEndMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingEnd(true);
  }, []);

  // Handle playhead drag
  const handlePlayheadMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingPlayhead(true);
  }, []);

  // Handle mouse move
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!timelineRef.current) return;
      
      const rect = timelineRef.current.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const time = pixelsToTime(x);

      if (isDraggingStart) {
        const newStart = Math.max(0, Math.min(time, segment.end - 1));
        onSegmentChange({ ...segment, start: newStart });
      } else if (isDraggingEnd) {
        const newEnd = Math.min(duration, Math.max(time, segment.start + 1));
        onSegmentChange({ ...segment, end: newEnd });
      } else if (isDraggingPlayhead) {
        onTimeChange(Math.max(segment.start, Math.min(segment.end, time)));
      }
    };

    const handleMouseUp = () => {
      setIsDraggingStart(false);
      setIsDraggingEnd(false);
      setIsDraggingPlayhead(false);
    };

    if (isDraggingStart || isDraggingEnd || isDraggingPlayhead) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDraggingStart, isDraggingEnd, isDraggingPlayhead, pixelsToTime, segment, duration, onSegmentChange, onTimeChange]);

  // Format time display
  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
  };

  const startPixels = timeToPixels(segment.start);
  const endPixels = timeToPixels(segment.end);
  const currentPixels = timeToPixels(currentTime);

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-4">
      <div className="flex items-center space-x-4">
        {/* Time Display */}
        <div className="text-white text-sm font-mono min-w-[80px]">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>

        {/* Timeline */}
        <div className="flex-1">
          <div
            ref={timelineRef}
            className="relative h-12 bg-gray-800 rounded-lg cursor-pointer"
            onClick={handleTimelineClick}
          >
            {/* Full duration background */}
            <div className="absolute inset-0 bg-gray-700 rounded-lg" />
            
            {/* Selected segment */}
            <motion.div
              className="absolute h-full bg-blue-600 rounded-lg"
              style={{
                left: `${(startPixels / timelineWidth) * 100}%`,
                width: `${((endPixels - startPixels) / timelineWidth) * 100}%`
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.3 }}
            />
            
            {/* Timeline markers */}
            <div className="absolute inset-0 flex items-center">
              {Array.from({ length: Math.min(duration, 60) }, (_, i) => (
                <div
                  key={i}
                  className="absolute h-full border-l border-gray-600"
                  style={{ left: `${(i / duration) * 100}%` }}
                />
              ))}
            </div>
            
            {/* Start handle */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-ew-resize border-2 border-white shadow-lg"
              style={{ left: `${(startPixels / timelineWidth) * 100}%` }}
              onMouseDown={handleStartMouseDown}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
              drag="x"
              dragMomentum={false}
            />
            
            {/* End handle */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 w-4 h-4 bg-blue-500 rounded-full cursor-ew-resize border-2 border-white shadow-lg"
              style={{ left: `${(endPixels / timelineWidth) * 100}%` }}
              onMouseDown={handleEndMouseDown}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
              drag="x"
              dragMomentum={false}
            />
            
            {/* Playhead */}
            <motion.div
              className="absolute top-1/2 transform -translate-y-1/2 w-3 h-3 bg-red-500 rounded-full cursor-ns-resize border-2 border-white shadow-lg"
              style={{ left: `${(currentPixels / timelineWidth) * 100}%` }}
              onMouseDown={handlePlayheadMouseDown}
              whileHover={{ scale: 1.2 }}
              whileTap={{ scale: 0.8 }}
            />
          </div>
          
          {/* Time labels */}
          <div className="flex justify-between mt-1 text-xs text-gray-400">
            <span>0:00</span>
            <span>{formatTime(Math.floor(duration / 2))}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>

        {/* Trim Info */}
        <div className="text-white text-sm">
          <div className="flex items-center space-x-2">
            <Scissors size={16} />
            <span>Trim: {formatTime(segment.start)} - {formatTime(segment.end)}</span>
          </div>
          <div className="text-gray-400 text-xs">
            Duration: {formatTime(segment.end - segment.start)}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VideoTimeline;
