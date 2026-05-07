import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Crop, RotateCw, Maximize2, Move } from 'lucide-react';

interface CropToolProps {
  cropArea: { x: number; y: number; width: number; height: number };
  setCropArea: (cropArea: { x: number; y: number; width: number; height: number }) => void;
}

const aspectRatios = [
  { id: 'free', name: 'Free', ratio: null, icon: '🔓' },
  { id: '1:1', name: 'Square', ratio: 1, icon: '⬜' },
  { id: '16:9', name: 'Widescreen', ratio: 16/9, icon: '📺' },
  { id: '4:3', name: 'Standard', ratio: 4/3, icon: '🖼️' },
  { id: '9:16', name: 'Story', ratio: 9/16, icon: '📱' },
  { id: '3:2', name: 'Classic', ratio: 3/2, icon: '📷' }
];

export const CropTool: React.FC<CropToolProps> = ({ cropArea, setCropArea }) => {
  const [selectedRatio, setSelectedRatio] = useState('free');

  const applyAspectRatio = (ratio: number | null) => {
    if (!ratio) return;
    
    const currentWidth = cropArea.width;
    const newHeight = currentWidth / ratio;
    
    setCropArea({
      ...cropArea,
      height: newHeight
    });
  };

  const handleRatioChange = (ratioId: string, ratio: number | null) => {
    setSelectedRatio(ratioId);
    if (ratio) {
      applyAspectRatio(ratio);
    }
  };

  const resetCrop = () => {
    setCropArea({ x: 0, y: 0, width: 100, height: 100 });
    setSelectedRatio('free');
  };

  const flipHorizontal = () => {
    setCropArea({
      ...cropArea,
      x: 100 - cropArea.x - cropArea.width
    });
  };

  const flipVertical = () => {
    setCropArea({
      ...cropArea,
      y: 100 - cropArea.y - cropArea.height
    });
  };

  const rotate90 = () => {
    // Swap width and height, adjust position
    const centerX = cropArea.x + cropArea.width / 2;
    const centerY = cropArea.y + cropArea.height / 2;
    
    setCropArea({
      x: centerX - cropArea.height / 2,
      y: centerY - cropArea.width / 2,
      width: cropArea.height,
      height: cropArea.width
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Crop className="text-blue-400" size={20} />
        <h3 className="text-white font-semibold">Crop & Rotate</h3>
      </div>

      {/* Aspect Ratios */}
      <div className="space-y-3">
        <h4 className="text-white text-sm font-medium">Aspect Ratio</h4>
        <div className="grid grid-cols-3 gap-2">
          {aspectRatios.map((ratio, index) => (
            <motion.button
              key={ratio.id}
              onClick={() => handleRatioChange(ratio.id, ratio.ratio)}
              className={`p-3 rounded-lg text-center transition-all ${
                selectedRatio === ratio.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="text-2xl mb-1">{ratio.icon}</div>
              <div className="text-xs font-medium">{ratio.name}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Crop Controls */}
      <div className="space-y-4">
        <h4 className="text-white text-sm font-medium">Adjust Crop</h4>
        
        {/* X Position */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-gray-300 text-sm">X Position</label>
            <span className="text-blue-400 text-sm font-mono">{Math.round(cropArea.x)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={cropArea.x}
            onChange={(e) => setCropArea({ ...cropArea, x: Number(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Y Position */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-gray-300 text-sm">Y Position</label>
            <span className="text-blue-400 text-sm font-mono">{Math.round(cropArea.y)}%</span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={cropArea.y}
            onChange={(e) => setCropArea({ ...cropArea, y: Number(e.target.value) })}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Width */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-gray-300 text-sm">Width</label>
            <span className="text-blue-400 text-sm font-mono">{Math.round(cropArea.width)}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={cropArea.width}
            onChange={(e) => {
              const newWidth = Number(e.target.value);
              const maxWidth = 100 - cropArea.x;
              const finalWidth = Math.min(newWidth, maxWidth);
              setCropArea({ ...cropArea, width: finalWidth });
            }}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>

        {/* Height */}
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-gray-300 text-sm">Height</label>
            <span className="text-blue-400 text-sm font-mono">{Math.round(cropArea.height)}%</span>
          </div>
          <input
            type="range"
            min="10"
            max="100"
            value={cropArea.height}
            onChange={(e) => {
              const newHeight = Number(e.target.value);
              const maxHeight = 100 - cropArea.y;
              const finalHeight = Math.min(newHeight, maxHeight);
              setCropArea({ ...cropArea, height: finalHeight });
            }}
            className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
          />
        </div>
      </div>

      {/* Transform Controls */}
      <div className="space-y-3">
        <h4 className="text-white text-sm font-medium">Transform</h4>
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            onClick={rotate90}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <RotateCw size={16} />
            <span className="text-sm">Rotate 90°</span>
          </motion.button>
          
          <motion.button
            onClick={flipHorizontal}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Move size={16} />
            <span className="text-sm">Flip H</span>
          </motion.button>
          
          <motion.button
            onClick={flipVertical}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Move size={16} className="rotate-90" />
            <span className="text-sm">Flip V</span>
          </motion.button>
          
          <motion.button
            onClick={resetCrop}
            className="p-3 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-all flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            <Maximize2 size={16} />
            <span className="text-sm">Reset</span>
          </motion.button>
        </div>
      </div>

      {/* Crop Info */}
      <div className="bg-gray-800 rounded-lg p-3">
        <div className="text-gray-300 text-sm space-y-1">
          <div className="flex justify-between">
            <span>Position:</span>
            <span className="text-white font-mono">
              ({Math.round(cropArea.x)}, {Math.round(cropArea.y)})
            </span>
          </div>
          <div className="flex justify-between">
            <span>Size:</span>
            <span className="text-white font-mono">
              {Math.round(cropArea.width)} × {Math.round(cropArea.height)}
            </span>
          </div>
          <div className="flex justify-between">
            <span>Aspect Ratio:</span>
            <span className="text-white font-mono">
              {selectedRatio === 'free' 
                ? 'Free' 
                : (cropArea.width / cropArea.height).toFixed(2)
              }
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CropTool;
