import React from 'react';

interface ErrorStateProps {
  error: string;
  onRetry?: () => void;
  retryLabel?: string;
}

const ErrorState: React.FC<ErrorStateProps> = ({ 
  error, 
  onRetry, 
  retryLabel = 'Retry' 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center px-4 py-8 max-w-2xl mx-auto">
        <div className="text-red-400 text-6xl mb-4">⚠️</div>
        <h1 className="text-white text-2xl font-bold mb-2">Connection Error</h1>
        <p className="text-gray-300 mb-4">{error}</p>
        {onRetry && (
          <button
            onClick={onRetry}
            className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded transition-colors"
          >
            {retryLabel}
          </button>
        )}
      </div>
    </div>
  );
};

export default ErrorState;
