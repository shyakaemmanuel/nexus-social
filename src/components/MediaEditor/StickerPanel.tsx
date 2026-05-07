import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Smile, Heart, Star, Laugh, ThumbsUp } from 'lucide-react';

interface StickerPanelProps {
  onAddSticker: (emoji: string) => void;
}

const stickerCategories = [
  { id: 'emotions', name: 'Emotions', icon: '😊' },
  { id: 'objects', name: 'Objects', icon: '🎯' },
  { id: 'nature', name: 'Nature', icon: '🌸' },
  { id: 'food', name: 'Food', icon: '🍕' },
  { id: 'activities', name: 'Activities', icon: '⚽' },
  { id: 'symbols', name: 'Symbols', icon: '💫' }
];

const stickerSets = {
  emotions: [
    '😀', '😃', '😄', '😁', '😆', '😅', '🤣', '😂', '🙂', '🙃',
    '😉', '😊', '😇', '🥰', '😍', '🤩', '😘', '😗', '😚', '😙',
    '😋', '😛', '😜', '🤪', '😝', '🤑', '🤗', '🤭', '🤫', '🤔',
    '😐', '😑', '😶', '😏', '😒', '🙄', '😬', '🤥', '😌', '😔',
    '😪', '🤤', '😴', '😷', '🤒', '🤕', '🤢', '🤮', '🤧', '🥵',
    '🥶', '😵', '🤯', '🤠', '🥳', '😎', '🤓', '🧐', '😕', '😟'
  ],
  objects: [
    '⌚', '📱', '📲', '💻', '⌨️', '🖥️', '🖨️', '🖱️', '🖱️', '🖱️',
    '🗄️', '💾', '💿', '📀', '📼', '📷', '📸', '📹', '🎥', '📽️',
    '🎞️', '📞', '☎️', '📟', '📠', '📺', '📻', '🎙️', '🎚️', '🎛️',
    '🧭', '⏱️', '⏲️', '⏰', '🕰️', '⌛', '⏳', '📡', '🔋', '🔌',
    '💡', '🔦', '🕯️', '🪔', '🔥', '💧', '🔨', '🔧', '🔩', '⚙️',
    '🧲', '🔫', '💣', '🧨', '🪓', '🔪', '🗡️', '⚔️', '🛡️', '🚬'
  ],
  nature: [
    '🌸', '💮', '🏵️', '🌹', '🥀', '🌺', '🌻', '🌼', '🌷', '🌱',
    '🪴', '🌲', '🌳', '🌴', '🌵', '🌾', '🌿', '☘️', '🍀', '🍁',
    '🍂', '🍃', '🍇', '🍈', '🍉', '🍊', '🍋', '🍌', '🍍', '🥭',
    '🍎', '🍏', '🍐', '🍑', '🍒', '🍓', '🫐', '🥝', '🍅', '🫒',
    '🥥', '🥑', '🍆', '🥔', '🥕', '🌽', '🌶️', '🫑', '🥒', '🥬',
    '🥦', '🧄', '🧅', '🍄', '🥜', '🌰', '🍞', '🥐', '🥖', '🫓'
  ],
  food: [
    '🥨', '🧀', '🥚', '🍳', '🧈', '🥞', '🧇', '🥓', '🥩', '🍗',
    '🍖', '🦴', '🌭', '🍔', '🍟', '🍕', '🫓', '🥪', '🥙', '🧆',
    '🌮', '🌯', '🫔', '🥗', '🥘', '🫕', '🍝', '🍜', '🍲', '🍛',
    '🍣', '🍱', '🥟', '🦪', '🍤', '🍙', '🍚', '🍘', '🍥', '🥠',
    '🥮', '🍢', '🍡', '🍧', '🍨', '🍦', '🥧', '🧁', '🍰', '🎂',
    '🍮', '🍭', '🍬', '🍫', '🍿', '🍩', '🍪', '🌰', '🥜', '🍯'
  ],
  activities: [
    '⚽', '🏀', '🏈', '⚾', '🥎', '🎾', '🏐', '🏉', '🥏', '🎱',
    '🪀', '🏓', '🏸', '🏒', '🏑', '🥍', '🏏', '🪃', '🥅', '⛳',
    '🪁', '🏹', '🎣', '🤿', '🥊', '🥋', '🎽', '🛹', '🛷', '⛸️',
    '🥌', '🎿', '⛷️', '🏂', '🪂', '🏋️', '🤼', '🤸', '🤺', '🤾',
    '🏌️', '🏇', '🧘', '🏄', '🏊', '🤽', '🚣', '🧗', '🚵', '🴼',
    '🤹', '🎪', '🎭', '🎨', '🎬', '🎤', '🎧', '🎼', '🎹', '🥁'
  ],
  symbols: [
    '❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '🤎', '💔',
    '❣️', '💕', '💞', '💓', '💗', '💖', '💘', '💝', '💟', '☮️',
    '✝️', '☪️', '🕉️', '☸️', '✡️', '🔯', '🕎', '☯️', '☦️', '🛐',
    '⛎', '♈', '♉', '♊', '♋', '♌', '♍', '♎', '♏', '♐',
    '♑', '♒', '♓', '🆔', '⚛️', '🉑', '☢️', '☣️', '📶', '🈁',
    '🈚', '🈯', '🈳', '🈵', '🈴', '🈲', '🉐', '🈹', '🈺', '🈶'
  ]
};

