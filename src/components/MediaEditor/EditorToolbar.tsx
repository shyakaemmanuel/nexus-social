import React from 'react';
import { motion } from 'motion/react';
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
  VolumeX
} from 'lucide-react';

interface EditorToolbarProps {
  activeTool: string;
  onToolChange: (tool: string) => void;
  mediaType: 'image' | 'video';
}

const tools = [
  { id: 'filters', icon: Palette, label: 'Filters', type: 'both' },
  { id: 'crop', icon: Crop, label: 'Crop', type: 'image' },
  { id: 'adjustments', icon: Sliders, label: 'Adjust', type: 'both' },
  { id: 'text', icon: Type, label: 'Text', type: 'both' },
  { id: 'stickers', icon: Smile, label: 'Stickers', type: 'both' },
  { id: 'music', icon: Music, label: 'Music', type: 'video' },
  { id: 'trim', icon: Scissors, label: 'Trim', type: 'video' },
];

export const EditorToolbar: React.FC<EditorToolbarProps> = ({
  activeTool,
  onToolChange,
  mediaType
}) => {
  const filteredTools = tools.filter(tool => 
    tool.type === 'both' || tool.type === mediaType
  );

  return (
    <div className="bg-gray-900 border-t border-gray-800 p-4">
      <div className="flex justify-center space-x-2">
        {filteredTools.map((tool, index) => {
          const Icon = tool.icon;
          const isActive = activeTool === tool.id;
          
          return (
            <motion.button
              key={tool.id}
              onClick={() => onToolChange(tool.id)}
              className={`relative flex flex-col items-center p-3 rounded-xl transition-all ${
                isActive 
                  ? 'bg-blue-600 text-white' 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
              }`}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Icon size={20} />
              <span className="text-xs mt-1 font-medium">{tool.label}</span>
              
              {isActive && (
                <motion.div
                  className="absolute -top-1 -right-1 w-2 h-2 bg-white rounded-full"
                  layoutId="activeTool"
                />
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
};

export default EditorToolbar;
