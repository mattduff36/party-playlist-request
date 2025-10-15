/**
 * Global Theme Configuration
 * 
 * This file defines the color scheme used across the entire application.
 * All new pages should import and use these colors to maintain consistency.
 */

export const theme = {
  // Primary Colors
  colors: {
    // Background colors
    background: {
      primary: '#191414',    // Dark black/gray (Spotify-style)
      secondary: '#000000',  // Pure black
      card: 'rgba(0, 0, 0, 0.3)',  // Black with 30% opacity
      cardHover: 'rgba(0, 0, 0, 0.5)',  // Black with 50% opacity
    },
    
    // Brand colors
    brand: {
      primary: '#1DB954',    // Spotify green
      primaryHover: '#1ed760',  // Lighter green on hover
      primaryLight: 'rgba(29, 185, 84, 0.1)',  // Green with 10% opacity
    },
    
    // Text colors
    text: {
      primary: '#FFFFFF',    // White
      secondary: '#B3B3B3',  // Light gray
      tertiary: '#808080',   // Medium gray
      muted: '#535353',      // Dark gray
    },
    
    // Status colors
    status: {
      success: '#1DB954',    // Green
      error: '#E22134',      // Red
      warning: '#FFA500',    // Orange
      info: '#1DB954',       // Green
    },
    
    // Border colors
    border: {
      primary: 'rgba(29, 185, 84, 0.2)',  // Green with 20% opacity
      secondary: 'rgba(255, 255, 255, 0.1)',  // White with 10% opacity
      hover: '#1DB954',  // Full green on hover
    },
  },
  
  // Gradient backgrounds
  gradients: {
    primary: 'linear-gradient(to bottom right, #191414, #0a0a0a)',  // Dark gray to black
    card: 'linear-gradient(135deg, rgba(29, 185, 84, 0.05) 0%, rgba(0, 0, 0, 0.3) 100%)',  // Subtle green tint
    overlay: 'linear-gradient(to bottom, rgba(0, 0, 0, 0.7), rgba(0, 0, 0, 0.9))',  // Dark overlay
  },
  
  // Glass morphism / backdrop blur styles
  glass: {
    light: 'rgba(255, 255, 255, 0.05)',  // Light glass effect
    medium: 'rgba(255, 255, 255, 0.1)',  // Medium glass effect
    dark: 'rgba(0, 0, 0, 0.3)',  // Dark glass effect
  },
} as const;

// Tailwind-compatible class names for easy use in components
export const themeClasses = {
  // Backgrounds
  bgPrimary: 'bg-[#191414]',
  bgSecondary: 'bg-black',
  bgCard: 'bg-black/30',
  bgCardHover: 'bg-black/50',
  bgGlass: 'bg-white/10',
  
  // Brand colors
  brandPrimary: 'bg-[#1DB954]',
  brandHover: 'bg-[#1ed760]',
  brandText: 'text-[#1DB954]',
  brandTextHover: 'text-[#1ed760]',
  
  // Text colors
  textPrimary: 'text-white',
  textSecondary: 'text-gray-400',
  textTertiary: 'text-gray-500',
  textMuted: 'text-gray-600',
  
  // Borders
  borderPrimary: 'border-[#1DB954]/20',
  borderSecondary: 'border-white/10',
  borderHover: 'border-[#1DB954]',
  
  // Gradients (use with arbitrary values in Tailwind)
  gradientPrimary: 'bg-gradient-to-br from-[#191414] to-[#0a0a0a]',
} as const;

// Export individual color values for use in inline styles
export const colors = theme.colors;
export const gradients = theme.gradients;

