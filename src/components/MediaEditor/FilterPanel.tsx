import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Palette, Sparkles } from 'lucide-react';

interface FilterPanelProps {
  filters: any;
  setFilters: (filters: any) => void;
}

const presetFilters = [
  { id: 'none', name: 'Original', icon: '🎯', filter: {} },
  { id: 'vintage', name: 'Vintage', icon: '📷', filter: { sepia: 30, contrast: 110, brightness: 90 } },
  { id: 'warm', name: 'Warm', icon: '🌅', filter: { sepia: 20, brightness: 110, saturation: 120 } },
  { id: 'cold', name: 'Cold', icon: '❄️', filter: { brightness: 90, saturation: 80, contrast: 105 } },
  { id: 'dramatic', name: 'Dramatic', icon: '🎭', filter: { contrast: 140, brightness: 85, saturation: 110 } },
  { id: 'blackwhite', name: 'B&W', icon: '⚫', filter: { grayscale: 100, contrast: 120 } },
  { id: 'dreamy', name: 'Dreamy', icon: '✨', filter: { brightness: 115, saturation: 90, blur: 1 } },
  { id: 'vivid', name: 'Vivid', icon: '🌈', filter: { saturation: 150, contrast: 115, brightness: 105 } }
];

const adjustmentControls = [
  { id: 'brightness', name: 'Brightness', min: 0, max: 200, default: 100, icon: '☀️' },
  { id: 'contrast', name: 'Contrast', min: 0, max: 200, default: 100, icon: '◐' },
  { id: 'saturation', name: 'Saturation', min: 0, max: 200, default: 100, icon: '🎨' },
  { id: 'blur', name: 'Blur', min: 0, max: 10, default: 0, icon: '💫' },
  { id: 'sepia', name: 'Sepia', min: 0, max: 100, default: 0, icon: '📜' },
  { id: 'grayscale', name: 'Grayscale', min: 0, max: 100, default: 0, icon: '⚫' }
];

export const FilterPanel: React.FC<FilterPanelProps> = ({ filters, setFilters }) => {
  const [activeTab, setActiveTab] = useState<'presets' | 'adjustments'>('presets');

  const applyPresetFilter = (preset: typeof presetFilters[0]) => {
    setFilters({
      brightness: preset.filter.brightness || 100,
      contrast: preset.filter.contrast || 100,
      saturation: preset.filter.saturation || 100,
      blur: preset.filter.blur || 0,
      sepia: preset.filter.sepia || 0,
      grayscale: preset.filter.grayscale || 0
    });
  };

  const updateAdjustment = (key: string, value: number) => {
    setFilters({ ...filters, [key]: value });
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center space-x-2 mb-4">
        <Palette className="text-blue-400" size={20} />
        <h3 className="text-white font-semibold">Filters & Adjustments</h3>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 bg-gray-800 rounded-lg p-1">
        <button
          onClick={() => setActiveTab('presets')}
          className={`flex-1 py-2 px-3 rounded-md transition-colors ${
            activeTab === 'presets' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Presets
        </button>
        <button
          onClick={() => setActiveTab('adjustments')}
          className={`flex-1 py-2 px-3 rounded-md transition-colors ${
            activeTab === 'adjustments' 
              ? 'bg-blue-600 text-white' 
              : 'text-gray-400 hover:text-white'
          }`}
        >
          Adjustments
        </button>
      </div>

      {/* Preset Filters */}
      {activeTab === 'presets' && (
        <motion.div
          className="grid grid-cols-2 gap-3"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {presetFilters.map((preset, index) => (
            <motion.button
              key={preset.id}
              onClick={() => applyPresetFilter(preset)}
              className="bg-gray-800 hover:bg-gray-700 rounded-lg p-3 text-left transition-all hover:scale-105"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center space-x-3">
                <span className="text-2xl">{preset.icon}</span>
                <div>
                  <div className="text-white font-medium text-sm">{preset.name}</div>
                  <div className="text-gray-400 text-xs">Quick filter</div>
                </div>
              </div>
            </motion.button>
          ))}
        </motion.div>
      )}

      {/* Manual Adjustments */}
      {activeTab === 'adjustments' && (
        <motion.div
          className="space-y-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        >
          {adjustmentControls.map((control, index) => (
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
                className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer slider"
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

          {/* Reset Button */}
          <motion.button
            onClick={() => setFilters({
              brightness: 100,
              contrast: 100,
              saturation: 100,
              blur: 0,
              sepia: 0,
              grayscale: 0
            })}
            className="w-full py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors flex items-center justify-center space-x-2"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
          >
            <Sparkles size={16} />
            <span>Reset All Adjustments</span>
          </motion.button>
        </motion.div>
      )}
    </div>
  );
};

export default FilterPanel;
