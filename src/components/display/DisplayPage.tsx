'use client';

import { MonitorOff } from 'lucide-react';
import PartyNotStarted from '@/components/PartyNotStarted';
import MoodShell from '@/components/MoodShell';
import PageLoader from '@/components/ui/PageLoader';
import NowPlayingPanel from './NowPlayingPanel';
import QueuePanel from './QueuePanel';
import QrPanel from './QrPanel';
import ScrollingBar from './ScrollingBar';
import MessageOverlay from './MessageOverlay';
import { useDisplayData } from './useDisplayData';

interface DisplayPageProps {
  username: string;
  accessCode?: string;
}

interface StatusDotsProps {
  isConnected: boolean;
  connectionState: string;
  spotifyConnected: boolean;
}

function StatusDots({ isConnected, connectionState, spotifyConnected }: StatusDotsProps) {
  // Theme-independent colors so mood accents (e.g. Club Night pink) never recolor these
  return (
    <div className="fixed top-4 left-4 flex space-x-2 z-50 pointer-events-none">
      {/* Pusher realtime connection */}
      <div
        className={`w-3 h-3 rounded-full opacity-60 ${
          isConnected ? 'bg-green-500 animate-pulse' : 'bg-red-500'
        }`}
        title={`Pusher: ${connectionState}`}
      />
      {/* Spotify / current-track presence */}
      <div
        className={`w-3 h-3 rounded-full opacity-60 ${
          spotifyConnected ? 'bg-green-500' : 'bg-zinc-500'
        }`}
        title={spotifyConnected ? 'Spotify Connected' : 'No Current Track'}
      />
    </div>
  );
}

