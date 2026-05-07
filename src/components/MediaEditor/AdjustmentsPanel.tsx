import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Sliders, RotateCw, Zap, Sun, Contrast, Droplets } from 'lucide-react';

interface AdjustmentsPanelProps {
  filters: any;
  setFilters: (filters: any) => void;
}

const quickPresets = [
  { id: 'auto', name: 'Auto Enhance', icon: '🔮', adjustments: { brightness: 105, contrast: 105, saturation: 110 } },
  { id: 'brighten', name: 'Brighten', icon: '☀️', adjustments: { brightness: 120, contrast: 95, saturation: 105 } },
  { id: 'darken', name: 'Darken', icon: '🌙', adjustments: { brightness: 80, contrast: 110, saturation: 90 } },
  { id: 'vivid', name: 'Vivid', icon: '🌈', adjustments: { brightness: 105, contrast: 115, saturation: 150 } },
  { id: 'muted', name: 'Muted', icon: '🎨', adjustments: { brightness: 95, contrast: 95, saturation: 70 } },
  { id: 'dramatic', name: 'Dramatic', icon: '🎭', adjustments: { brightness: 85, contrast: 140, saturation: 120 } }
];

const advancedAdjustments = [
  { 
    id: 'exposure', 
    name: 'Exposure', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '📸',
    description: 'Overall brightness of the image'
  },
  { 
    id: 'highlights', 
    name: 'Highlights', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '💡',
    description: 'Adjust the brightest areas'
  },
  { 
    id: 'shadows', 
    name: 'Shadows', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '🌑',
    description: 'Adjust the darkest areas'
  },
  { 
    id: 'whites', 
    name: 'Whites', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '⬜',
    description: 'Set the white point'
  },
  { 
    id: 'blacks', 
    name: 'Blacks', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '⬛',
    description: 'Set the black point'
  },
  { 
    id: 'clarity', 
    name: 'Clarity', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '🔍',
    description: 'Add mid-tone contrast'
  },
  { 
    id: 'vibrance', 
    name: 'Vibrance', 
    min: -100, 
    max: 100, 
    default: 0, 
    icon: '🎨',
    description: 'Saturate less saturated colors more'
  },
  { 
    id: 'sharpness', 
    name: 'Sharpness', 
    min: 0, 
    max: 100, 
    default: 0, 
    icon: '🔪',
    description: 'Enhance edge details'
  }
];

