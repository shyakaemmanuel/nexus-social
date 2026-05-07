import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Type, Plus, Trash2, Palette, Move, RotateCw } from 'lucide-react';
import { TextElement } from './MediaEditor';

interface TextOverlayProps {
  elements: TextElement[];
  selectedElement: string | null;
  onUpdate: (elements: TextElement[]) => void;
  onAdd: () => void;
}

const fontFamilies = [
  'Arial', 'Helvetica', 'Times New Roman', 'Georgia', 
  'Courier New', 'Verdana', 'Comic Sans MS', 'Impact'
];

const colorPresets = [
  '#FFFFFF', '#000000', '#FF0000', '#00FF00', '#0000FF',
  '#FFFF00', '#FF00FF', '#00FFFF', '#FFA500', '#800080'
];

export const TextOverlay: React.FC<TextOverlayProps> = ({
  elements,
  selectedElement,
  onUpdate,
  onAdd
}) => {
  const selectedTextElement = elements.find(el => el.id === selectedElement);

  const updateSelectedElement = (updates: Partial<TextElement>) => {
    if (!selectedElement) return;
    
    const updatedElements = elements.map(el => 
      el.id === selectedElement ? { ...el, ...updates } : el
    );
    onUpdate(updatedElements);
  };

  const deleteSelectedElement = () => {
    if (!selectedElement) return;
    
    const updatedElements = elements.filter(el => el.id !== selectedElement);
    onUpdate(updatedElements);
  };

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <Type className="text-blue-400" size={20} />
          <h3 className="text-white font-semibold">Text Overlays</h3>
        </div>
        <button
          onClick={onAdd}
          className="p-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <Plus size={16} />
        </button>
      </div>

      {/* Text Elements List */}
      {elements.length > 0 && (
        <div className="space-y-2">
          {elements.map((element, index) => (
            <motion.div
              key={element.id}
              className={`p-3 rounded-lg cursor-pointer transition-colors ${
                selectedElement === element.id 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => selectedElement !== element.id && onUpdate(elements)}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <Type size={16} />
                  <span className="text-sm font-medium truncate">
                    {element.text}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (selectedElement === element.id) {
                      deleteSelectedElement();
                    }
                  }}
                  className="p-1 hover:bg-red-500 rounded transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {/* Selected Element Controls */}
      {selectedTextElement && (
        <motion.div
          className="space-y-4 bg-gray-800 rounded-lg p-4"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          {/* Text Input */}
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Text</label>
            <input
              type="text"
              value={selectedTextElement.text}
              onChange={(e) => updateSelectedElement({ text: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="Enter your text"
            />
          </div>

          {/* Font Family */}
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Font</label>
            <select
              value={selectedTextElement.fontFamily}
              onChange={(e) => updateSelectedElement({ fontFamily: e.target.value })}
              className="w-full px-3 py-2 bg-gray-700 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {fontFamilies.map(font => (
                <option key={font} value={font}>{font}</option>
              ))}
            </select>
          </div>

          {/* Font Size */}
          <div>
            <label className="text-white text-sm font-medium mb-2 block">
              Size: {selectedTextElement.fontSize}px
            </label>
            <input
              type="range"
              min="12"
              max="120"
              value={selectedTextElement.fontSize}
              onChange={(e) => updateSelectedElement({ fontSize: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Color */}
          <div>
            <label className="text-white text-sm font-medium mb-2 block">Color</label>
            <div className="grid grid-cols-5 gap-2 mb-2">
              {colorPresets.map(color => (
                <button
                  key={color}
                  onClick={() => updateSelectedElement({ color })}
                  className={`w-8 h-8 rounded-lg border-2 ${
                    selectedTextElement.color === color 
                      ? 'border-blue-500' 
                      : 'border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <input
              type="color"
              value={selectedTextElement.color}
              onChange={(e) => updateSelectedElement({ color: e.target.value })}
              className="w-full h-10 bg-gray-700 rounded-lg cursor-pointer"
            />
          </div>

          {/* Rotation */}
          <div>
            <label className="text-white text-sm font-medium mb-2 block">
              Rotation: {selectedTextElement.rotation}°
            </label>
            <input
              type="range"
              min="-180"
              max="180"
              value={selectedTextElement.rotation}
              onChange={(e) => updateSelectedElement({ rotation: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          {/* Opacity */}
          <div>
            <label className="text-white text-sm font-medium mb-2 block">
              Opacity: {Math.round(selectedTextElement.opacity * 100)}%
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={selectedTextElement.opacity * 100}
              onChange={(e) => updateSelectedElement({ opacity: Number(e.target.value) / 100 })}
              className="w-full"
            />
          </div>
        </motion.div>
      )}

      {/* Empty State */}
      {elements.length === 0 && (
        <div className="text-center py-8">
          <Type size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">No text overlays yet</p>
          <button
            onClick={onAdd}
            className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto"
          >
            <Plus size={16} />
            <span>Add Text</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default TextOverlay;
