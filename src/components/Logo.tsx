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
  sm: { icon: 24, full: 100 },
  md: { icon: 32, full: 140 },
  lg: { icon: 48, full: 180 },
  xl: { icon: 64, full: 220 },
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
        <img
          src="/nexus social.png"
          alt="Nexus Logo"
          width={currentSize.icon}
          height={currentSize.icon}
          className="object-contain transition-transform duration-300"
          style={{ width: currentSize.icon, height: currentSize.icon }}
        />
      );
    }

    // Full logo and white variant use the same image
    const imageWidth = currentSize.full;
    const imageHeight = currentSize.full * 0.6; // Maintain aspect ratio (~600/1000)

    return (
      <img
        src="/nexus social.png"
        alt="Nexus Social"
        width={imageWidth}
        height={imageHeight}
        className="object-contain transition-opacity duration-300"
        style={{ 
          width: imageWidth, 
          height: imageHeight,
          filter: variant === 'white' ? 'brightness(1.2)' : 'none'
        }}
      />
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