// Main display page component with ALL original animations preserved
export default function DisplayPage({ username, accessCode }: DisplayPageProps) {
  const {
    currentTrack,
    upcomingSongs,
    guestAccessCode,
    eventSettings,
    moodConfirmed,
    qrCodeUrl,
    deviceType,
    animatingCards,
    mounted,
    sanitizeName,
    currentMessage,
    isMessageVisible,
    isVerticalExpanded,
    showMessageText,
    finalUseHorizontalLayout,
    isConnected,
    connectionState,
    nowPlayingRef,
    globalState,
    gradientStyle,
    displayContent,
    dynamicDuration,
    messageTextColor,
    spotifyConnected,
  } = useDisplayData({ username, accessCode });

  // Show loading state while mounting, waiting for global state, or server mood
  const isLoadingEssentialData = !mounted || globalState.isLoading || !moodConfirmed;

  if (isLoadingEssentialData) {
    return (
      <PageLoader
        label={!moodConfirmed ? 'Loading display...' : 'Preparing display...'}
      />
    );
  }

  // Check event status and page controls using global state (with safety checks)
  const isOffline = globalState?.status === 'offline';
  const isStandby = globalState?.status === 'standby';
  const isLive = globalState?.status === 'live';
  const displayEnabled = globalState?.pagesEnabled?.display ?? true;

  // Show "Party Not Started" when offline
  if (isOffline) {
    console.log('🎉 DisplayPage: Party Not Started (offline)');
    return <PartyNotStarted variant="display" />;
  }

  // Show "Display Disabled" when in standby or live but display is disabled
  if ((isStandby || isLive) && !displayEnabled) {
    console.log('🚫 DisplayPage: Display Disabled');
    return (
      <MoodShell
        mood={eventSettings?.display_mood}
        legacyPrimaryColor={eventSettings?.theme_primary_color}
      >
        <div className="min-h-screen flex items-center justify-center" style={gradientStyle}>
          <div className="text-center px-4">
            <div className="flex justify-center mb-6">
              <MonitorOff className="h-20 w-20 text-yellow-400 animate-pulse" aria-hidden="true" />
            </div>
            <h1 className="text-5xl md:text-7xl font-bold text-[color:var(--mood-text)] mb-6">Display Disabled</h1>
            <p className="text-2xl text-[color:var(--mood-muted)] mb-4">
              The DJ has temporarily disabled the display screen
            </p>
            <p className="text-lg text-[color:var(--mood-muted)]">Check back in a few minutes!</p>
          </div>
        </div>
      </MoodShell>
    );
  }

  // Party is active and display is enabled - show display content (continue to main UI)
  // moodConfirmed means server mood or DEFAULT_DISPLAY_MOOD fallback after failure/timeout
  if (!eventSettings) {
    return <PageLoader label="Loading display..." />;
  }

  const showScrollingBar = eventSettings.show_scrolling_bar !== false;
  const showQr = eventSettings.show_qr_code && qrCodeUrl;
  const moodProps = {
    mood: eventSettings.display_mood,
    legacyPrimaryColor: eventSettings.theme_primary_color,
  };

  // `1fr` alone is minmax(auto, 1fr) — content min-size can blow past the viewport and
  // paint over the scrolling bar. Force tracks to shrink so panels scroll/clip instead.
  const mainGridRows = isVerticalExpanded
    ? 'minmax(0, 4fr) minmax(0, 2fr)'
    : 'minmax(0, 3fr) minmax(0, 3fr)';
  const mainGridColumns = isMessageVisible
    ? 'minmax(0, 0.5fr) minmax(0, 0.5fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0.5fr) minmax(0, 0.5fr)'
    : 'minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 1fr) minmax(0, 0fr) minmax(0, 0fr)';

  // TV Layout (Large screens)
  if (deviceType === 'tv') {
    return (
      <MoodShell {...moodProps}>
        <div className="h-screen p-6 overflow-hidden" style={gradientStyle}>
          <div className="w-full h-full flex flex-col gap-4">
            {/* Header - Fixed Height */}
            <div className="text-center py-4 flex-shrink-0">
              <h1 className="text-5xl font-bold mb-2">{eventSettings.event_title}</h1>
              {eventSettings.dj_name && (
                <p className="text-xl mood-accent-text">DJ {eventSettings.dj_name}</p>
              )}
              {eventSettings.venue_info && (
                <p className="text-lg text-[color:var(--mood-muted)] mt-1">{eventSettings.venue_info}</p>
              )}
            </div>

            {/* Main Content Area - Dynamic Height (reserved space above scrolling bar) */}
            <div
              className="flex-1 min-h-0 overflow-hidden"
              style={{
                display: 'grid',
                gridTemplateColumns: mainGridColumns,
                gridTemplateRows: mainGridRows,
                gap: '1.5rem',
                marginRight: isMessageVisible ? '0' : '-3rem',
                transition:
                  'grid-template-columns 1s ease-in-out, grid-template-rows 1s ease-in-out, margin-right 1s ease-in-out',
              }}
            >
              <NowPlayingPanel
                variant="tv"
                currentTrack={currentTrack}
                useHorizontalLayout={finalUseHorizontalLayout}
                nowPlayingRef={nowPlayingRef}
                style={{
                  gridColumn: '1 / span 2',
                  gridRow: '1',
                }}
              />

              {showQr && (
                <QrPanel
                  variant="tv"
                  qrCodeUrl={qrCodeUrl}
                  username={username}
                  pin={
                    guestAccessCode ||
                    accessCode ||
                    (eventSettings as { access_code?: string } | null)?.access_code ||
                    null
                  }
                  accessCode={
                    guestAccessCode ||
                    accessCode ||
                    (eventSettings as { access_code?: string } | null)?.access_code ||
                    null
                  }
                  useHorizontalLayout={finalUseHorizontalLayout}
                  style={{
                    gridColumn: '1 / span 2',
                    gridRow: '2',
                  }}
                />
              )}

              <QueuePanel
                variant="tv"
                upcomingSongs={upcomingSongs}
                animatingCards={animatingCards}
                sanitizeName={sanitizeName}
                style={{
                  gridColumn: '3 / span 2',
                  gridRow: '1 / span 2',
                }}
              />

              <MessageOverlay
                variant="tv"
                currentMessage={currentMessage}
                isMessageVisible={isMessageVisible}
                showMessageText={showMessageText}
                style={{
                  gridColumn: '5 / span 2',
                  gridRow: '1 / span 2',
                }}
              />
            </div>

            <ScrollingBar
              variant="tv"
              displayContent={displayContent}
              dynamicDuration={dynamicDuration}
              messageTextColor={messageTextColor}
              visible={showScrollingBar}
            />
          </div>
          <StatusDots
            isConnected={isConnected}
            connectionState={connectionState}
            spotifyConnected={spotifyConnected}
          />
        </div>
      </MoodShell>
    );
  }

  // Tablet Layout
  if (deviceType === 'tablet') {
    const isLandscape = window.innerWidth > window.innerHeight;

    if (isLandscape) {
      // Tablet Landscape - Full desktop layout with smaller text
      return (
        <MoodShell {...moodProps}>
          <div className="h-screen p-3 overflow-hidden" style={gradientStyle}>
            <div className="w-full h-full flex flex-col gap-3">
              {/* Header - Fixed Height */}
              <div className="text-center py-2 flex-shrink-0">
                <h1 className="text-3xl font-bold mb-1">{eventSettings.event_title}</h1>
                {eventSettings.dj_name && (
                  <p className="text-base mood-accent-text">DJ {eventSettings.dj_name}</p>
                )}
                {eventSettings.venue_info && (
                  <p className="text-sm text-[color:var(--mood-muted)]">{eventSettings.venue_info}</p>
                )}
              </div>

              {/* Main Content Area - Dynamic Height (reserved space above scrolling bar) */}
              <div
                className="flex-1 min-h-0 overflow-hidden"
                style={{
                  display: 'grid',
                  gridTemplateColumns: mainGridColumns,
                  gridTemplateRows: mainGridRows,
                  gap: '1rem',
                  marginRight: isMessageVisible ? '0' : '-2rem',
                  transition:
                    'grid-template-columns 1s ease-in-out, grid-template-rows 1s ease-in-out, margin-right 1s ease-in-out',
                }}
              >
                <NowPlayingPanel
                  variant="tablet-landscape"
                  currentTrack={currentTrack}
                  style={{
                    gridColumn: '1 / span 2',
                    gridRow: '1',
                  }}
                />

                {showQr && (
                  <QrPanel
                    variant="tablet-landscape"
                    qrCodeUrl={qrCodeUrl}
                    username={username}
                    style={{
                      gridColumn: '1 / span 2',
                      gridRow: '2',
                    }}
                  />
                )}

                <QueuePanel
                  variant="tablet-landscape"
                  upcomingSongs={upcomingSongs}
                  animatingCards={animatingCards}
                  sanitizeName={sanitizeName}
                  style={{
                    gridColumn: '3 / span 2',
                    gridRow: '1 / span 2',
                  }}
                />

                <MessageOverlay
                  variant="tablet"
                  currentMessage={currentMessage}
                  isMessageVisible={isMessageVisible}
                  showMessageText={showMessageText}
                  style={{
                    gridColumn: '5 / span 2',
                    gridRow: '1 / span 2',
                  }}
                />
              </div>

              <ScrollingBar
                variant="tablet-landscape"
                displayContent={displayContent}
                dynamicDuration={dynamicDuration}
                messageTextColor={messageTextColor}
                visible={showScrollingBar}
              />
            </div>
            <StatusDots
              isConnected={isConnected}
              connectionState={connectionState}
              spotifyConnected={spotifyConnected}
            />
          </div>
        </MoodShell>
      );
    }

    // Tablet Portrait - Simplified layout
    return (
      <MoodShell {...moodProps}>
        <div className="h-screen p-4 overflow-hidden" style={gradientStyle}>
          <div className="max-w-2xl mx-auto h-full flex flex-col gap-4 min-h-0">
            <div className="text-center py-3 flex-shrink-0">
              <h1 className="text-2xl font-bold mb-1">{eventSettings.event_title}</h1>
              {eventSettings.dj_name && (
                <p className="text-sm mood-accent-text">DJ {eventSettings.dj_name}</p>
              )}
            </div>

            <NowPlayingPanel variant="tablet-portrait" currentTrack={currentTrack} />

            <QueuePanel
              variant="tablet-portrait"
              upcomingSongs={upcomingSongs}
              animatingCards={animatingCards}
              sanitizeName={sanitizeName}
            />

            <ScrollingBar
              variant="tablet-portrait"
              displayContent={displayContent}
              dynamicDuration={dynamicDuration}
              messageTextColor={messageTextColor}
              visible={showScrollingBar}
            />
            <StatusDots
              isConnected={isConnected}
              connectionState={connectionState}
              spotifyConnected={spotifyConnected}
            />
          </div>
        </div>
      </MoodShell>
    );
  }

  // Mobile Layout
  const isLandscape = window.innerWidth > window.innerHeight;

  if (isLandscape) {
    // Mobile Landscape - Full desktop layout with very small text
    return (
      <MoodShell {...moodProps}>
        <div className="h-screen p-2 overflow-hidden" style={gradientStyle}>
          <div className="max-w-5xl mx-auto h-full flex flex-col gap-2">
            {/* Header - Fixed Height */}
            <div className="text-center py-1 flex-shrink-0">
              <h1 className="text-lg font-bold mb-1">{eventSettings.event_title}</h1>
              {eventSettings.dj_name && (
                <p className="text-xs mood-accent-text">DJ {eventSettings.dj_name}</p>
              )}
              {eventSettings.venue_info && (
                <p className="text-xs text-[color:var(--mood-muted)]">{eventSettings.venue_info}</p>
              )}
            </div>

            {/* Main Content Area - Dynamic Height (reserved space above scrolling bar) */}
            <div
              className="flex-1 min-h-0 overflow-hidden"
              style={{
                display: 'grid',
                gridTemplateColumns: mainGridColumns,
                gridTemplateRows: mainGridRows,
                gap: '0.5rem',
                marginRight: isMessageVisible ? '0' : '-1rem',
                transition:
                  'grid-template-columns 1s ease-in-out, grid-template-rows 1s ease-in-out, margin-right 1s ease-in-out',
              }}
            >
              <NowPlayingPanel
                variant="mobile-landscape"
                currentTrack={currentTrack}
                style={{
                  gridColumn: '1 / span 2',
                  gridRow: '1',
                }}
              />

              {showQr && (
                <QrPanel
                  variant="mobile-landscape"
                  qrCodeUrl={qrCodeUrl}
                  username={username}
                  style={{
                    gridColumn: '1 / span 2',
                    gridRow: '2',
                  }}
                />
              )}

              <QueuePanel
                variant="mobile-landscape"
                upcomingSongs={upcomingSongs}
                animatingCards={animatingCards}
                sanitizeName={sanitizeName}
                style={{
                  gridColumn: '3 / span 2',
                  gridRow: '1 / span 2',
                }}
              />

              <MessageOverlay
                variant="mobile"
                currentMessage={currentMessage}
                isMessageVisible={isMessageVisible}
                showMessageText={showMessageText}
                style={{
                  gridColumn: '5 / span 2',
                  gridRow: '1 / span 2',
                }}
              />
            </div>

            <ScrollingBar
              variant="mobile-landscape"
              displayContent={displayContent}
              dynamicDuration={dynamicDuration}
              messageTextColor={messageTextColor}
              visible={showScrollingBar}
            />
          </div>
          <StatusDots
            isConnected={isConnected}
            connectionState={connectionState}
            spotifyConnected={spotifyConnected}
          />
        </div>
      </MoodShell>
    );
  }

  // Mobile Portrait - Simplified layout
  return (
      <MoodShell {...moodProps}>
      <div className="h-screen p-3 overflow-hidden" style={gradientStyle}>
        <div className="max-w-sm mx-auto h-full flex flex-col gap-3 min-h-0">
          <div className="text-center flex-shrink-0">
            <h1 className="text-xl font-bold mb-1">{eventSettings.event_title}</h1>
            {eventSettings.dj_name && (
              <p className="text-xs mood-accent-text">DJ {eventSettings.dj_name}</p>
            )}
          </div>

          <NowPlayingPanel variant="mobile-portrait" currentTrack={currentTrack} />

          <QueuePanel
            variant="mobile-portrait"
            upcomingSongs={upcomingSongs}
            animatingCards={animatingCards}
            sanitizeName={sanitizeName}
          />

          <ScrollingBar
            variant="mobile-portrait"
            displayContent={displayContent}
            dynamicDuration={dynamicDuration}
            messageTextColor={messageTextColor}
            visible={showScrollingBar}
          />
        </div>
        <StatusDots
          isConnected={isConnected}
          connectionState={connectionState}
          spotifyConnected={spotifyConnected}
        />
      </div>
    </MoodShell>
  );
}
