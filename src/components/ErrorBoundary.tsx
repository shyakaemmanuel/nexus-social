import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';
import { motion } from 'motion/react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
    
    let detailedInfo = '';
    try {
      // Check if it's a Firestore error JSON
      const parsed = JSON.parse(error.message);
      if (parsed.operationType) {
        detailedInfo = `Firestore ${parsed.operationType} error at ${parsed.path || 'unknown path'}`;
      }
    } catch {
      detailedInfo = error.message;
    }

    this.setState({ errorInfo: detailedInfo });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-surface flex items-center justify-center p-6">
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full bg-background rounded-3xl shadow-2xl p-8 text-center border border-border"
          >
            <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle size={40} className="text-red-500" />
            </div>
            
            <h1 className="text-2xl font-bold text-primary mb-2">Something went wrong</h1>
            <p className="text-secondary text-sm mb-6 leading-relaxed">
              We encountered an unexpected error. This might be due to a connection issue or a temporary problem with our services.
            </p>

            {this.state.errorInfo && (
              <div className="bg-surface rounded-xl p-4 mb-8 text-left border border-border">
                <p className="text-[10px] font-bold text-secondary uppercase tracking-widest mb-1">Error Details</p>
                <p className="text-xs font-mono text-secondary break-all">{this.state.errorInfo}</p>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-background border border-border rounded-xl text-sm font-bold hover:bg-surface transition-all"
              >
                <RefreshCcw size={18} />
                <span>Retry</span>
              </button>
              <button
                onClick={this.handleReset}
                className="flex items-center justify-center space-x-2 py-3 px-4 bg-accent text-white rounded-xl text-sm font-bold hover:bg-accent/90 transition-all shadow-lg shadow-accent/20"
              >
                <Home size={18} />
                <span>Home</span>
              </button>
            </div>
          </motion.div>
        </div>
      );
    }

    return this.props.children;
  }
}
