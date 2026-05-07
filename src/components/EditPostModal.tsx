import React, { useState } from 'react';
import { motion } from 'motion/react';
import { X } from 'lucide-react';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { Post } from '../types';
import { TagInput } from './TagInput';

interface EditPostModalProps {
  post: Post;
  isOpen: boolean;
  onClose: () => void;
}

export const EditPostModal: React.FC<EditPostModalProps> = ({ post, isOpen, onClose }) => {
  const [content, setContent] = useState(post.content);
  const [tags, setTags] = useState<string[]>(post.tags || []);
  const [loading, setLoading] = useState(false);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim()) return;

    setLoading(true);
    try {
      await updateDoc(doc(db, 'posts', post.id), {
        content: content.trim(),
        tags,
        updatedAt: serverTimestamp()
      });
      onClose();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `posts/${post.id}`);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md">
      <motion.div
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        className="bg-background w-full max-w-md rounded-[2.5rem] p-8 shadow-2xl border border-border"
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-black tracking-tight text-primary">Edit Post</h2>
          <button onClick={onClose} className="p-2 hover:bg-surface rounded-full transition-colors">
            <X size={24} className="text-primary" />
          </button>
        </div>
        <form onSubmit={handleSave} className="space-y-6">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Content</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              className="w-full bg-surface border border-border rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-accent/20 focus:border-accent transition-all resize-none min-h-[150px]"
              placeholder="What's on your mind?"
              required
            />
          </div>
          
          <div className="space-y-2">
            <label className="text-[10px] font-black text-secondary uppercase tracking-[0.2em]">Tags</label>
            <TagInput tags={tags} setTags={setTags} />
          </div>

          {post.mediaUrl && (
            <div className="relative aspect-video rounded-2xl overflow-hidden border border-border bg-surface shadow-inner">
              {post.mediaType === 'video' ? (
                <video src={post.mediaUrl} className="w-full h-full object-cover" muted />
              ) : (
                <img src={post.mediaUrl} alt="Post media" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              )}
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center backdrop-blur-[2px]">
                <p className="text-white text-[10px] font-black uppercase tracking-[0.2em] px-4 py-2 bg-black/20 rounded-full border border-white/20">Media cannot be changed</p>
              </div>
            </div>
          )}
          
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-4 border border-border rounded-2xl text-[10px] font-black uppercase tracking-widest text-secondary hover:bg-surface transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !content.trim() || (content === post.content && JSON.stringify(tags) === JSON.stringify(post.tags))}
              className="flex-1 py-4 bg-accent text-white rounded-2xl text-[10px] font-black uppercase tracking-widest hover:bg-accent/90 transition-all disabled:opacity-50 shadow-lg shadow-accent/20"
            >
              {loading ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
};
