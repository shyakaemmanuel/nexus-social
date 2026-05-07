import React from 'react';
import { User } from '../types';
import { cn } from '../lib/utils';

interface UserStatusDotProps {
  user: User;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const UserStatusDot: React.FC<UserStatusDotProps> = ({ user, className, size = 'md' }) => {
  const getStatus = () => {
    // Check if user has disabled showing status in privacy settings
    if (user.settings?.privacy?.showStatus === false) return 'offline';

    if (user.status === 'busy') return 'busy';
    
    if (!user.lastActive) return 'offline';
    
    const lastActive = user.lastActive.toDate().getTime();
    const now = Date.now();
    const diff = now - lastActive;
    
    const FIVE_MINUTES = 5 * 60 * 1000;
    const FIFTEEN_MINUTES = 15 * 60 * 1000;
    
    if (diff < FIVE_MINUTES) return 'online';
    if (diff < FIFTEEN_MINUTES) return 'away';
    return 'offline';
  };

  const status = getStatus();

  const sizeClasses = {
    sm: 'w-2 h-2',
    md: 'w-3 h-3',
    lg: 'w-4 h-4'
  };

  const statusClasses = {
    online: 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]',
    away: 'bg-yellow-500 shadow-[0_0_8px_rgba(234,179,8,0.6)]',
    busy: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]',
    offline: 'bg-gray-400'
  };

  return (
    <div 
      className={cn(
        "rounded-full border-2 border-background",
        sizeClasses[size],
        statusClasses[status],
        className
      )}
      title={status.charAt(0).toUpperCase() + status.slice(1)}
    />
  );
};
