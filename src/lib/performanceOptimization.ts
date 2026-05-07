import { useEffect, useRef, useState, useCallback } from 'react';

// Lazy loading for images and videos
export const useLazyLoad = (threshold: number = 0.1) => {
  const [isIntersecting, setIsIntersecting] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const elementRef = useRef<HTMLImageElement | HTMLVideoElement>(null);

  useEffect(() => {
    const element = elementRef.current;
    if (!element) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true);
          observer.disconnect();
        }
      },
      { threshold }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [threshold]);

  useEffect(() => {
    if (isIntersecting && elementRef.current && !hasLoaded) {
      const element = elementRef.current;
      
      if (element instanceof HTMLImageElement) {
        element.onload = () => setHasLoaded(true);
        element.src = element.dataset.src || element.src;
      } else if (element instanceof HTMLVideoElement) {
        element.onloadeddata = () => setHasLoaded(true);
        element.src = element.dataset.src || element.src;
      }
    }
  }, [isIntersecting, hasLoaded]);

  return { elementRef, hasLoaded, isIntersecting };
};

// Infinite scroll hook
export const useInfiniteScroll = (
  loadMore: () => void,
  hasMore: boolean,
  threshold: number = 100
) => {
  const [isLoading, setIsLoading] = useState(false);

  const handleScroll = useCallback(() => {
    if (
      window.innerHeight + document.documentElement.scrollTop >=
      document.documentElement.offsetHeight - threshold &&
      hasMore &&
      !isLoading
    ) {
      setIsLoading(true);
      loadMore();
      setTimeout(() => setIsLoading(false), 500);
    }
  }, [loadMore, hasMore, isLoading, threshold]);

  useEffect(() => {
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [handleScroll]);

  return { isLoading };
};

// Image optimization utilities
export class ImageOptimizer {
  static generateResponsiveUrl(
    url: string,
    width: number,
    height?: number,
    quality: number = 80
  ): string {
    if (!url) return '';
    
    // Cloudinary URL transformation
    if (url.includes('cloudinary.com')) {
      const transformations = [
        `w_${width}`,
        height ? `h_${height}` : '',
        `q_${quality}`,
        'c_fill',
        'f_auto'
      ].filter(Boolean).join(',');
      
      return url.replace('/upload/', `/upload/${transformations}/`);
    }
    
    // Fallback for other CDNs
    return url;
  }

  static generateSrcSet(
    url: string,
    sizes: number[],
    quality: number = 80
  ): string {
    return sizes
      .map(size => `${this.generateResponsiveUrl(url, size, undefined, quality)} ${size}w`)
      .join(', ');
  }

  static preloadImage(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = reject;
      img.src = url;
    });
  }

  static preloadVideo(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.onloadeddata = () => resolve();
      video.onerror = reject;
      video.src = url;
    });
  }
}

// Performance monitoring
export class PerformanceMonitor {
  private static metrics: Map<string, number> = new Map();

  static startTimer(name: string): void {
    this.metrics.set(name, performance.now());
  }

  static endTimer(name: string): number {
    const startTime = this.metrics.get(name);
    if (!startTime) return 0;
    
    const duration = performance.now() - startTime;
    this.metrics.delete(name);
    
    // Log performance metrics
    if (process.env.NODE_ENV === 'development') {
      console.log(`Performance: ${name} took ${duration.toFixed(2)}ms`);
    }
    
    return duration;
  }

  static measureAsync<T>(
    name: string,
    fn: () => Promise<T>
  ): Promise<T> {
    this.startTimer(name);
    return fn().finally(() => this.endTimer(name));
  }

  static getAverageRenderTime(): number {
    const renderTimes = Array.from(this.metrics.values());
    return renderTimes.length > 0 
      ? renderTimes.reduce((a, b) => a + b, 0) / renderTimes.length 
      : 0;
  }
}

// Memoization utilities
export class Memoization {
  private static cache = new Map<string, any>();

