import React from 'react';

interface LoadingStateProps {
  message?: string;
  showSpinner?: boolean;
}

const LoadingState: React.FC<LoadingStateProps> = ({ 
  message = 'Loading...', 
  showSpinner = true 
}) => {
  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center">
      <div className="text-center">
        {showSpinner && (
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
        )}
        <p className="text-white text-lg">{message}</p>
      </div>
    </div>
  );
};

export default LoadingState;
