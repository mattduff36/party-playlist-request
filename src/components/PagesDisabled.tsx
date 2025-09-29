import React from 'react';

interface PagesDisabledProps {
  variant: 'requests' | 'display';
  eventConfig?: {
    event_title?: string;
    welcome_message?: string;
    secondary_message?: string;
    tertiary_message?: string;
  };
}

const PagesDisabled: React.FC<PagesDisabledProps> = ({ variant, eventConfig }) => {
  const isRequests = variant === 'requests';
  const title = isRequests ? 'Requests Disabled' : 'Display Disabled';
  const message = isRequests 
    ? 'The DJ has temporarily disabled song requests. Check back later!'
    : 'The DJ has temporarily disabled the display. Check back later!';

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4 sm:p-6 lg:p-8">
      <div className="text-center px-4 py-8 max-w-xs sm:max-w-md md:max-w-lg lg:max-w-2xl xl:max-w-4xl 2xl:max-w-6xl mx-auto">
        {/* Icon */}
        <div className="text-yellow-400 text-4xl sm:text-6xl lg:text-8xl xl:text-9xl 2xl:text-[10rem] mb-3 sm:mb-4 lg:mb-6">⏸️</div>
        
        {/* Title */}
        <h1 className="text-white text-xl sm:text-2xl md:text-3xl lg:text-4xl xl:text-5xl 2xl:text-6xl font-bold mb-2 sm:mb-3 lg:mb-4">{title}</h1>
        
        {/* Message */}
        <p className="text-gray-300 text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl mb-4 sm:mb-6 lg:mb-8">{message}</p>
        
        {/* Event Info */}
        {eventConfig && (
          <div className="space-y-2 sm:space-y-3 lg:space-y-4 text-gray-400">
            {eventConfig.event_title && (
              <p className="text-base sm:text-lg md:text-xl lg:text-2xl xl:text-3xl font-semibold text-white">{eventConfig.event_title}</p>
            )}
            {eventConfig.welcome_message && (
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl">{eventConfig.welcome_message}</p>
            )}
            {eventConfig.secondary_message && (
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl">{eventConfig.secondary_message}</p>
            )}
            {eventConfig.tertiary_message && (
              <p className="text-sm sm:text-base md:text-lg lg:text-xl xl:text-2xl">{eventConfig.tertiary_message}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PagesDisabled;
