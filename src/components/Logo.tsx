import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  variant?: 'full' | 'icon' | 'white';
  size?: 'sm' | 'md' | 'lg' | 'xl';
  animated?: boolean;
  className?: string;
  onClick?: () => void;
}

const sizes = {
  sm: { icon: 24, full: { width: 100, height: 28 } },
  md: { icon: 32, full: { width: 140, height: 38 } },
  lg: { icon: 48, full: { width: 180, height: 48 } },
  xl: { icon: 64, full: { width: 220, height: 60 } },
};

export const Logo: React.FC<LogoProps> = ({ 
  variant = 'full', 
  size = 'md', 
  animated = true,
  className = '',
  onClick
}) => {
  const currentSize = sizes[size];
  const isClickable = !!onClick;
  
  const logoContent = () => {
    if (variant === 'icon') {
      return (
        <svg 
          width={currentSize.icon} 
          height={currentSize.icon} 
          viewBox="0 0 100 100" 
          fill="none"
          className="transition-transform duration-300"
        >
          <defs>
            <linearGradient id={`iconGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#6366f1"/>
              <stop offset="100%" stopColor="#8b5cf6"/>
            </linearGradient>
          </defs>
          <circle cx="50" cy="50" r="45" stroke={`url(#iconGradient-${size})`} strokeWidth="3" fill="none"/>
          <circle cx="50" cy="25" r="8" fill={`url(#iconGradient-${size})`}/>
          <circle cx="25" cy="65" r="8" fill={`url(#iconGradient-${size})`}/>
          <circle cx="75" cy="65" r="8" fill={`url(#iconGradient-${size})`}/>
          <line x1="50" y1="33" x2="25" y2="57" stroke={`url(#iconGradient-${size})`} strokeWidth="4" strokeLinecap="round"/>
          <line x1="50" y1="33" x2="75" y2="57" stroke={`url(#iconGradient-${size})`} strokeWidth="4" strokeLinecap="round"/>
          <line x1="25" y1="73" x2="75" y2="73" stroke={`url(#iconGradient-${size})`} strokeWidth="4" strokeLinecap="round"/>
        </svg>
      );
    }

    if (variant === 'white') {
      return (
        <svg 
          width={currentSize.full.width} 
          height={currentSize.full.height} 
          viewBox="0 0 300 80" 
          fill="none"
        >
          <defs>
            <linearGradient id={`logoGradientWhite-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#818cf8"/>
              <stop offset="100%" stopColor="#a78bfa"/>
            </linearGradient>
          </defs>
          <g transform="translate(10, 10)">
            <circle cx="30" cy="30" r="28" stroke={`url(#logoGradientWhite-${size})`} strokeWidth="2.5" fill="none"/>
            <circle cx="30" cy="12" r="5" fill={`url(#logoGradientWhite-${size})`}/>
            <circle cx="12" cy="40" r="5" fill={`url(#logoGradientWhite-${size})`}/>
            <circle cx="48" cy="40" r="5" fill={`url(#logoGradientWhite-${size})`}/>
            <line x1="30" y1="17" x2="15" y2="35" stroke={`url(#logoGradientWhite-${size})`} strokeWidth="3" strokeLinecap="round"/>
            <line x1="30" y1="17" x2="45" y2="35" stroke={`url(#logoGradientWhite-${size})`} strokeWidth="3" strokeLinecap="round"/>
            <line x1="15" y1="45" x2="45" y2="45" stroke={`url(#logoGradientWhite-${size})`} strokeWidth="3" strokeLinecap="round"/>
          </g>
          <text 
            x="85" 
            y="52" 
            fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
            fontSize="38" 
            fontWeight="800" 
            letterSpacing="2" 
            fill="#ffffff"
          >
            NEXUS
          </text>
        </svg>
      );
    }

    // Full logo (default)
    return (
      <svg 
        width={currentSize.full.width} 
        height={currentSize.full.height} 
        viewBox="0 0 300 80" 
        fill="none"
        className="transition-opacity duration-300 dark:opacity-90"
      >
        <defs>
          <linearGradient id={`logoGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#6366f1"/>
            <stop offset="100%" stopColor="#8b5cf6"/>
          </linearGradient>
          <linearGradient id={`textGradient-${size}`} x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#1f2937"/>
            <stop offset="100%" stopColor="#4b5563"/>
          </linearGradient>
        </defs>
        <g transform="translate(10, 10)">
          <circle cx="30" cy="30" r="28" stroke={`url(#logoGradient-${size})`} strokeWidth="2.5" fill="none"/>
          <circle cx="30" cy="12" r="5" fill={`url(#logoGradient-${size})`}/>
          <circle cx="12" cy="40" r="5" fill={`url(#logoGradient-${size})`}/>
          <circle cx="48" cy="40" r="5" fill={`url(#logoGradient-${size})`}/>
          <line x1="30" y1="17" x2="15" y2="35" stroke={`url(#logoGradient-${size})`} strokeWidth="3" strokeLinecap="round"/>
          <line x1="30" y1="17" x2="45" y2="35" stroke={`url(#logoGradient-${size})`} strokeWidth="3" strokeLinecap="round"/>
          <line x1="15" y1="45" x2="45" y2="45" stroke={`url(#logoGradient-${size})`} strokeWidth="3" strokeLinecap="round"/>
        </g>
        <text 
          x="85" 
          y="52" 
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" 
          fontSize="38" 
          fontWeight="800" 
          letterSpacing="2" 
          fill={`url(#textGradient-${size})`}
          className="dark:fill-white transition-colors duration-300"
        >
          NEXUS
        </text>
      </svg>
    );
  };

  const content = logoContent();

  if (animated) {
    return (
      <motion.div
        className={`inline-flex items-center ${isClickable ? 'cursor-pointer' : ''} ${className}`}
        onClick={onClick}
        whileHover={{ scale: isClickable ? 1.05 : 1.02 }}
        whileTap={{ scale: isClickable ? 0.95 : 0.98 }}
        transition={{ type: 'spring', stiffness: 400, damping: 17 }}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <div 
      className={`inline-flex items-center ${isClickable ? 'cursor-pointer hover:scale-105 transition-transform duration-300' : ''} ${className}`}
      onClick={onClick}
    >
      {content}
    </div>
  );
};

export default Logo;
