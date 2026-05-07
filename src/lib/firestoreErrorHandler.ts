import { FirestoreError } from 'firebase/firestore';

export interface FirestoreErrorInfo {
  code: string;
  message: string;
  type: 'permission' | 'not-found' | 'timeout' | 'unavailable' | 'internal' | 'unknown';
  recoverable: boolean;
  userMessage: string;
}

export class FirestoreErrorHandler {
  private static errorCache = new Map<string, number>();
  private static readonly MAX_RETRIES = 3;
  private static readonly RETRY_DELAY = 1000;

  static handleError(error: unknown, context: string): FirestoreErrorInfo {
    if (error instanceof FirestoreError) {
      return this.parseFirestoreError(error, context);
    } else if (error instanceof Error) {
      return this.parseGenericError(error, context);
    } else {
      return this.parseUnknownError(error, context);
    }
  }

  private static parseFirestoreError(error: FirestoreError, context: string): FirestoreErrorInfo {
    const errorCode = error.code;
    const errorMessage = error.message;

    // Handle specific Firestore error codes
    switch (errorCode) {
      case 'permission-denied':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'permission',
          recoverable: false,
          userMessage: 'Permission denied. Please check your access rights.'
        };

      case 'not-found':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'not-found',
          recoverable: false,
          userMessage: 'The requested data was not found.'
        };

