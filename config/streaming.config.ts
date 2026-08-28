/**
 * Streaming Configuration
 * 
 * Adjust these values to control the AI generation streaming behavior.
 * Lower values = more frequent updates = smoother streaming but more processing
 * Higher values = less frequent updates = choppier streaming but less processing
 */

export const streamingConfig = {
  /**
   * CHUNK_SIZE: Number of characters to accumulate before sending to client
   * 
   * Recommended values:
   * - 5-10: Very smooth, ChatGPT-like streaming (higher server load)
   * - 15-25: Balanced smooth streaming (recommended)
   * - 50-100: Faster but choppier streaming
   * 
   * Default: 15
   */
  CHUNK_SIZE: 25,
  
  /**
   * FLUSH_ON_BOUNDARIES: Send immediately on natural break points
   * 
   * When true, chunks are flushed immediately when encountering:
   * - Newlines (\n)
   * - Spaces (word boundaries)
   * - Semicolons, braces, brackets (code boundaries)
   * 
   * Default: true (recommended)
   */
  FLUSH_ON_BOUNDARIES: true,
  
  /**
   * CLIENT_BUFFER_SIZE: Number of characters to buffer on client before processing
   * 
   * Recommended values:
   * - 0: Process every chunk immediately (smoothest)
   * - 10-50: Small buffer for optimization
   * - 100+: Larger buffer for less frequent updates
   * 
   * Default: 0 (process immediately)
   */
  CLIENT_BUFFER_SIZE: 0,
  
  /**
   * ENABLE_LIVE_STATS: Show real-time streaming statistics
   * 
   * When true, displays a floating indicator with:
   * - Character count
   * - Characters per second
   * - Streaming status
   * 
   * Default: true
   */
  ENABLE_LIVE_STATS: true,
  
  /**
   * AUTO_SCROLL_BEHAVIOR: How to handle auto-scrolling during streaming
   * 
   * Options:
   * - 'smooth': Smooth animated scrolling
   * - 'instant': Instant jump to bottom
   * - 'auto': Browser decides (usually instant)
   * 
   * Default: 'smooth'
   */
  AUTO_SCROLL_BEHAVIOR: 'smooth' as ScrollBehavior,
  
  /**
   * SCROLL_THRESHOLD: Scroll to bottom if user is within this many pixels of bottom
   * 
   * Set to 0 to always scroll, higher values give user more control
   * 
   * Default: 100
   */
  SCROLL_THRESHOLD: 100,
  
  /**
   * SYNTAX_HIGHLIGHT_DEBOUNCE: Milliseconds to wait before re-highlighting syntax
   * 
   * Higher values reduce CPU usage but delay syntax highlighting
   * 
   * Default: 50
   */
  SYNTAX_HIGHLIGHT_DEBOUNCE: 50,
  
  /**
   * MAX_DISPLAY_CHARS: Maximum characters to display in the raw stream view
   * 
   * Prevents browser slowdown with very large streams
   * Shows only the last N characters
   * 
   * Default: 50000 (about 50KB)
   */
  MAX_DISPLAY_CHARS: 50000,
};

export type StreamingConfig = typeof streamingConfig;