  static memoize<T extends (...args: any[]) => any>(
    fn: T,
    keyGenerator?: (...args: Parameters<T>) => string
  ): T {
    return ((...args: Parameters<T>) => {
      const key = keyGenerator ? keyGenerator(...args) : JSON.stringify(args);
      
      if (this.cache.has(key)) {
        return this.cache.get(key);
      }
      
      const result = fn(...args);
      this.cache.set(key, result);
      return result;
    }) as T;
  }

  static clearCache(): void {
    this.cache.clear();
  }

  static deleteFromCache(key: string): void {
    this.cache.delete(key);
  }
}

// Debounce utility
export const debounce = <T extends (...args: any[]) => any>(
  func: T,
  wait: number
): ((...args: Parameters<T>) => void) => {
  let timeout: NodeJS.Timeout;
  
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
};

// Throttle utility
export const throttle = <T extends (...args: any[]) => any>(
  func: T,
  limit: number
): ((...args: Parameters<T>) => void) => {
  let inThrottle: boolean;
  
  return (...args: Parameters<T>) => {
    if (!inThrottle) {
      func(...args);
      inThrottle = true;
      setTimeout(() => inThrottle = false, limit);
    }
  };
};

// Virtual scrolling for large lists
export class VirtualScroll {
  static calculateVisibleItems(
    scrollTop: number,
    containerHeight: number,
    itemHeight: number,
    totalItems: number,
    overscan: number = 5
  ): {
    startIndex: number;
    endIndex: number;
    offsetY: number;
  } {
    const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - overscan);
    const endIndex = Math.min(
      totalItems - 1,
      Math.ceil((scrollTop + containerHeight) / itemHeight) + overscan
    );
    const offsetY = startIndex * itemHeight;

    return { startIndex, endIndex, offsetY };
  }

  static getItemStyle(
    index: number,
    itemHeight: number,
    startIndex: number,
    offsetY: number
  ): React.CSSProperties {
    return {
      position: 'absolute',
      top: startIndex * itemHeight + (index - startIndex) * itemHeight - offsetY,
      left: 0,
      width: '100%',
      height: itemHeight
    };
  }
}

// Bundle size optimization
export class BundleOptimizer {
  static lazyImport<T>(
    importFn: () => Promise<T>
  ): () => Promise<T> {
    let cachedPromise: Promise<T> | null = null;
    
    return () => {
      if (!cachedPromise) {
        cachedPromise = importFn();
      }
      return cachedPromise;
    };
  }

  static preloadComponent<T>(
    importFn: () => Promise<T>
  ): void {
    // Start loading but don't wait
    importFn().catch(() => {
      // Ignore errors during preload
    });
  }
}

// Cache management
export class CacheManager {
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static set(key: string, data: any, ttl: number = 300000): void { // 5 minutes default
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  static get(key: string): any | null {
    const item = this.cache.get(key);
    if (!item) return null;
    
    if (Date.now() - item.timestamp > item.ttl) {
      this.cache.delete(key);
      return null;
    }
    
    return item.data;
  }

  static delete(key: string): void {
    this.cache.delete(key);
  }

  static clear(): void {
    this.cache.clear();
  }

  static cleanup(): void {
    const now = Date.now();
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp > item.ttl) {
        this.cache.delete(key);
      }
    }
  }
}

// Network optimization
export class NetworkOptimizer {
  static async fetchWithRetry(
    url: string,
    options: RequestInit = {},
    maxRetries: number = 3
  ): Promise<Response> {
    let lastError: Error;
    
    for (let i = 0; i <= maxRetries; i++) {
      try {
        const response = await fetch(url, options);
        if (response.ok) return response;
        
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      } catch (error) {
        lastError = error as Error;
        
        if (i < maxRetries) {
          // Exponential backoff
          const delay = Math.pow(2, i) * 1000;
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError!;
  }

  static compressData(data: any): string {
    return JSON.stringify(data);
  }

  static decompressData(compressed: string): any {
    return JSON.parse(compressed);
  }
}

export default {
  useLazyLoad,
  useInfiniteScroll,
  ImageOptimizer,
  PerformanceMonitor,
  Memoization,
  debounce,
  throttle,
  VirtualScroll,
  BundleOptimizer,
  CacheManager,
  NetworkOptimizer
};
