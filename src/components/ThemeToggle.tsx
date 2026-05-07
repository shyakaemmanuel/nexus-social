import React from 'react';
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { motion } from 'motion/react';

export const ThemeToggle = () => {
  const { theme, toggleTheme } = useTheme();

  return (
    <button
      onClick={toggleTheme}
      className="p-2 bg-white dark:bg-zinc-800 border border-border rounded-full hover:bg-surface dark:hover:bg-zinc-700 transition-colors relative overflow-hidden group"
      aria-label="Toggle theme"
    >
      <motion.div
        initial={false}
        animate={{ y: theme === 'light' ? 0 : 40 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
      >
        <Sun size={20} className="text-amber-500" />
      </motion.div>
      <motion.div
        initial={false}
        animate={{ y: theme === 'dark' ? -20 : 20 }}
        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
        className="absolute top-0 left-0 w-full h-full flex items-center justify-center"
      >
        <Moon size={20} className="text-indigo-400" />
      </motion.div>
    </button>
  );
};