      case 'deadline-exceeded':
      case 'unavailable':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'timeout',
          recoverable: true,
          userMessage: 'Connection timeout. Please check your internet connection.'
        };

      case 'resource-exhausted':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: true,
          userMessage: 'Service temporarily unavailable. Please try again later.'
        };

      case 'failed-precondition':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: false,
          userMessage: 'Operation failed due to current state.'
        };

      case 'aborted':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: true,
          userMessage: 'Operation was cancelled. Please try again.'
        };

      case 'out-of-range':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: false,
          userMessage: 'Invalid request parameters.'
        };

      case 'unimplemented':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: false,
          userMessage: 'This feature is not yet available.'
        };

      case 'internal':
        // Handle INTERNAL ASSERTION FAILED errors specifically
        if (errorMessage.includes('INTERNAL ASSERTION FAILED')) {
          return {
            code: 'internal-assertion-failed',
            message: errorMessage,
            type: 'internal',
            recoverable: true,
            userMessage: 'Database synchronization error. Refreshing the page may help.'
          };
        }
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: true,
          userMessage: 'Internal server error. Please try again.'
        };

      case 'data-loss':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'internal',
          recoverable: false,
          userMessage: 'Data corruption detected. Please contact support.'
        };

      case 'unauthenticated':
        return {
          code: errorCode,
          message: errorMessage,
          type: 'permission',
          recoverable: false,
          userMessage: 'Authentication required. Please sign in again.'
        };

      default:
        return {
          code: errorCode,
          message: errorMessage,
          type: 'unknown',
          recoverable: true,
          userMessage: 'An unexpected error occurred. Please try again.'
        };
    }
  }

  private static parseGenericError(error: Error, context: string): FirestoreErrorInfo {
    return {
      code: 'generic-error',
      message: error.message,
      type: 'unknown',
      recoverable: true,
      userMessage: 'An unexpected error occurred. Please try again.'
    };
  }

  private static parseUnknownError(error: unknown, context: string): FirestoreErrorInfo {
    return {
      code: 'unknown-error',
      message: String(error),
      type: 'unknown',
      recoverable: true,
      userMessage: 'An unexpected error occurred. Please try again.'
    };
  }

  static shouldRetry(errorInfo: FirestoreErrorInfo, context: string): boolean {
    if (!errorInfo.recoverable) {
      return false;
    }

    const errorKey = `${errorInfo.code}-${context}`;
    const retryCount = this.errorCache.get(errorKey) || 0;

    if (retryCount >= this.MAX_RETRIES) {
      this.errorCache.delete(errorKey);
      return false;
    }

    this.errorCache.set(errorKey, retryCount + 1);
    return true;
  }

  static async retryOperation<T>(
    operation: () => Promise<T>,
    errorInfo: FirestoreErrorInfo,
    context: string
  ): Promise<T> {
    const retryCount = this.errorCache.get(`${errorInfo.code}-${context}`) || 0;
    const delay = this.RETRY_DELAY * Math.pow(2, retryCount - 1); // Exponential backoff

    await new Promise(resolve => setTimeout(resolve, delay));
    return operation();
  }

  static clearErrorCache(): void {
    this.errorCache.clear();
  }

  // Specific handler for INTERNAL ASSERTION FAILED errors
  static handleInternalAssertionError(error: FirestoreError, context: string): FirestoreErrorInfo {
    console.error('INTERNAL ASSERTION FAILED:', {
      code: error.code,
      message: error.message,
      context,
      timestamp: new Date().toISOString()
    });

    // This is often caused by Firestore client-side state issues
    return {
      code: 'internal-assertion-failed',
      message: error.message,
      type: 'internal',
      recoverable: true,
      userMessage: 'Database synchronization issue. This is usually temporary.'
    };
  }

  // Recovery strategies for different error types
  static getRecoveryStrategy(errorInfo: FirestoreErrorInfo): {
    action: 'retry' | 'refresh' | 'reauth' | 'fallback' | 'none';
    delay?: number;
    instructions?: string;
  } {
    switch (errorInfo.type) {
      case 'timeout':
        return {
          action: 'retry',
          delay: 2000,
          instructions: 'Check internet connection and retry'
        };

      case 'permission':
        return {
          action: 'reauth',
          instructions: 'Please sign in again to refresh permissions'
        };

      case 'internal':
        if (errorInfo.code === 'internal-assertion-failed') {
          return {
            action: 'refresh',
            instructions: 'Refresh the page to reset database connection'
          };
        }
        return {
          action: 'retry',
          delay: 3000,
          instructions: 'Wait a moment and try again'
        };

      case 'not-found':
        return {
          action: 'fallback',
          instructions: 'The requested content may have been removed'
        };

      default:
        return {
          action: 'retry',
          delay: 1000,
          instructions: 'Try the operation again'
        };
    }
  }

  // Log errors for monitoring
  static logError(errorInfo: FirestoreErrorInfo, context: string, additionalData?: any): void {
    const logData = {
      timestamp: new Date().toISOString(),
      error: errorInfo,
      context,
      additionalData,
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'unknown',
      url: typeof window !== 'undefined' ? window.location.href : 'unknown'
    };

    // In production, send to error monitoring service
    if (process.env.NODE_ENV === 'production') {
      // Example: Sentry.captureException(logData);
      console.error('Firestore Error:', logData);
    } else {
      console.error('Firestore Error:', logData);
    }
  }
}

// Enhanced error handler for React components
export const useFirestoreErrorHandler = () => {
  const handleError = (error: unknown, context: string, fallback?: () => void) => {
    const errorInfo = FirestoreErrorHandler.handleError(error, context);
    
    // Log the error
    FirestoreErrorHandler.logError(errorInfo, context);
    
    // Get recovery strategy
    const strategy = FirestoreErrorHandler.getRecoveryStrategy(errorInfo);
    
    // Execute recovery strategy
    switch (strategy.action) {
      case 'retry':
        if (strategy.delay) {
          setTimeout(() => {
            fallback?.();
          }, strategy.delay);
        }
        break;
        
      case 'refresh':
        if (typeof window !== 'undefined') {
          window.location.reload();
        }
        break;
        
      case 'reauth':
        // Redirect to login page
        if (typeof window !== 'undefined') {
          window.location.href = '/login';
        }
        break;
        
      case 'fallback':
        fallback?.();
        break;
        
      case 'none':
        // Just show the error message
        break;
    }
    
    return {
      errorInfo,
      strategy,
      userMessage: errorInfo.userMessage
    };
  };

  return { handleError };
};

export default FirestoreErrorHandler;
