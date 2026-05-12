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
  const wrapperRadiusClass = variant === 'icon' ? 'rounded-full overflow-hidden' : 'rounded-3xl overflow-hidden';
  
  const logoContent = () => {
    if (variant === 'icon') {
      return (
        <img
          src="/nexus-icon.svg"
          alt="Nexus Icon"
          width={currentSize.icon}
          height={currentSize.icon}
          className="object-contain transition-transform duration-300 rounded-full"
          style={{ width: currentSize.icon, height: currentSize.icon, borderRadius: '9999px' }}
        />
      );
    }

    const imageWidth = currentSize.full;
    const imageHeight = currentSize.full * 0.6; // Maintain aspect ratio (~600/1000)
    const logoSrc = variant === 'white' ? '/nexus-logo-white.svg' : '/nexus-logo.svg';
    const logoAlt = variant === 'white' ? 'Nexus Social White Logo' : 'Nexus Social Logo';

    return (
      <img
        src={logoSrc}
        alt={logoAlt}
        width={imageWidth}
        height={imageHeight}
        className="object-contain transition-opacity duration-300 rounded-3xl"
        style={{ 
          width: imageWidth, 
          height: imageHeight,
          borderRadius: '18px'
        }}
      />
    );
  };

  const content = logoContent();

  if (animated) {
    return (
      <motion.div
        className={`inline-flex items-center ${wrapperRadiusClass} ${isClickable ? 'cursor-pointer' : ''} ${className}`}
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
      className={`inline-flex items-center ${wrapperRadiusClass} ${isClickable ? 'cursor-pointer hover:scale-105 transition-transform duration-300' : ''} ${className}`}
      onClick={onClick}
    >
      {content}
    </div>
  );
};

export default Logo;
