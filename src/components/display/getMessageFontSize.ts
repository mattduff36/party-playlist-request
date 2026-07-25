import type { DisplayDeviceType } from './types';

// Calculate dynamic font size based on message length and device type
// Ensures ALL text fits in container without resizing, minimum 0.1rem
// Maximizes use of available vertical and horizontal space
export function getMessageFontSize(
  messageText: string,
  deviceType: DisplayDeviceType
): string {
  const containerDimensions = {
    tv: { width: 400, height: 300 }, // Approximate container dimensions for TV layout
    tablet: { width: 300, height: 200 }, // Approximate container dimensions for tablet layout
    mobile: { width: 250, height: 150 }, // Approximate container dimensions for mobile layout
  };

  const maxSizes = {
    tv: 4.0, // Maximum font size in rem for TV (increased)
    tablet: 3.0, // Maximum font size in rem for tablet (increased)
    mobile: 2.0, // Maximum font size in rem for mobile (increased)
  };

  const { width: containerWidth, height: containerHeight } = containerDimensions[deviceType];
  const maxSize = maxSizes[deviceType];
  const minSize = 0.1; // Minimum font size in rem as requested

  // Account for padding and safety margin (30% margin on each side)
  const availableWidth = containerWidth * 0.7;
  const availableHeight = containerHeight * 0.7;

  // Average character width is roughly 0.7em (conservative), line height is 1.2em
  const avgCharWidth = 0.7;
  const lineHeightMultiplier = 1.2;

  // Find the longest word to ensure it can fit on a single line
  const words = messageText.split(/\s+/);
  const longestWordLength = Math.max(...words.map((w) => w.length));
  const messageLength = messageText.length;

  // Binary search for optimal font size that uses maximum space
  let minFontSize = minSize;
  let maxFontSize = maxSize;
  let optimalFontSize = minSize;

  for (let i = 0; i < 20; i++) {
    // 20 iterations for precision
    const testFontSize = (minFontSize + maxFontSize) / 2;
    const testFontSizePx = testFontSize * 16; // Convert rem to px

    // Calculate how many characters fit per line at this font size
    const charsPerLine = Math.floor(availableWidth / (testFontSizePx * avgCharWidth));

    // Check if the longest word can fit on a single line
    const longestWordWidth = longestWordLength * testFontSizePx * avgCharWidth;
    const wordFits = longestWordWidth <= availableWidth;

    // Calculate how many lines we need
    const requiredLines = Math.ceil(messageLength / charsPerLine);

    // Calculate total height needed
    const totalHeight = requiredLines * testFontSizePx * lineHeightMultiplier;

    // Check if it fits within available height AND the longest word fits on one line
    if (totalHeight <= availableHeight && charsPerLine > 0 && wordFits) {
      optimalFontSize = testFontSize;
      minFontSize = testFontSize; // Try larger
    } else {
      maxFontSize = testFontSize; // Too big, try smaller
    }
  }

  // Ensure we don't exceed bounds
  optimalFontSize = Math.max(minSize, Math.min(maxSize, optimalFontSize));

  return `${optimalFontSize}rem`;
}
