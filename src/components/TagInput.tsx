import React, { useState } from 'react';
import { Tag, X } from 'lucide-react';

interface TagInputProps {
  tags: string[];
  setTags: React.Dispatch<React.SetStateAction<string[]>>;
}

export const TagInput: React.FC<TagInputProps> = ({ tags, setTags }) => {
  const [input, setInput] = useState('');

  const addTag = () => {
    const tag = input.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setInput('');
    }
  };

  const removeTag = (tagToRemove: string) => {
    setTags(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap gap-2">
        {tags.map(tag => (
          <span key={tag} className="flex items-center bg-accent/10 text-accent px-2 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider">
            #{tag}
            <button onClick={() => removeTag(tag)} className="ml-1.5 hover:text-accent/70 transition-colors">
              <X size={10} />
            </button>
          </span>
        ))}
      </div>
      <div className="flex items-center space-x-2">
        <div className="relative flex-1">
          <Tag className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary" size={14} />
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
            placeholder="Add tags (press Enter)"
            className="w-full bg-surface border border-border rounded-xl py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all"
          />
        </div>
        <button
          type="button"
          onClick={addTag}
          className="px-4 py-2 bg-surface border border-border rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-border transition-all"
        >
          Add
        </button>
      </div>
    </div>
  );
};
