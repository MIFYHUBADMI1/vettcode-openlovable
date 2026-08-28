'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';

interface ModelCard {
  id: string;
  name: string;
  provider: 'groq' | 'openrouter';
  description: string;
  features: string[];
  contextWindow: string;
  strengths: string[];
}

export default function ModelsPage() {
  const [selectedProvider, setSelectedProvider] = useState<'all' | 'groq' | 'openrouter'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedModels, setSelectedModels] = useState<string[]>([]);
  const [showSuccess, setShowSuccess] = useState(false);

  // Load selected models from localStorage after hydration.
  // This must run in an effect, not during render — otherwise the server
  // renders "0" while the client renders the saved count, causing a
  // hydration mismatch.
  useEffect(() => {
    const saved = localStorage.getItem('selectedModels');
    if (saved) {
      setSelectedModels(JSON.parse(saved));
    } else {
      // Default to free models
      const defaults = [
        'groq/compound',
        'openrouter/free',
        'openrouter/google/gemma-4-26b-a4b-it',
      ];
      setSelectedModels(defaults);
      localStorage.setItem('selectedModels', JSON.stringify(defaults));
    }
  }, []);

  const toggleModelSelection = (modelId: string) => {
    let newSelection: string[];
    
    if (selectedModels.includes(modelId)) {
      // Remove model
      newSelection = selectedModels.filter(id => id !== modelId);
    } else {
      // Add model (max 3)
      if (selectedModels.length >= 3) {
        alert('Maximum 3 models allowed. Remove one first.');
        return;
      }
      newSelection = [...selectedModels, modelId];
    }
    
    setSelectedModels(newSelection);
    localStorage.setItem('selectedModels', JSON.stringify(newSelection));
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  };

  const isSelected = (modelId: string) => selectedModels.includes(modelId);

  // Model cards data
  const modelCards: ModelCard[] = [
    // ==================== GROQ MODELS ====================
    {
      id: 'groq/compound',
      name: 'ATAI Compound (Latest)',
      provider: 'groq',
      description: 'Latest compound model from ATAI with enhanced capabilities',
      features: ['Fast inference', 'High quality', 'General purpose'],
      contextWindow: '32K tokens',
      strengths: ['Speed', 'Quality', 'Versatility']
    },
    {
      id: 'groq/compound-mini',
      name: 'ATAI Compound Mini',
      provider: 'groq',
      description: 'Lightweight version optimized for speed',
      features: ['Ultra-fast', 'Efficient', 'Cost-effective'],
      contextWindow: '16K tokens',
      strengths: ['Speed', 'Efficiency']
    },
    {
      id: 'openai/gpt-oss-120b',
      name: 'ATAI GPT OSS (Light)',
      provider: 'groq',
      description: 'Open source GPT model with 120B parameters',
      features: ['Open source', 'Large context', 'Balanced performance'],
      contextWindow: '128K tokens',
      strengths: ['Context length', 'Open source']
    },
    {
      id: 'qwen/qwen3.6-27b',
      name: 'Qwen 3.6 (Heavy Coding)',
      provider: 'groq',
      description: 'Specialized for coding tasks with 27B parameters',
      features: ['Code generation', 'Multiple languages', 'High accuracy'],
      contextWindow: '32K tokens',
      strengths: ['Coding', 'Technical tasks']
    },

    // ==================== OPENROUTER - OPENAI MODELS ====================
    {
      id: 'openrouter/openai/gpt-5.6-luna-pro',
      name: 'GPT-5.6 Luna Pro',
      provider: 'openrouter',
      description: 'Most advanced OpenAI model with enhanced reasoning',
      features: ['Advanced reasoning', 'Multi-modal', 'Long context'],
      contextWindow: '200K tokens',
      strengths: ['Reasoning', 'Complex tasks', 'Accuracy']
    },
    {
      id: 'openrouter/openai/gpt-5.6-luna',
      name: 'GPT-5.6 Luna',
      provider: 'openrouter',
      description: 'Balanced version of GPT-5.6 series',
      features: ['Fast', 'Cost-effective', 'High quality'],
      contextWindow: '128K tokens',
      strengths: ['Balance', 'Speed', 'Quality']
    },
    {
      id: 'openrouter/openai/gpt-5.6-terra',
      name: 'GPT-5.6 Terra',
      provider: 'openrouter',
      description: 'Optimized for technical and coding tasks',
      features: ['Code generation', 'Technical docs', 'Debugging'],
      contextWindow: '128K tokens',
      strengths: ['Coding', 'Technical', 'Accuracy']
    },
    {
      id: 'openrouter/openai/gpt-5.6-sol',
      name: 'GPT-5.6 Sol',
      provider: 'openrouter',
      description: 'Creative and content generation specialist',
      features: ['Creative writing', 'Content', 'Storytelling'],
      contextWindow: '128K tokens',
      strengths: ['Creativity', 'Content', 'Writing']
    },
    {
      id: 'openrouter/openai/gpt-5.5',
      name: 'GPT-5.5',
      provider: 'openrouter',
      description: 'Previous generation flagship model',
      features: ['Reliable', 'Well-tested', 'Stable'],
      contextWindow: '128K tokens',
      strengths: ['Reliability', 'Stability']
    },
    {
      id: 'openrouter/openai/gpt-5.4',
      name: 'GPT-5.4',
      provider: 'openrouter',
      description: 'Older but proven GPT-5 variant',
      features: ['Cost-effective', 'Reliable', 'Fast'],
      contextWindow: '64K tokens',
      strengths: ['Cost', 'Speed']
    },
    {
      id: 'openrouter/openai/gpt-5.3-codex',
      name: 'GPT-5.3 Codex',
      provider: 'openrouter',
      description: 'Specialized coding model from GPT-5.3 series',
      features: ['Code generation', 'Multiple languages', 'Refactoring'],
      contextWindow: '64K tokens',
      strengths: ['Coding', 'Development', 'Debugging']
    },

    // ==================== OPENROUTER - ANTHROPIC MODELS ====================
    {
      id: 'openrouter/anthropic/claude-opus-5',
      name: 'Claude Opus 5',
      provider: 'openrouter',
      description: 'Most powerful Claude model for complex tasks',
      features: ['Superior reasoning', 'Long context', 'High accuracy'],
      contextWindow: '200K tokens',
      strengths: ['Reasoning', 'Analysis', 'Quality']
    },
    {
      id: 'openrouter/anthropic/claude-sonnet-5',
      name: 'Claude Sonnet 5',
      provider: 'openrouter',
      description: 'Balanced Claude model for general use',
      features: ['Fast', 'Reliable', 'Cost-effective'],
      contextWindow: '200K tokens',
      strengths: ['Balance', 'Speed', 'Value']
    },
    {
      id: 'openrouter/anthropic/claude-fable-5',
      name: 'Claude Fable 5',
      provider: 'openrouter',
      description: 'Creative and narrative-focused Claude variant',
      features: ['Creative writing', 'Storytelling', 'Content'],
      contextWindow: '200K tokens',
      strengths: ['Creativity', 'Writing', 'Content']
    },
    {
      id: 'openrouter/anthropic/claude-opus-4.8',
      name: 'Claude Opus 4.8',
      provider: 'openrouter',
      description: 'Previous generation Opus model',
      features: ['Reliable', 'High quality', 'Well-tested'],
      contextWindow: '200K tokens',
      strengths: ['Reliability', 'Quality']
    },
    {
      id: 'openrouter/anthropic/claude-opus-4.7',
      name: 'Claude Opus 4.7',
      provider: 'openrouter',
      description: 'Older Opus variant with proven track record',
      features: ['Stable', 'Cost-effective', 'Reliable'],
      contextWindow: '100K tokens',
      strengths: ['Stability', 'Cost']
    },
    {
      id: 'openrouter/anthropic/claude-opus-4.6',
      name: 'Claude Opus 4.6',
      provider: 'openrouter',
      description: 'Earlier Opus version for budget-conscious users',
      features: ['Affordable', 'Fast', 'Good quality'],
      contextWindow: '100K tokens',
      strengths: ['Cost', 'Speed']
    },
    {
      id: 'openrouter/anthropic/claude-sonnet-4.6',
      name: 'Claude Sonnet 4.6',
      provider: 'openrouter',
      description: 'Balanced older Sonnet model',
      features: ['Good value', 'Fast', 'Reliable'],
      contextWindow: '100K tokens',
      strengths: ['Value', 'Speed']
    },
    {
      id: 'openrouter/anthropic/claude-haiku-4.5',
      name: 'Claude Haiku 4.5',
      provider: 'openrouter',
      description: 'Fastest Claude model for quick tasks',
      features: ['Ultra-fast', 'Low cost', 'Efficient'],
      contextWindow: '100K tokens',
      strengths: ['Speed', 'Cost', 'Efficiency']
    },

    // ==================== OPENROUTER - GOOGLE MODELS ====================
    {
      id: 'openrouter/google/gemini-3.7-flash',
      name: 'Gemini 3.7 Flash',
      provider: 'openrouter',
      description: 'Latest ultra-fast Gemini model',
      features: ['Ultra-fast', 'Multi-modal', 'Efficient'],
      contextWindow: '1M tokens',
      strengths: ['Speed', 'Context', 'Multi-modal']
    },
    {
      id: 'openrouter/google/gemini-3.6-flash',
      name: 'Gemini 3.6 Flash',
      provider: 'openrouter',
      description: 'High-speed Gemini with large context',
      features: ['Fast', 'Long context', 'Versatile'],
      contextWindow: '1M tokens',
      strengths: ['Speed', 'Context length']
    },
    {
      id: 'openrouter/google/gemini-3.1-pro-preview',
      name: 'Gemini 3.1 Pro Preview',
      provider: 'openrouter',
      description: 'Preview of advanced Gemini Pro capabilities',
      features: ['Advanced', 'Multi-modal', 'High quality'],
      contextWindow: '2M tokens',
      strengths: ['Quality', 'Context', 'Multi-modal']
    },
    {
      id: 'openrouter/google/gemini-3.1-flash-lite',
      name: 'Gemini 3.1 Flash Lite',
      provider: 'openrouter',
      description: 'Lightweight Gemini for cost-effective tasks',
      features: ['Low cost', 'Fast', 'Efficient'],
      contextWindow: '1M tokens',
      strengths: ['Cost', 'Speed', 'Efficiency']
    },
    {
      id: 'openrouter/google/gemini-3-flash-preview',
      name: 'Gemini 3 Flash Preview',
      provider: 'openrouter',
      description: 'Preview version of Gemini 3 Flash',
      features: ['Fast', 'Preview features', 'Multi-modal'],
      contextWindow: '1M tokens',
      strengths: ['Speed', 'New features']
    },
    {
      id: 'openrouter/google/gemini-2.5-flash-lite',
      name: 'Gemini 2.5 Flash Lite',
      provider: 'openrouter',
      description: 'Budget-friendly older Gemini version',
      features: ['Affordable', 'Reliable', 'Fast'],
      contextWindow: '1M tokens',
      strengths: ['Cost', 'Reliability']
    },
    {
      id: 'openrouter/google/gemma-4-26b-a4b-it',
      name: 'Gemma 4 26B Instruct',
      provider: 'openrouter',
      description: 'Open model from Google with 26B parameters',
      features: ['Open source', 'Instruction tuned', 'Good value'],
      contextWindow: '32K tokens',
      strengths: ['Open source', 'Cost']
    },

    // ==================== OPENROUTER - DEEPSEEK MODELS ====================
    {
      id: 'openrouter/deepseek/deepseek-v4-pro-0813',
      name: 'DeepSeek V4 Pro',
      provider: 'openrouter',
      description: 'Advanced DeepSeek model for coding',
      features: ['Code generation', 'Reasoning', 'Technical'],
      contextWindow: '64K tokens',
      strengths: ['Coding', 'Reasoning', 'Technical']
    },
    {
      id: 'openrouter/deepseek/deepseek-v4-pro',
      name: 'DeepSeek V4 Pro',
      provider: 'openrouter',
      description: 'Professional coding and reasoning model',
      features: ['Advanced coding', 'Debugging', 'Analysis'],
      contextWindow: '64K tokens',
      strengths: ['Coding', 'Analysis']
    },
    {
      id: 'openrouter/deepseek/deepseek-v4-flash-0731',
      name: 'DeepSeek V4 Flash (July)',
      provider: 'openrouter',
      description: 'Fast variant of DeepSeek V4',
      features: ['Fast', 'Code generation', 'Efficient'],
      contextWindow: '64K tokens',
      strengths: ['Speed', 'Coding']
    },
    {
      id: 'openrouter/deepseek/deepseek-v4-flash',
      name: 'DeepSeek V4 Flash',
      provider: 'openrouter',
      description: 'Quick coding model from DeepSeek',
      features: ['Ultra-fast', 'Coding', 'Cost-effective'],
      contextWindow: '64K tokens',
      strengths: ['Speed', 'Cost', 'Coding']
    },

    // ==================== OPENROUTER - X.AI MODELS ====================
    {
      id: 'openrouter/x-ai/grok-4.6',
      name: 'Grok 4.6',
      provider: 'openrouter',
      description: 'Latest Grok model from X.AI with enhanced capabilities',
      features: ['Real-time data', 'Reasoning', 'Conversational'],
      contextWindow: '128K tokens',
      strengths: ['Real-time', 'Reasoning', 'Current events']
    },
    {
      id: 'openrouter/x-ai/grok-4.5',
      name: 'Grok 4.5',
      provider: 'openrouter',
      description: 'Previous Grok version with proven performance',
      features: ['Reliable', 'Real-time', 'Conversational'],
      contextWindow: '128K tokens',
      strengths: ['Reliability', 'Real-time']
    },

    // ==================== OPENROUTER - QWEN MODELS ====================
    {
      id: 'openrouter/qwen/qwen3.8-27b',
      name: 'Qwen 3.8 27B',
      provider: 'openrouter',
      description: 'Advanced Qwen model for various tasks',
      features: ['Multilingual', 'Code generation', 'Reasoning'],
      contextWindow: '32K tokens',
      strengths: ['Multilingual', 'Coding', 'Versatile']
    },
    {
      id: 'openrouter/qwen/qwen3.6-35b-a3b',
      name: 'Qwen 3.6 35B',
      provider: 'openrouter',
      description: 'Larger Qwen model with enhanced capabilities',
      features: ['Large parameters', 'Multilingual', 'High quality'],
      contextWindow: '32K tokens',
      strengths: ['Quality', 'Multilingual']
    },

    // ==================== OPENROUTER - ZHIPU AI ====================
    {
      id: 'openrouter/z-ai/glm-5.3',
      name: 'GLM 5.3',
      provider: 'openrouter',
      description: 'Advanced GLM model from Zhipu AI',
      features: ['Multilingual', 'Reasoning', 'General purpose'],
      contextWindow: '128K tokens',
      strengths: ['Multilingual', 'Reasoning']
    },
    {
      id: 'openrouter/z-ai/glm-5.2',
      name: 'GLM 5.2',
      provider: 'openrouter',
      description: 'Previous GLM version with good performance',
      features: ['Reliable', 'Multilingual', 'Cost-effective'],
      contextWindow: '128K tokens',
      strengths: ['Reliability', 'Cost']
    },
    {
      id: 'openrouter/z-ai/glm-5v-turbo',
      name: 'GLM 5V Turbo',
      provider: 'openrouter',
      description: 'Vision-capable GLM model',
      features: ['Vision', 'Multi-modal', 'Fast'],
      contextWindow: '128K tokens',
      strengths: ['Vision', 'Multi-modal', 'Speed']
    },

    // ==================== OPENROUTER - MOONSHOT AI ====================
    {
      id: 'openrouter/moonshotai/kimi-k2.7-code',
      name: 'Kimi K2.7 Code',
      provider: 'openrouter',
      description: 'Code-specialized Kimi model',
      features: ['Code generation', 'Debugging', 'Technical'],
      contextWindow: '200K tokens',
      strengths: ['Coding', 'Long context']
    },
    {
      id: 'openrouter/moonshotai/kimi-k2.6',
      name: 'Kimi K2.6',
      provider: 'openrouter',
      description: 'General purpose Kimi model',
      features: ['Long context', 'Multilingual', 'General use'],
      contextWindow: '200K tokens',
      strengths: ['Context length', 'Versatility']
    },

    // ==================== OPENROUTER - OTHER PROVIDERS ====================
    {
      id: 'openrouter/upstage/solar-pro4',
      name: 'Solar Pro 4',
      provider: 'openrouter',
      description: 'Professional model from Upstage',
      features: ['Business tasks', 'Analysis', 'Writing'],
      contextWindow: '32K tokens',
      strengths: ['Business', 'Analysis']
    },
    {
      id: 'openrouter/meta/muse-spark-1.2',
      name: 'Muse Spark 1.2',
      provider: 'openrouter',
      description: 'Creative model from Meta',
      features: ['Creative', 'Content', 'Storytelling'],
      contextWindow: '32K tokens',
      strengths: ['Creativity', 'Content']
    },
    {
      id: 'openrouter/tencent/hy3',
      name: 'Hunyuan 3',
      provider: 'openrouter',
      description: 'Advanced model from Tencent',
      features: ['Multilingual', 'General purpose', 'Reliable'],
      contextWindow: '32K tokens',
      strengths: ['Multilingual', 'Reliability']
    },
    {
      id: 'openrouter/minimax/minimax-m3',
      name: 'MiniMax M3',
      provider: 'openrouter',
      description: 'Efficient model from MiniMax',
      features: ['Efficient', 'Cost-effective', 'Fast'],
      contextWindow: '32K tokens',
      strengths: ['Efficiency', 'Cost']
    },
    {
      id: 'openrouter/stepfun/step-3.7-flash',
      name: 'Step 3.7 Flash',
      provider: 'openrouter',
      description: 'Fast model from StepFun',
      features: ['Fast', 'Reliable', 'General use'],
      contextWindow: '32K tokens',
      strengths: ['Speed', 'Reliability']
    },
    {
      id: 'openrouter/xiaomi/mimo-v2.5-pro',
      name: 'Mimo V2.5 Pro',
      provider: 'openrouter',
      description: 'Professional model from Xiaomi',
      features: ['Advanced', 'Multilingual', 'High quality'],
      contextWindow: '32K tokens',
      strengths: ['Quality', 'Multilingual']
    },
    {
      id: 'openrouter/xiaomi/mimo-v2.5',
      name: 'Mimo V2.5',
      provider: 'openrouter',
      description: 'Standard Xiaomi model',
      features: ['Balanced', 'Cost-effective', 'Reliable'],
      contextWindow: '32K tokens',
      strengths: ['Balance', 'Cost']
    },

    // ==================== OPENROUTER - FREE MODELS ====================
    {
      id: 'openrouter/nvidia/nemotron-3.5-lightning:free',
      name: 'Nemotron 3.5 Lightning',
      provider: 'openrouter',
      description: 'Free ultra-fast model from NVIDIA',
      features: ['Ultra-fast', 'Free tier', 'Efficient'],
      contextWindow: '32K tokens',
      strengths: ['Speed', 'NVIDIA']
    },
    {
      id: 'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
      name: 'Nemotron 3 Ultra 550B',
      provider: 'openrouter',
      description: 'Massive free model from NVIDIA',
      features: ['Free tier', 'Large params', 'High quality'],
      contextWindow: '32K tokens',
      strengths: ['Quality', 'Size']
    },
    {
      id: 'openrouter/poolside/laguna-s-2.1:free',
      name: 'Laguna S 2.1',
      provider: 'openrouter',
      description: 'Free model from Poolside',
      features: ['Free tier', 'Fast', 'Reliable'],
      contextWindow: '32K tokens',
      strengths: ['Speed']
    },
    {
      id: 'openrouter/stealth/ox-alpha',
      name: 'OX Alpha',
      provider: 'openrouter',
      description: 'Experimental stealth model',
      features: ['Experimental', 'Advanced', 'Unique'],
      contextWindow: '32K tokens',
      strengths: ['Experimental', 'Novel']
    },
  ];

  const filteredModels = modelCards.filter(model => {
    const matchesProvider = selectedProvider === 'all' || model.provider === selectedProvider;
    const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         model.description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesProvider && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <Image 
                src="/logo.png" 
                alt="MirrorSite AI Logo" 
                width={40} 
                height={40}
                className="rounded-lg"
              />
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                MirrorSite AI
              </h1>
            </Link>
            
            <nav className="flex items-center gap-6">
              <Link href="/" className="text-gray-600 hover:text-gray-900 transition-colors">
                Home
              </Link>
              <Link href="/builder" className="text-gray-600 hover:text-gray-900 transition-colors">
                Builder
              </Link>
              <Link href="/about" className="text-gray-600 hover:text-gray-900 transition-colors">
                About
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-16 px-4">
        <div className="max-w-7xl mx-auto text-center">
          <h1 className="text-5xl md:text-6xl font-bold mb-6 bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
            Supported AI Models
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-4">
            Choose up to 3 models to appear in your builder. All models are optimized for web development, 
            code generation, and creative tasks.
          </p>
          
          {/* Selected Models Counter */}
          <div className="mb-8">
            <p className="text-lg font-semibold text-gray-700">
              Selected: <span className="text-blue-600">{selectedModels.length}/3</span> models
            </p>
          </div>

          {/* Success Message */}
          {showSuccess && (
            <div className="mb-4 p-3 bg-green-100 text-green-700 rounded-lg inline-block">
              ✓ Selection updated!
            </div>
          )}
          
          {/* Search and Filter */}
          <div className="flex flex-col md:flex-row gap-4 max-w-2xl mx-auto mb-12">
            <input
              type="text"
              placeholder="Search models..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 px-6 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            />
            
            <div className="flex gap-2">
              <button
                onClick={() => setSelectedProvider('all')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedProvider === 'all'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-600'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setSelectedProvider('groq')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedProvider === 'groq'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-600'
                }`}
              >
                Groq
              </button>
              <button
                onClick={() => setSelectedProvider('openrouter')}
                className={`px-6 py-3 rounded-lg font-medium transition-all ${
                  selectedProvider === 'openrouter'
                    ? 'bg-blue-600 text-white shadow-lg'
                    : 'bg-white text-gray-600 border border-gray-300 hover:border-blue-600'
                }`}
              >
                OpenRouter
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Models Grid */}
      <section className="pb-20 px-4">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredModels.map((model) => (
              <div
                key={model.id}
                className={`bg-white rounded-xl shadow-md hover:shadow-xl transition-all duration-300 overflow-hidden border-2 ${
                  isSelected(model.id) 
                    ? 'border-blue-500 ring-2 ring-blue-200' 
                    : 'border-gray-200 hover:border-blue-300'
                }`}
              >
                <div className="p-6">
                  {/* Selection Badge */}
                  {isSelected(model.id) && (
                    <div className="mb-3">
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                        ✓ Selected for Builder
                      </span>
                    </div>
                  )}

                  {/* Model Name */}
                  <h3 className="text-xl font-bold text-gray-900 mb-2">{model.name}</h3>
                  
                  {/* Description */}
                  <p className="text-gray-600 text-sm mb-4">{model.description}</p>

                  {/* Context Window */}
                  <div className="mb-4 pb-4 border-b border-gray-200">
                    <p className="text-sm text-gray-500">
                      <span className="font-semibold">Context:</span> {model.contextWindow}
                    </p>
                  </div>

                  {/* Features */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Features:</h4>
                    <div className="flex flex-wrap gap-2">
                      {model.features.map((feature, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded-md"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Strengths */}
                  <div>
                    <h4 className="text-sm font-semibold text-gray-700 mb-2">Best for:</h4>
                    <div className="flex flex-wrap gap-2">
                      {model.strengths.map((strength, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-1 bg-blue-50 text-blue-700 text-xs rounded-md font-medium"
                        >
                          ✓ {strength}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Add/Remove Button */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-200">
                  {isSelected(model.id) ? (
                    <button
                      onClick={() => toggleModelSelection(model.id)}
                      className="block w-full text-center px-4 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 transition-all"
                    >
                      Remove from Builder
                    </button>
                  ) : (
                    <button
                      onClick={() => toggleModelSelection(model.id)}
                      className="block w-full text-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white font-medium rounded-lg hover:from-blue-700 hover:to-purple-700 transition-all"
                      disabled={selectedModels.length >= 3}
                    >
                      {selectedModels.length >= 3 ? 'Max 3 Models' : 'Add to Builder'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {filteredModels.length === 0 && (
            <div className="text-center py-16">
              <p className="text-xl text-gray-500">No models found matching your criteria.</p>
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <p className="text-gray-600">
            © 2026 MirrorSite AI by ATAI Enterprises. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
