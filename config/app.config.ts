// Application Configuration
// This file contains all configurable settings for the application

export const appConfig = {
  // Vercel Sandbox Configuration
  vercelSandbox: {
    // Sandbox timeout in minutes
    timeoutMinutes: 15,

    // Convert to milliseconds for Vercel Sandbox API
    get timeoutMs() {
      return this.timeoutMinutes * 60 * 1000;
    },

    // Development server port (Vercel Sandbox typically uses 3000 for Next.js/React)
    devPort: 3000,

    // Time to wait for dev server to be ready (in milliseconds)
    devServerStartupDelay: 7000,

    // Time to wait for CSS rebuild (in milliseconds)
    cssRebuildDelay: 2000,

    // Working directory in sandbox
    workingDirectory: '/app',

    // Default runtime for sandbox
    runtime: 'node22' // Available: node22, python3.13, v0-next-shadcn, cua-ubuntu-xfce
  },

  // E2B Sandbox Configuration
  e2b: {
    // Sandbox timeout in minutes
    timeoutMinutes: 30,

    // Convert to milliseconds for E2B API
    get timeoutMs() {
      return this.timeoutMinutes * 60 * 1000;
    },

    // Development server port (E2B uses 5173 for Vite)
    vitePort: 5173,

    // Time to wait for Vite dev server to be ready (in milliseconds)
    viteStartupDelay: 10000,

    // Working directory in sandbox
    workingDirectory: '/home/user/app',
  },
  
  // AI Model Configuration
  ai: {
    // Default AI model
    defaultModel: 'qwen/qwen3.6-27b',
    
    // Available models (default to free models - max 3 shown in builder)
    availableModels: [
      // Groq Models (Free)
      'groq/compound',
      'groq/compound-mini',
      'openai/gpt-oss-120b',
      
      // OpenRouter Free Models (shown by default)
      'openrouter/nvidia/nemotron-3.5-lightning:free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      'openrouter/poolside/laguna-s-2.1:free',
      'openrouter/google/gemma-4-26b-a4b-it',
    ],
    
    // Default models to show in builder (max 3)
    defaultBuilderModels: [
      'groq/compound',
      'openrouter/nvidia/nemotron-3.5-lightning:free',
      'openrouter/google/gemma-4-26b-a4b-it',
    ],
    
    // Model display names (clean, no provider prefixes)
    modelDisplayNames: {
      // Groq Models
      'groq/compound': 'Compound Latest',
      'groq/compound-mini': 'Compound Mini',
      'openai/gpt-oss-120b': 'GPT OSS 120B',
      'qwen/qwen3.6-27b': 'Qwen 3.6 27B',
      
      // OpenRouter - OpenAI Models
      'openrouter/openai/gpt-5.6-luna-pro': 'GPT-5.6 Luna Pro',
      'openrouter/openai/gpt-5.6-luna': 'GPT-5.6 Luna',
      'openrouter/openai/gpt-5.6-terra': 'GPT-5.6 Terra',
      'openrouter/openai/gpt-5.6-sol': 'GPT-5.6 Sol',
      'openrouter/openai/gpt-5.5': 'GPT-5.5',
      'openrouter/openai/gpt-5.4': 'GPT-5.4',
      'openrouter/openai/gpt-5.3-codex': 'GPT-5.3 Codex',
      
      // OpenRouter - Anthropic Models
      'openrouter/anthropic/claude-opus-5': 'Claude Opus 5',
      'openrouter/anthropic/claude-sonnet-5': 'Claude Sonnet 5',
      'openrouter/anthropic/claude-fable-5': 'Claude Fable 5',
      'openrouter/anthropic/claude-opus-4.8': 'Claude Opus 4.8',
      'openrouter/anthropic/claude-opus-4.7': 'Claude Opus 4.7',
      'openrouter/anthropic/claude-opus-4.6': 'Claude Opus 4.6',
      'openrouter/anthropic/claude-sonnet-4.6': 'Claude Sonnet 4.6',
      'openrouter/anthropic/claude-haiku-4.5': 'Claude Haiku 4.5',
      
      // OpenRouter - Google Models
      'openrouter/google/gemini-3.7-flash': 'Gemini 3.7 Flash',
      'openrouter/google/gemini-3.6-flash': 'Gemini 3.6 Flash',
      'openrouter/google/gemini-3.1-pro-preview': 'Gemini 3.1 Pro Preview',
      'openrouter/google/gemini-3.1-flash-lite': 'Gemini 3.1 Flash Lite',
      'openrouter/google/gemini-3-flash-preview': 'Gemini 3 Flash Preview',
      'openrouter/google/gemini-2.5-flash-lite': 'Gemini 2.5 Flash Lite',
      'openrouter/google/gemma-4-26b-a4b-it': 'Gemma 4 26B',
      
      // OpenRouter - DeepSeek Models
      'openrouter/deepseek/deepseek-v4-pro-0813': 'DeepSeek V4 Pro',
      'openrouter/deepseek/deepseek-v4-pro': 'DeepSeek V4 Pro',
      'openrouter/deepseek/deepseek-v4-flash-0731': 'DeepSeek V4 Flash',
      'openrouter/deepseek/deepseek-v4-flash': 'DeepSeek V4 Flash',
      
      // OpenRouter - X.AI Models
      'openrouter/x-ai/grok-4.6': 'Grok 4.6',
      'openrouter/x-ai/grok-4.5': 'Grok 4.5',
      
      // OpenRouter - Qwen Models
      'openrouter/qwen/qwen3.8-27b': 'Qwen 3.8 27B',
      'openrouter/qwen/qwen3.6-35b-a3b': 'Qwen 3.6 35B',
      
      // OpenRouter - Zhipu AI Models
      'openrouter/z-ai/glm-5.3': 'GLM 5.3',
      'openrouter/z-ai/glm-5.2': 'GLM 5.2',
      'openrouter/z-ai/glm-5v-turbo': 'GLM 5V Turbo',
      
      // OpenRouter - Moonshot AI Models
      'openrouter/moonshotai/kimi-k2.7-code': 'Kimi K2.7 Code',
      'openrouter/moonshotai/kimi-k2.6': 'Kimi K2.6',
      
      // OpenRouter - Other Models
      'openrouter/upstage/solar-pro4': 'Solar Pro 4',
      'openrouter/meta/muse-spark-1.2': 'Muse Spark 1.2',
      'openrouter/tencent/hy3': 'Hunyuan 3',
      'openrouter/minimax/minimax-m3': 'MiniMax M3',
      'openrouter/stepfun/step-3.7-flash': 'Step 3.7 Flash',
      'openrouter/xiaomi/mimo-v2.5-pro': 'Mimo V2.5 Pro',
      'openrouter/xiaomi/mimo-v2.5': 'Mimo V2.5',
      
      // OpenRouter - NVIDIA Models
      'openrouter/nvidia/nemotron-3.5-lightning:free': 'Nemotron 3.5 Lightning',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free': 'Nemotron 3 Ultra 550B',
      
      // OpenRouter - Other Free Models
      'openrouter/poolside/laguna-s-2.1:free': 'Laguna S 2.1',
      'openrouter/stealth/ox-alpha': 'OX Alpha',
    } as Record<string, string>,
    
    // Model API configuration
    modelApiConfig: {
      // Groq Models
      'groq/compound': {
        provider: 'groq',
        model: 'groq/compound'
      },
      'groq/compound-mini': {
        provider: 'groq',
        model: 'groq/compound-mini'
      },
      'openai/gpt-oss-120b': {
        provider: 'groq',
        model: 'openai/gpt-oss-120b'
      },
      'qwen/qwen3.6-27b': {
        provider: 'groq',
        model: 'qwen/qwen3.6-27b'
      },
      
      // OpenRouter Models - All models with openrouter/ prefix use OpenRouter
      'openrouter/nvidia/nemotron-3.5-lightning:free': {
        provider: 'openrouter',
        model: 'nvidia/nemotron-3.5-lightning:free'
      },
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free': {
        provider: 'openrouter',
        model: 'nvidia/nemotron-3-ultra-550b-a55b:free'
      },
      'openrouter/google/gemma-4-26b-a4b-it': {
        provider: 'openrouter',
        model: 'google/gemma-4-27b-it'
      },
      'openrouter/poolside/laguna-s-2.1:free': {
        provider: 'openrouter',
        model: 'poolside/laguna-s-2.1:free'
      },
      
      // Add remaining OpenRouter models as needed
      // Note: Any model starting with 'openrouter/' will automatically use OpenRouter provider
    } as Record<string, { provider: string; model: string }>,
    
    // Temperature settings for non-reasoning models
    defaultTemperature: 0.7,
    
    // Max tokens for code generation
    maxTokens: 8000,
    
    // Max tokens for truncation recovery
    truncationRecoveryMaxTokens: 4000,
  },
  
  // Code Application Configuration
  codeApplication: {
    // Delay after applying code before refreshing iframe (milliseconds)
    defaultRefreshDelay: 2000,
    
    // Delay when packages are installed (milliseconds)
    packageInstallRefreshDelay: 5000,
    
    // Enable/disable automatic truncation recovery
    enableTruncationRecovery: false, // Disabled - too many false positives
    
    // Maximum number of truncation recovery attempts per file
    maxTruncationRecoveryAttempts: 1,
  },
  
  // UI Configuration
  ui: {
    // Show/hide certain UI elements
    showModelSelector: true,
    showStatusIndicator: true,
    
    // Animation durations (milliseconds)
    animationDuration: 200,
    
    // Show opinionated commentary after scraping (one line per clone)
    enablePersonalityCommentary: true,

    // Toast notification duration (milliseconds)
    toastDuration: 3000,
    
    // Maximum chat messages to keep in memory
    maxChatMessages: 100,
    
    // Maximum recent messages to send as context
    maxRecentMessagesContext: 20,
  },
  
  // Development Configuration
  dev: {
    // Enable debug logging
    enableDebugLogging: true,
    
    // Enable performance monitoring
    enablePerformanceMonitoring: false,
    
    // Log API responses
    logApiResponses: true,
  },
  
  // Package Installation Configuration
  packages: {
    // Use --legacy-peer-deps flag for npm install
    useLegacyPeerDeps: true,
    
    // Package installation timeout (milliseconds)
    installTimeout: 60000,
    
    // Auto-restart Vite after package installation
    autoRestartVite: true,
  },
  
  // File Management Configuration
  files: {
    // Excluded file patterns (files to ignore)
    excludePatterns: [
      'node_modules/**',
      '.git/**',
      '.next/**',
      'dist/**',
      'build/**',
      '*.log',
      '.DS_Store'
    ],
    
    // Maximum file size to read (bytes)
    maxFileSize: 1024 * 1024, // 1MB
    
    // File extensions to treat as text
    textFileExtensions: [
      '.js', '.jsx', '.ts', '.tsx',
      '.css', '.scss', '.sass',
      '.html', '.xml', '.svg',
      '.json', '.yml', '.yaml',
      '.md', '.txt', '.env',
      '.gitignore', '.dockerignore'
    ],
  },
  
  // API Endpoints Configuration (for external services)
  api: {
    // Retry configuration
    maxRetries: 3,
    retryDelay: 1000, // milliseconds
    
    // Request timeout (milliseconds)
    requestTimeout: 30000,
  }
};

// Type-safe config getter
export function getConfig<K extends keyof typeof appConfig>(key: K): typeof appConfig[K] {
  return appConfig[key];
}

// Helper to get nested config values
export function getConfigValue(path: string): any {
  return path.split('.').reduce((obj, key) => obj?.[key], appConfig as any);
}

export default appConfig;