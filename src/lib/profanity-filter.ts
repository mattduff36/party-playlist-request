/**
 * Profanity Filter for Requester Names
 * 
 * This module provides two levels of content filtering:
 * 1. EXTREME: Blocks the request entirely (user cannot select songs)
 * 2. MODERATE: Censors with asterisks but allows the request
 */

// Extreme profanity - blocks request entirely
const EXTREME_WORDS = [
  'fuck', 'fucking', 'fucker', 'fucked', 'fucks',
  'cunt', 'cunts',
  'nigger', 'nigga',
  'faggot', 'fag',
  'retard', 'retarded',
  'whore', 'slut',
  'bitch', 'bastard',
  'prick', 'cock', 'dick', 'pussy', 'arse', 'ass',
  'wanker', 'bollocks', 'twat',
  'shit', 'shite', 'shitty',
  'piss', 'pissed'
];

// Moderate profanity - censored but allowed
const MODERATE_WORDS = [
  'damn', 'damned',
  'hell',
  'crap', 'crappy',
  'shag', 'shagger', 'shagging',
  'bloody',
  'bugger',
  'git',
  'sod',
  'arse',
  'tosser',
  'knob',
  'minger',
  'minge'
];

/**
 * Check if text contains extreme profanity
 * Returns true if the name should be blocked entirely
 */
export function containsExtremeProfanity(text: string): boolean {
  if (!text) return false;
  
  const lowerText = text.toLowerCase();
  
  // Check for exact matches and word boundaries
  return EXTREME_WORDS.some(word => {
    // Match whole word or word with common leetspeak substitutions
    const pattern = new RegExp(`\\b${word}\\b|\\b${word.replace(/o/g, '0').replace(/i/g, '1').replace(/e/g, '3')}\\b`, 'i');
    return pattern.test(lowerText);
  });
}

/**
 * Censor profanity in text by replacing with asterisks
 * Handles both moderate and extreme profanity
 * 
 * @param text - The text to censor
 * @param keepFirstLetter - If true, keeps first letter visible (e.g., "s***" instead of "****")
 * @returns Censored text
 */
export function censorProfanity(text: string, keepFirstLetter: boolean = true): string {
  if (!text) return text;
  
  let censoredText = text;
  const allWords = [...EXTREME_WORDS, ...MODERATE_WORDS];
  
  // Sort by length (longest first) to handle compound words
  allWords.sort((a, b) => b.length - a.length);
  
  allWords.forEach(word => {
    // Create regex for word boundaries and leetspeak variants
    const basePattern = word
      .replace(/o/g, '[o0]')
      .replace(/i/g, '[i1]')
      .replace(/e/g, '[e3]')
      .replace(/a/g, '[a4]')
      .replace(/s/g, '[s5]');
    
    const regex = new RegExp(`\\b(${basePattern})\\b`, 'gi');
    
    censoredText = censoredText.replace(regex, (match) => {
      if (keepFirstLetter && match.length > 0) {
        // Keep first letter, replace rest with asterisks
        return match[0] + '*'.repeat(match.length - 1);
      } else {
        // Replace entire word with asterisks
        return '*'.repeat(match.length);
      }
    });
  });
  
  return censoredText;
}

/**
 * Validate and optionally censor a requester name
 * 
 * @param name - The requester name to validate
 * @param enableFiltering - Whether profanity filtering is enabled (from settings)
 * @returns Object with validation status and censored name
 */
export function validateRequesterName(name: string, enableFiltering: boolean = true): {
  isValid: boolean;
  censoredName: string;
  reason?: string;
} {
  if (!name || name.trim().length === 0) {
    return {
      isValid: false,
      censoredName: '',
      reason: 'Name is required'
    };
  }
  
  // If filtering is disabled, allow everything
  if (!enableFiltering) {
    return {
      isValid: true,
      censoredName: name.trim()
    };
  }
  
  // Check for extreme profanity (blocks request)
  if (containsExtremeProfanity(name)) {
    return {
      isValid: false,
      censoredName: '',
      reason: 'Name contains inappropriate language'
    };
  }
  
  // Censor moderate profanity and allow
  const censoredName = censorProfanity(name.trim());
  
  return {
    isValid: true,
    censoredName
  };
}

/**
 * Sanitize requester name for display purposes
 * This is used when showing names on the display screen
 * 
 * @param name - The requester name
 * @param enableFiltering - Whether profanity filtering is enabled
 * @returns Sanitized name safe for display
 */
export function sanitizeRequesterNameForDisplay(name: string, enableFiltering: boolean = true): string {
  if (!name) return 'Anonymous';
  
  if (!enableFiltering) {
    return name;
  }
  
  // If contains extreme profanity, replace entire name
  if (containsExtremeProfanity(name)) {
    return '***';
  }
  
  // Otherwise censor moderate words
  return censorProfanity(name, true);
}