export const StickerPanel: React.FC<StickerPanelProps> = ({ onAddSticker }) => {
  const [activeCategory, setActiveCategory] = useState('emotions');
  const [searchTerm, setSearchTerm] = useState('');

  const currentStickers = stickerSets[activeCategory as keyof typeof stickerSets] || [];
  
  const filteredStickers = currentStickers.filter(sticker =>
    sticker.includes(searchTerm)
  );

  return (
    <div className="p-4 space-y-4">
      {/* Header */}
      <div className="flex items-center space-x-2">
        <Smile className="text-blue-400" size={20} />
        <h3 className="text-white font-semibold">Stickers & Emojis</h3>
      </div>

      {/* Search */}
      <div className="relative">
        <input
          type="text"
          placeholder="Search stickers..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full px-3 py-2 pl-9 bg-gray-800 text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <Smile className="absolute left-3 top-2.5 text-gray-400" size={16} />
      </div>

      {/* Categories */}
      <div className="grid grid-cols-3 gap-2">
        {stickerCategories.map((category, index) => (
          <motion.button
            key={category.id}
            onClick={() => {
              setActiveCategory(category.id);
              setSearchTerm('');
            }}
            className={`p-3 rounded-lg text-center transition-all ${
              activeCategory === category.id
                ? 'bg-blue-600 text-white'
                : 'bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white'
            }`}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05 }}
          >
            <div className="text-2xl mb-1">{category.icon}</div>
            <div className="text-xs font-medium">{category.name}</div>
          </motion.button>
        ))}
      </div>

      {/* Stickers Grid */}
      <div className="grid grid-cols-6 gap-2 max-h-96 overflow-y-auto">
        {filteredStickers.map((sticker, index) => (
          <motion.button
            key={sticker}
            onClick={() => onAddSticker(sticker)}
            className="p-3 bg-gray-800 hover:bg-gray-700 rounded-lg text-2xl transition-all hover:scale-110"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: index * 0.02 }}
          >
            {sticker}
          </motion.button>
        ))}
      </div>

      {/* No Results */}
      {filteredStickers.length === 0 && (
        <div className="text-center py-8">
          <Smile size={48} className="text-gray-600 mx-auto mb-4" />
          <p className="text-gray-400 text-sm">No stickers found</p>
        </div>
      )}

      {/* Popular Stickers */}
      <div className="border-t border-gray-700 pt-4">
        <h4 className="text-white text-sm font-medium mb-3">Popular</h4>
        <div className="flex space-x-2">
          {['❤️', '🔥', '😂', '👍', '✨', '🎉'].map((sticker, index) => (
            <motion.button
              key={sticker}
              onClick={() => onAddSticker(sticker)}
              className="p-2 bg-gray-800 hover:bg-gray-700 rounded-lg text-xl transition-all hover:scale-110"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              initial={{ opacity: 0, scale: 0 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.05 }}
            >
              {sticker}
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default StickerPanel;