export const AdjustmentsPanel: React.FC<AdjustmentsPanelProps> = ({ filters, setFilters }) => {
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic');
  const [showDetails, setShowDetails] = useState(false);

  const applyQuickPreset = (preset: typeof quickPresets[0]) => {
    setFilters({
      ...filters,
      ...preset.adjustments
    });
  };

  const updateAdjustment = (key: string, value: number) => {
    setFilters({ ...filters, [key]: value });
  };

  const resetAllAdjustments = () => {
    setFilters({
      brightness: 100,
      contrast: 100,
      saturation: 100,
      blur: 0,
      sepia: 0,
      grayscale: 0
    });
  };

  const autoEnhance = () => {
    // Simple auto-enhancement algorithm
    const avgBrightness = filters.brightness;
    const avgContrast = filters.contrast;
    const avgSaturation = filters.saturation;
    
    const enhancements = {
      brightness: avgBrightness < 90 ? 110 : avgBrightness > 110 ? 95 : 105,
      contrast: avgContrast < 90 ? 110 : avgContrast > 110 ? 95 : 105,
      saturation: avgSaturation < 80 ? 120 : avgSaturation > 120 ? 90 : 110
    };
    
    setFilters({
      ...filters,
      ...enhancements
    });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Sliders className="text-blue-400" size={20} />
          <h3 className="text-white font-semibold">Adjustments</h3>
        </div>
        <button
          onClick={autoEnhance}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          title="Auto Enhance"
        >
          <Zap size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('basic')}
          className={`flex-1 py-2 px-3 rounded-md transition-colors ${
            activeTab === 'basic' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Basic
        </button>
        <button
          onClick={() => setActiveTab('advanced')}
          className={`flex-1 py-2 px-3 rounded-md transition-colors ${
            activeTab === 'advanced' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Advanced
        </button>
      </div>

      {/* Quick Presets */}
      {activeTab === 'basic' && (
        <motion.div
          className="space-y-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          <div className="grid grid-cols-2 gap-2">
            {quickPresets.map((preset, index) => (
              <motion.button
                key={preset.id}
                onClick={() => applyQuickPreset(preset)}
                className="bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left transition-all hover:scale-105"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center space-x-2">
                  <span className="text-xl">{preset.icon}</span>
                  <span className="text-white text-sm font-medium">{preset.name}</span>
                </div>
              </motion.button>
            ))}
          </div>

          {/* Basic Adjustments */}
          <div className="space-y-4">
            {[
              { id: 'brightness', name: 'Brightness', icon: '☀️', min: 0, max: 200 },
              { id: 'contrast', name: 'Contrast', icon: '◐', min: 0, max: 200 },
              { id: 'saturation', name: 'Saturation', icon: '🎨', min: 0, max: 200 }
            ].map((control, index) => (
              <motion.div
                key={control.id}
                className="space-y-2"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className="text-lg">{control.icon}</span>
                    <label className="text-white text-sm font-medium">
                      {control.name}
                    </label>
                  </div>
                  <span className="text-blue-400 text-sm font-mono">
                    {filters[control.id]}
                  </span>
                </div>
                <input
                  type="range"
                  min={control.min}
                  max={control.max}
                  value={filters[control.id]}
                  onChange={(e) => updateAdjustment(control.id, Number(e.target.value))}
                  className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
                  style={{
                    background: `linear-gradient(to right, #3B82F6 0%, #3B82F6 ${
                      ((filters[control.id] - control.min) / (control.max - control.min)) * 100
                    }%, #374151 ${
                      ((filters[control.id] - control.min) / (control.max - control.min)) * 100
                    }%, #374151 100%)`
                  }}
                />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Advanced Adjustments */}
      {activeTab === 'advanced' && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {advancedAdjustments.map((adjustment, index) => (
            <motion.div
              key={adjustment.id}
              className="space-y-2"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-lg">{adjustment.icon}</span>
                  <div>
                    <label className="text-white text-sm font-medium">
                      {adjustment.name}
                    </label>
                    {showDetails && (
                      <div className="text-gray-400 text-xs">
                        {adjustment.description}
                      </div>
                    )}
                  </div>
                </div>
                <span className="text-blue-400 text-sm font-mono">
                  {filters[adjustment.id] || adjustment.default}
                </span>
              </div>
              <input
                type="range"
                min={adjustment.min}
                max={adjustment.max}
                value={filters[adjustment.id] || adjustment.default}
                onChange={(e) => updateAdjustment(adjustment.id, Number(e.target.value))}
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
              />
            </motion.div>
          ))}

          {/* Toggle Details */}
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-blue-400 text-sm hover:text-blue-300 transition-colors"
          >
            {showDetails ? 'Hide' : 'Show'} descriptions
          </button>
        </motion.div>
      )}

      {/* Reset Button */}
      <motion.button
        onClick={resetAllAdjustments}
        className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
      >
        <RotateCw size={16} />
        <span>Reset All Adjustments</span>
      </motion.button>

      {/* Current Settings Summary */}
      <div className="bg-gray-800 rounded-lg p-3">
        <h4 className="text-white text-sm font-medium mb-2">Current Settings</h4>
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex justify-between">
            <span className="text-gray-400">Brightness:</span>
            <span className="text-white">{filters.brightness}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Contrast:</span>
            <span className="text-white">{filters.contrast}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Saturation:</span>
            <span className="text-white">{filters.saturation}%</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Blur:</span>
            <span className="text-white">{filters.blur}px</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdjustmentsPanel;
