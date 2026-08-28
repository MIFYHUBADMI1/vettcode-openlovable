'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import Image from 'next/image';
import Link from 'next/link';
import { appConfig } from '@/config/app.config';
import { getCommentary } from '@/lib/commentary';
import HeroInput from '@/components/HeroInput';
import SidebarInput from '@/components/app/generation/SidebarInput';
import ProgressUI from '@/components/app/ProgressUI';
import type { PhaseState, PhaseExecutionLog, SectionStatus, PipelineInputs } from '@/lib/pipeline/types';
import HeaderBrandKit from '@/components/shared/header/BrandKit/BrandKit';
import { HeaderProvider } from '@/components/shared/header/HeaderContext';
import UserMenu from '@/components/auth/UserMenu';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
// Import icons from centralized module to avoid Turbopack chunk issues
import { 
  FiFile, 
  FiChevronRight, 
  FiChevronDown,
  FiGithub,
  BsFolderFill, 
  BsFolder2Open,
  SiJavascript, 
  SiReact, 
  SiCss3, 
  SiJson 
} from '@/lib/icons';
import { motion } from 'framer-motion';
import CodeApplicationProgress, { type CodeApplicationState } from '@/components/CodeApplicationProgress';
import LowBalanceModal from '@/components/tokens/LowBalanceModal';

interface SandboxData {
  sandboxId: string;
  url: string;
  [key: string]: any;
}

interface ChatMessage {
  content: string;
  type: 'user' | 'ai' | 'system' | 'file-update' | 'command' | 'error';
  timestamp: Date;
  metadata?: {
    scrapedUrl?: string;
    scrapedContent?: any;
    generatedCode?: string;
    appliedFiles?: string[];
    commandType?: 'input' | 'output' | 'error' | 'success';
    brandingData?: any;
    sourceUrl?: string;
  };
}

interface ScrapeData {
  success: boolean;
  content?: string;
  url?: string;
  title?: string;
  source?: string;
  screenshot?: string;
  structured?: any;
  metadata?: any;
  message?: string;
  error?: string;
}

function AISandboxPage() {
  const { data: session, status: authStatus } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // ALL HOOKS MUST BE DECLARED FIRST - BEFORE ANY CONDITIONAL RETURNS
  const [sandboxData, setSandboxData] = useState<SandboxData | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState({ text: 'Not connected', active: false });
  const [responseArea, setResponseArea] = useState<string[]>([]);
  const [structureContent, setStructureContent] = useState('No sandbox created yet');
  const [promptInput, setPromptInput] = useState('');
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    {
      content: 'Welcome! I can help you generate code with full context of your sandbox files and structure. Just start chatting - I\'ll automatically create a sandbox for you if needed!\n\nTip: If you see package errors like "react-router-dom not found", just type "npm install" or "check packages" to automatically install missing packages.',
      type: 'system',
      timestamp: new Date()
    }
  ]);
  const [aiChatInput, setAiChatInput] = useState('');
  const [aiEnabled] = useState(true);
  
  const [aiModel, setAiModel] = useState(appConfig.ai.defaultModel);

  const isUnavailableModel = (model: string) => {
    return [
      'openrouter/nvidia/nemotron-3.5-lightning:free',
      'openrouter/nvidia/nemotron-3-ultra-550b-a55b:free',
    ].includes(model);
  };

  // Resolve the initial model after hydration. This must run in an effect —
  // reading localStorage during render creates a server/client branch and a
  // hydration mismatch (server renders the default, client renders the saved one).
  useEffect(() => {
    const modelParam = searchParams.get('model');
    const saved = localStorage.getItem('selectedModels');
    const userModels = saved ? JSON.parse(saved) : (appConfig.ai.defaultBuilderModels || appConfig.ai.availableModels.slice(0, 3));
    const validModels = userModels.filter((model: string) => !isUnavailableModel(model));

    if (saved && validModels.length !== userModels.length) {
      localStorage.setItem('selectedModels', JSON.stringify(validModels));
    }

    if (modelParam && !isUnavailableModel(modelParam)) {
      setAiModel(modelParam);
    } else {
      setAiModel(validModels[0] || appConfig.ai.defaultModel);
    }
  }, [searchParams]);
  
  const [userModels, setUserModels] = useState<string[]>([]);
  const [urlOverlayVisible, setUrlOverlayVisible] = useState(false);
  const [urlInput, setUrlInput] = useState('');
  const [urlStatus, setUrlStatus] = useState<string[]>([]);
  const [showHomeScreen, setShowHomeScreen] = useState(true);
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set(['app', 'src', 'src/components']));
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [homeScreenFading, setHomeScreenFading] = useState(false);
  const [homeUrlInput, setHomeUrlInput] = useState('');
  const [homeContextInput, setHomeContextInput] = useState('');
  const [activeTab, setActiveTab] = useState<'generation' | 'preview'>('preview');
  const [showStyleSelector, setShowStyleSelector] = useState(false);
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null);
  const [showLoadingBackground, setShowLoadingBackground] = useState(false);
  const [urlScreenshot, setUrlScreenshot] = useState<string | null>(null);
  const [isScreenshotLoaded, setIsScreenshotLoaded] = useState(false);
  const [isCapturingScreenshot, setIsCapturingScreenshot] = useState(false);
  const [screenshotError, setScreenshotError] = useState<string | null>(null);
  const [isPreparingDesign, setIsPreparingDesign] = useState(false);
  const [targetUrl, setTargetUrl] = useState<string>('');
  const [sidebarScrolled, setSidebarScrolled] = useState(false);
  const [screenshotCollapsed, setScreenshotCollapsed] = useState(false);
  const [loadingStage, setLoadingStage] = useState<'gathering' | 'planning' | 'generating' | null>(null);
  const [isStartingNewGeneration, setIsStartingNewGeneration] = useState(false);
  const [sandboxFiles, setSandboxFiles] = useState<Record<string, string>>({});
  const [hasInitialSubmission, setHasInitialSubmission] = useState<boolean>(false);
  const [fileStructure, setFileStructure] = useState<string>('');
  const [iframeRevealed, setIframeRevealed] = useState<boolean>(false);
  
  // Refs - must be declared at the top with all hooks
  const sandboxCreationRef = useRef<boolean>(false);
  const pipelineStartedRef = useRef(false);
  const pipelineInputsRef = useRef<PipelineInputs>({});
  
  // Low balance modal state
  const [showLowBalanceModal, setShowLowBalanceModal] = useState(false);
  const [lowBalanceData, setLowBalanceData] = useState({
    currentBalance: 0,
    estimatedTokens: 5000,
    targetUrl: ''
  });
  
  const [conversationContext, setConversationContext] = useState<{
    scrapedWebsites: Array<{ url: string; content: any; timestamp: Date }>;
    generatedComponents: Array<{ name: string; path: string; content: string }>;
    appliedCode: Array<{ files: string[]; timestamp: Date }>;
    currentProject: string;
    lastGeneratedCode?: string;
  }>({
    scrapedWebsites: [],
    generatedComponents: [],
    appliedCode: [],
    currentProject: '',
    lastGeneratedCode: undefined
  });
  
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const chatMessagesRef = useRef<HTMLDivElement>(null);
  const codeDisplayRef = useRef<HTMLDivElement>(null);
  
  const [codeApplicationState, setCodeApplicationState] = useState<CodeApplicationState>({
    stage: null
  });
  
  const [generationProgress, setGenerationProgress] = useState<{
    isGenerating: boolean;
    status: string;
    components: Array<{ name: string; path: string; completed: boolean }>;
    currentComponent: number;
    streamedCode: string;
    isStreaming: boolean;
    isThinking: boolean;
    thinkingText?: string;
    thinkingDuration?: number;
    currentFile?: { path: string; content: string; type: string };
    files: Array<{ path: string; content: string; type: string; completed: boolean; edited?: boolean }>;
    lastProcessedPosition: number;
    isEdit?: boolean;
  }>({
    isGenerating: false,
    status: '',
    components: [],
    currentComponent: 0,
    streamedCode: '',
    isStreaming: false,
    isThinking: false,
    files: [],
    lastProcessedPosition: 0,
  });
  
  // Store flag to trigger generation after component mounts
  const [shouldAutoGenerate, setShouldAutoGenerate] = useState(false);

  // -------------------------------------------------------------------------
  // Progressive pipeline state (Req 18.3) — fed by /api/generation-pipeline SSE
  // -------------------------------------------------------------------------
  const [pipeline, setPipeline] = useState<{
    active: boolean;
    currentPhase: PhaseState;
    sectionStatuses: Record<string, SectionStatus>;
    overallPercent: number;
    executionLog: PhaseExecutionLog[];
    tokenUsageByPhase: Record<string, number>;
    errors: Array<{ sectionName: string; errorType: string }>;
    startedAt?: number;
  }>({
    active: false,
    currentPhase: 'idle',
    sectionStatuses: {},
    overallPercent: 0,
    executionLog: [],
    tokenUsageByPhase: {},
    errors: [],
  });

  /** Non-null when a persisted run with a lastSuccessfulPhase is detected. */
  const [resumePrompt, setResumePrompt] = useState<{
    lastSuccessfulPhase: PhaseState | null;
    sandboxId: string | null;
    sandboxUrl: string | null;
  } | null>(null);

  /** Stable per-browser session id used to persist/resume pipeline context. */
  const sessionIdRef = useRef<string>('');

  // Establish a stable session id on mount.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const existing =
      sessionStorage.getItem('generationSessionId') ||
      localStorage.getItem('generationSessionId');
    if (existing) {
      sessionIdRef.current = existing;
    } else {
      const sid = `gen-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem('generationSessionId', sid);
      localStorage.setItem('generationSessionId', sid);
      sessionIdRef.current = sid;
    }
  }, []);

  // On page load, detect a persisted pipeline context and show the
  // resume/restart prompt — no state-machine transition happens until the user
  // chooses (Req 6.4, 18.3).
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session) return;
    if (!sessionIdRef.current) return;

    fetch(
      `/api/generation-pipeline/status?sessionId=${encodeURIComponent(sessionIdRef.current)}`,
    )
      .then((r) => r.json())
      .then((data: {
        resumable?: boolean;
        lastSuccessfulPhase?: PhaseState | null;
        sandboxId?: string | null;
        sandboxUrl?: string | null;
      }) => {
        if (data.resumable) {
          setResumePrompt({
            lastSuccessfulPhase: data.lastSuccessfulPhase ?? null,
            sandboxId: data.sandboxId ?? null,
            sandboxUrl: data.sandboxUrl ?? null,
          });
        }
      })
      .catch((err) =>
        console.warn('[generation] Resumability check failed:', err),
      );
  }, [authStatus, session]);

  // -------------------------------------------------------------------------
  // Pipeline SSE runner (Req 18.3)
  // -------------------------------------------------------------------------
  function runGenerationPipeline(
    targetUrl: string,
    opts: { resume?: boolean; inputs?: PipelineInputs; sandboxId?: string } = {},
  ): void {
    if (!sessionIdRef.current || pipelineStartedRef.current) {
      console.log('[Phase: pipeline] Skipping duplicate or uninitialized start', {
        hasSessionId: Boolean(sessionIdRef.current),
        alreadyStarted: pipelineStartedRef.current,
      });
      return;
    }

    const sid = sessionIdRef.current;
    const resume = opts.resume ?? false;
    const inputs = opts.inputs ?? pipelineInputsRef.current;
    const requestedSandboxId = opts.sandboxId ?? (resume ? (resumePrompt?.sandboxId ?? sandboxData?.sandboxId) : sandboxData?.sandboxId);
    pipelineStartedRef.current = true;

    console.log(`[Phase: pipeline] Starting five-phase pipeline — resume=${resume}`);

    setPipeline({
      active: true,
      currentPhase: resume ? (resumePrompt?.lastSuccessfulPhase ?? 'analyzing') : 'analyzing',
      sectionStatuses: {},
      overallPercent: 0,
      executionLog: [],
      tokenUsageByPhase: {},
      errors: [],
      startedAt: Date.now(),
    });

    // Hide the resume prompt while the pipeline runs.
    setResumePrompt(null);

    (async () => {
      try {
        const response = await fetch('/api/generation-pipeline', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            url: targetUrl,
            sessionId: sid,
            sandboxId: requestedSandboxId,
            resume,
            inputs,
          }),
        });

        if (!response.ok || !response.body) {
          throw new Error(
            `Pipeline request failed: ${response.status} ${response.statusText}`,
          );
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';

        const readLoop = async (): Promise<void> => {
          for (;;) {
            const { done, value } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });

            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';
            for (const line of lines) {
              const trimmed = line.trim();
              if (!trimmed.startsWith('data:')) continue;
              const dataStr = trimmed.slice(5).trim();
              if (!dataStr || dataStr === '[DONE]') continue;
              try {
                handlePipelineEvent(JSON.parse(dataStr));
              } catch {
                // Ignore malformed events
              }
            }
          }
        };

        await readLoop();
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error('[generation] Pipeline failed:', err);
        setPipeline((prev) => ({ ...prev, active: false }));
        pipelineStartedRef.current = false;
        addChatMessage(`Something went wrong: ${message}`, 'error');
      }
    })();
  }

  /** Dispatch a single PipelineEvent into UI state (Req 18.3). */
  function handlePipelineEvent(event: Record<string, unknown>): void {
    const type = event['type'] as string;
    const phase = (event['phase'] ?? event['to'] ?? 'idle') as PhaseState;
    console.log(`[Phase: pipeline] SSE event — type=${type}, phase=${phase}`, {
      sectionName: event['sectionName'],
      status: event['status'],
      overallPercent: event['overallPercent'],
    });

    switch (type) {
      case 'phase_transition': {
        const to = (event['to'] as PhaseState) ?? phase;
        setPipeline((prev) => ({ ...prev, currentPhase: to }));

        // Wire the preview iframe to the sandbox URL from Instant Preview
        // (Req 18.3).
        const payload = (event['payload'] ?? {}) as Record<string, unknown>;
        if (typeof payload['sandboxUrl'] === 'string') {
          setSandboxData((prev) =>
            prev
              ? { ...prev, url: payload['sandboxUrl'] as string }
              : { url: payload['sandboxUrl'] as string, sandboxId: (payload['sandboxId'] as string) ?? 'resume-sandbox', createdAt: new Date(), files: {} },
          );
          if (iframeRef.current) {
            iframeRef.current.src = payload['sandboxUrl'] as string;
          }
        }
        break;
      }
      case 'section_status': {
        const sectionName = event['sectionName'] as string | undefined;
        const status = event['status'] as SectionStatus | undefined;
        const overallPercent = Number(event['overallPercent'] ?? 0);
        if (sectionName && status) {
          setPipeline((prev) => ({
            ...prev,
            currentPhase: 'progressive_cloning',
            sectionStatuses: { ...prev.sectionStatuses, [sectionName]: status },
            overallPercent,
          }));
        }
        break;
      }
      case 'token_usage': {
        const tokens = Number(event['tokens'] ?? 0);
        setPipeline((prev) => ({
          ...prev,
          tokenUsageByPhase: {
            ...prev.tokenUsageByPhase,
            [phase]: (prev.tokenUsageByPhase[phase] ?? 0) + tokens,
          },
        }));
        break;
      }
      case 'build_error': {
        const payload = (event['payload'] ?? {}) as Record<string, unknown>;
        const files = (payload['permanentlyFailedFiles'] ?? []) as Array<{
          filePath?: string;
          finalError?: string;
        }>;
        if (files.length > 0) {
          setPipeline((prev) => ({
            ...prev,
            errors: [
              ...prev.errors,
              ...files.map((f) => ({
                sectionName: f.filePath ?? 'unknown',
                errorType: f.finalError ?? 'Build error',
              })),
            ],
          }));
          // Build specific, actionable message based on what failed
          const failedNames = files
            .map((f) => f.filePath?.split('/').pop() ?? 'unknown')
            .slice(0, 3)
            .join(', ');
          const truncated = files.length > 3 ? ` (and ${files.length - 3} more)` : '';
          const isMissingPkg = files.some((f) =>
            (f.finalError ?? '').toLowerCase().includes('failed to resolve import') ||
            (f.finalError ?? '').toLowerCase().includes('cannot find module')
          );
          if (isMissingPkg) {
            addChatMessage(
              `Missing a package — type "install <package-name>" and I'll add it.`,
              'error',
            );
          } else {
            addChatMessage(
              `${files.length} file(s) couldn't be compiled: ${failedNames}${truncated}. The AI tried fixing them but hit a wall. Ask me to try again, or check the code in the file tree.`,
              'error',
            );
          }
        }
        break;
      }
      case 'complete': {
        const payload = (event['payload'] ?? {}) as Record<string, unknown>;
        const completedFiles = (payload['files'] ?? {}) as Record<string, string>;
        if (Object.keys(completedFiles).length > 0) {
          setSandboxFiles(completedFiles);
          setFileStructure(JSON.stringify(Object.keys(completedFiles), null, 2));
        } else {
          void fetchSandboxFiles();
        }
        setPipeline((prev) => ({
          ...prev,
          active: false,
          currentPhase: 'complete',
          overallPercent: 100,
        }));
        pipelineStartedRef.current = false;
        if (typeof payload['sandboxId'] === 'string') {
          setSandboxData((prev) => prev ? { ...prev, sandboxId: payload['sandboxId'] as string } : prev);
        }
        if (typeof payload['sandboxUrl'] === 'string') {
          setSandboxData((prev) =>
            prev
              ? { ...prev, url: payload['sandboxUrl'] as string }
              : { url: payload['sandboxUrl'] as string, sandboxId: (payload['sandboxId'] as string) ?? 'resume-sandbox', createdAt: new Date(), files: {} },
          );
          if (iframeRef.current) {
            iframeRef.current.src = payload['sandboxUrl'] as string;
          }
        }
        addChatMessage('Shipped.', 'system');
        break;
      }
      case 'error': {
        const message = (event['message'] as string) ?? 'Pipeline error';
        setPipeline((prev) => ({ ...prev, active: false }));
        pipelineStartedRef.current = false;
        addChatMessage(`Something went wrong: ${message}`, 'error');
        break;
      }
      default:
        break;
    }
  }
  
  // Protect the route - redirect to login if not authenticated
  useEffect(() => {
    if (authStatus === 'unauthenticated') {
      router.push('/login');
    }
  }, [authStatus, router]);
  
  // Load user's selected models
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('selectedModels');
      if (saved) {
        setUserModels(JSON.parse(saved));
      } else {
        const defaults = appConfig.ai.defaultBuilderModels || appConfig.ai.availableModels.slice(0, 3);
        setUserModels(defaults);
      }
    }
  }, []);
  
  // Clear old conversation data on component mount and create/restore sandbox
  useEffect(() => {
    if (authStatus !== 'authenticated' || !session) return; // Don't run if not authenticated
    
    let isMounted = true;
    let sandboxCreated = false; // Track if sandbox was created in this effect

    const initializePage = async () => {
      // Prevent double execution in React StrictMode
      if (sandboxCreated) return;
      
      // First check URL parameters (from home page navigation)
      const urlParam = searchParams.get('url');
      const templateParam = searchParams.get('template');
      const detailsParam = searchParams.get('details');
      
      // Then check session storage as fallback
      const storedUrl = urlParam || sessionStorage.getItem('targetUrl');
      const storedStyle = templateParam || sessionStorage.getItem('selectedStyle');
      const storedModel = sessionStorage.getItem('selectedModel');
      const storedInstructions = sessionStorage.getItem('additionalInstructions');
      const storedMarkdown = sessionStorage.getItem('siteMarkdown');
      const isBrandExtension = sessionStorage.getItem('brandExtensionMode') === 'true';
      const brandPrompt = sessionStorage.getItem('brandExtensionPrompt') || '';
      const pipelineInstructions = detailsParam || storedInstructions || '';

      if (storedUrl) {
        // Mark that we have an initial submission since we're loading with a URL
        setHasInitialSubmission(true);
        
        // Clear sessionStorage after reading  
        sessionStorage.removeItem('targetUrl');
        sessionStorage.removeItem('selectedStyle');
        sessionStorage.removeItem('selectedModel');
        sessionStorage.removeItem('additionalInstructions');
        // Note: Don't clear siteMarkdown here, it will be cleared when used
        
        // Set the values in the component state
        setHomeUrlInput(storedUrl);
        setSelectedStyle(storedStyle || 'modern');
        
        // Add details to context if provided
        if (detailsParam) {
          setHomeContextInput(detailsParam);
        } else if (storedStyle && !urlParam) {
          // Only apply stored style if no screenshot URL is provided
          // This prevents unwanted style inheritance when using screenshot search
          const styleNames: Record<string, string> = {
            '1': 'Glassmorphism',
            '2': 'Neumorphism',
            '3': 'Brutalism',
            '4': 'Minimalist',
            '5': 'Dark Mode',
            '6': 'Gradient Rich',
            '7': '3D Depth',
            '8': 'Retro Wave',
            'modern': 'Modern clean and minimalist',
            'playful': 'Fun colorful and playful',
            'professional': 'Corporate professional and sleek',
            'artistic': 'Creative artistic and unique'
          };
          const styleName = styleNames[storedStyle] || storedStyle;
          let contextString = `${styleName} style design`;
          
          // Add additional instructions if provided
          if (storedInstructions) {
            contextString += `. ${storedInstructions}`;
          }
          
          setHomeContextInput(contextString);
        } else if (storedInstructions && !urlParam) {
          // Apply only instructions if no style but instructions are provided
          // and no screenshot URL is provided
          setHomeContextInput(storedInstructions);
        }
        
        if (storedModel && !isUnavailableModel(storedModel)) {
          setAiModel(storedModel);
        }
        
        // Skip the home screen and go directly to builder
        setShowHomeScreen(false);
        setHomeScreenFading(false);
        
        // Set flag to auto-trigger generation after component updates
        setShouldAutoGenerate(true);
        
        // Also set autoStart flag for the effect
        sessionStorage.setItem('autoStart', 'true');
      }
      
      // Clear old conversation
      try {
        await fetch('/api/conversation-state', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'clear-old' })
        });
        console.log('[home] Cleared old conversation data on mount');
      } catch (error) {
        console.error('[ai-sandbox] Failed to clear old conversation:', error);
        if (isMounted) {
          addChatMessage("Couldn't clear old data — continuing anyway.", 'error');
        }
      }
      
      if (!isMounted) return;

      // Check if sandbox ID is in URL
      const sandboxIdParam = searchParams.get('sandbox');
      const resumeFromProject = searchParams.get('resume') === 'project';
      
      setLoading(true);
      try {
        if (sandboxIdParam && resumeFromProject) {
          // Resume a saved project from the dashboard.
          // Find the project by sandboxId, call the resume API, and load
          // the sandbox URL directly — no new sandbox is created.
          console.log('[home] Resuming saved project sandbox:', sandboxIdParam);
          sandboxCreated = true;
          await resumeProjectSandbox(sandboxIdParam);
        } else if (sandboxIdParam) {
          // Old-style sandbox restore — try to reconnect directly.
          console.log('[home] Attempting to restore sandbox:', sandboxIdParam);
          sandboxCreated = true;
          await createSandbox(true);
        } else {
          // Fresh clone: the five-phase pipeline creates its own sandbox in the
          // Instant Preview phase. Pre-creating one here would duplicate work
          // and split ownership of the sandbox lifecycle.
          console.log('[home] Fresh clone: sandbox will be created by the generation pipeline (Instant Preview phase).');
        }
        
        // If we have a URL from the home page, mark for automatic start
        if (storedUrl && isMounted) {
          // We'll trigger the generation after the component is fully mounted
          // and the startGeneration function is defined
          sessionStorage.setItem('autoStart', 'true');
        }
      } catch (error) {
        console.error('[ai-sandbox] Failed to create or restore sandbox:', error);
        if (isMounted) {
          addChatMessage('Sandbox could not be started. Retrying...', 'error');
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    
    initializePage();

    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Run only on mount
  
  useEffect(() => {
    // Handle Escape key for home screen
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && showHomeScreen) {
        setHomeScreenFading(true);
        setTimeout(() => {
          setShowHomeScreen(false);
          setHomeScreenFading(false);
        }, 500);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showHomeScreen]);
  
  // Start capturing screenshot if URL is provided on mount (from home screen)
  useEffect(() => {
    if (!showHomeScreen && homeUrlInput && !urlScreenshot && !isCapturingScreenshot) {
      let screenshotUrl = homeUrlInput.trim();
      if (!screenshotUrl.match(/^https?:\/\//i)) {
        screenshotUrl = 'https://' + screenshotUrl;
      }
      captureUrlScreenshot(screenshotUrl);
    }
  }, [showHomeScreen, homeUrlInput]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-start generation if flagged (from builder/home navigation)
  useEffect(() => {
    const autoStart = sessionStorage.getItem('autoStart');
    if (autoStart === 'true' && !showHomeScreen && homeUrlInput) {
      sessionStorage.removeItem('autoStart');
      // Small delay to ensure everything is ready
      setTimeout(() => {
        console.log('[generation] Auto-starting generation for URL:', homeUrlInput);
        setShouldAutoGenerate(true);
      }, 1000);
    }
  }, [showHomeScreen, homeUrlInput]);


  const checkSandboxStatus = async () => {
    try {
      const response = await fetch('/api/sandbox-status');
      const data = await response.json();
      
      if (data.active && data.healthy && data.sandboxData) {
        console.log('[checkSandboxStatus] Setting sandboxData from API:', data.sandboxData);
        setSandboxData(data.sandboxData);
        updateStatus('Sandbox active', true);
      } else if (data.active && !data.healthy) {
        // Sandbox exists but not responding
        updateStatus('Sandbox not responding', false);
        // Keep existing sandboxData if we have it - don't clear it
      } else {
        // Only clear sandboxData if we don't already have it or if we're explicitly checking from a fresh state
        // This prevents clearing sandboxData during normal operation when it should persist
        if (!sandboxData) {
          console.log('[checkSandboxStatus] No existing sandboxData, clearing state');
          setSandboxData(null);
          updateStatus('No sandbox', false);
        } else {
          // Keep existing sandboxData and just update status
          console.log('[checkSandboxStatus] Keeping existing sandboxData, sandbox inactive but data preserved');
          updateStatus('Sandbox status unknown', false);
        }
      }
    } catch (error) {
      console.error('Failed to check sandbox status:', error);
      // Only clear on error if we don't have existing sandboxData
      if (!sandboxData) {
        setSandboxData(null);
        updateStatus('Error', false);
      } else {
        updateStatus('Status check failed', false);
      }
    }
  };

  useEffect(() => {
    // Only check sandbox status on mount if we don't already have sandboxData
    // AND we're not auto-starting a new generation (which would create a new sandbox)
    const autoStart = sessionStorage.getItem('autoStart');
    if (!sandboxData && autoStart !== 'true') {
      checkSandboxStatus();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (chatMessagesRef.current) {
      chatMessagesRef.current.scrollTop = chatMessagesRef.current.scrollHeight;
    }
  }, [chatMessages]);

  // Reset iframe reveal state when sandbox URL changes (new clone)
  useEffect(() => {
    setIframeRevealed(false);
  }, [sandboxData?.url]);

  // Auto-trigger generation when flag is set (from home page navigation)
  useEffect(() => {
    if (shouldAutoGenerate && homeUrlInput && !showHomeScreen) {
      // Reset the flag
      setShouldAutoGenerate(false);
      
      // Trigger generation after a short delay to ensure everything is set up
      const timer = setTimeout(() => {
        console.log('[generation] Auto-triggering generation from URL params');
        startGeneration();
      }, 1000);
      
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shouldAutoGenerate, homeUrlInput, showHomeScreen]);

  // Enhanced auto-scroll: More aggressive scrolling during streaming
  useEffect(() => {
    if (codeDisplayRef.current && generationProgress.isStreaming) {
      // Smooth scroll to bottom with animation
      codeDisplayRef.current.scrollTo({
        top: codeDisplayRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [generationProgress.streamedCode, generationProgress.isStreaming]);
  
  // Additional effect to force scroll on every streamedCode change
  useEffect(() => {
    if (generationProgress.isStreaming && codeDisplayRef.current) {
      // Use requestAnimationFrame to ensure smooth scrolling every frame
      requestAnimationFrame(() => {
        if (codeDisplayRef.current) {
          codeDisplayRef.current.scrollTop = codeDisplayRef.current.scrollHeight;
        }
      });
    }
  }, [generationProgress.streamedCode]);

  // ALL HOOKS DECLARED - NOW WE CAN HAVE CONDITIONAL RETURNS
  
  // Show loading while checking authentication, OR while session hasn't
  // populated yet after status resolved (prevents blank-screen flash).
  if (authStatus === 'loading' || (authStatus === 'authenticated' && !session)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-red-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Waking up the sandbox...</p>
        </div>
      </div>
    );
  }
  
  // Don't render if not authenticated
  if (!session) {
    return null;
  }

  const updateStatus = (text: string, active: boolean) => {
    setStatus({ text, active });
  };

  const log = (message: string, type: 'info' | 'error' | 'command' = 'info') => {
    setResponseArea(prev => [...prev, `[${type}] ${message}`]);
  };

  const addChatMessage = (content: string, type: ChatMessage['type'], metadata?: ChatMessage['metadata']) => {
    setChatMessages(prev => {
      // Skip duplicate consecutive system messages
      if (type === 'system' && prev.length > 0) {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage.type === 'system' && lastMessage.content === content) {
          return prev; // Skip duplicate
        }
      }
      return [...prev, { content, type, timestamp: new Date(), metadata }];
    });
  };
  
  const checkAndInstallPackages = async () => {
    // This function is only called when user explicitly requests it
    // Don't show error if no sandbox - it's likely being created
    if (!sandboxData) {
      console.log('[checkAndInstallPackages] No sandbox data available yet');
      return;
    }
    
    // Vite error checking removed - handled by template setup
    addChatMessage('Sandbox is ready. Packages are good to go.', 'system');
  };
  
  const handleSurfaceError = (_errors: any[]) => {
    // Function kept for compatibility but Vite errors are now handled by template
    
    // Focus the input
    const textarea = document.querySelector('textarea') as HTMLTextAreaElement;
    if (textarea) {
      textarea.focus();
    }
  };
  
  const installPackages = async (packages: string[]) => {
    if (!sandboxData) {
      addChatMessage('No sandbox yet — start a generation first.', 'system');
      return;
    }
    
    try {
      const response = await fetch('/api/install-packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packages })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to install packages: ${response.statusText}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (!data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;
                case 'output':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'error':
                  if (data.message && data.message !== 'undefined') {
                    addChatMessage(data.message, 'command', { commandType: 'error' });
                  }
                  break;
                case 'warning':
                  addChatMessage(data.message, 'command', { commandType: 'output' });
                  break;
                case 'success':
                  addChatMessage(`${data.message}`, 'system');
                  break;
                case 'status':
                  addChatMessage(data.message, 'system');
                  break;
              }
            } catch (e) {
              console.error('Failed to parse SSE data:', e);
            }
          }
        }
      }
    } catch (error: any) {
      addChatMessage(`Package install failed: ${error.message}. Try again.`, 'system');
    }
  };

  const createSandbox = async (fromHomeScreen = false) => {
    // Prevent duplicate sandbox creation
    if (sandboxCreationRef.current) {
      console.log('[createSandbox] Sandbox creation already in progress, skipping...');
      return null;
    }
    
    sandboxCreationRef.current = true;

    // Note: Token validation is now done at generation time based on actual content size
    // Minimum balance check only
    try {
      const tokenRes = await fetch('/api/tokens/balance');
      if (tokenRes.ok) {
        const tokenData = await tokenRes.json();
        
        // Use a minimum threshold - detailed calculation happens at generation time
        const minimumRecommended = 5000;
        
        if (tokenData.tokens < minimumRecommended) {
          // Show the beautiful encouraging modal instead of basic confirm
          setLowBalanceData({
            currentBalance: tokenData.tokens,
            estimatedTokens: minimumRecommended,
            targetUrl: homeUrlInput || targetUrl || 'websites'
          });
          setShowLowBalanceModal(true);
          sandboxCreationRef.current = false;
          return null;
        }
      }
    } catch (error) {
      console.error('Error checking token balance:', error);
    }
    
    console.log('[createSandbox] Starting sandbox creation...');
    setLoading(true);
    setShowLoadingBackground(true);
    updateStatus('Creating sandbox...', false);
    setResponseArea([]);
    setScreenshotError(null);
    
    try {
      // Determine the source URL (the website being cloned, if any).
      // This gets saved with the project so the dashboard can show what
      // each project was cloned from.
      const sourceUrl = homeUrlInput || targetUrl || '';

      const response = await fetch('/api/create-ai-sandbox-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceUrl })
      });
      
      // Safely parse the JSON response — the server may return a non-JSON
      // error body (e.g. 500 with an HTML error page or empty body).
      let data: any;
      try {
        const text = await response.text();
        data = text ? JSON.parse(text) : {};
      } catch {
        throw new Error(`Sandbox server returned an invalid response (HTTP ${response.status}). This is usually temporary — try again.`);
      }
      console.log('[createSandbox] Response data:', data);
      
      if (data.success) {
        sandboxCreationRef.current = false; // Reset the ref on success
        console.log('[createSandbox] Setting sandboxData from creation:', data);
        setSandboxData(data);
        updateStatus('Sandbox active', true);
        log('Sandbox created successfully!');
        log(`Sandbox ID: ${data.sandboxId}`);
        log(`URL: ${data.url}`);
        
        // Update URL with sandbox ID
        const newParams = new URLSearchParams(searchParams.toString());
        newParams.set('sandbox', data.sandboxId);
        newParams.set('model', aiModel);
        router.push(`/generation?${newParams.toString()}`, { scroll: false });
        
        // Fade out loading background after sandbox loads
        setTimeout(() => {
          setShowLoadingBackground(false);
        }, 3000);
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        // Fetch sandbox files after creation
        setTimeout(fetchSandboxFiles, 1000);
        
        // For Vercel sandboxes, Vite is already started during setupViteApp
        // No need to restart it immediately after creation
        // Only restart if there's an actual issue later
        console.log('[createSandbox] Sandbox ready with Vite server running');
        
        // Only add welcome message if not coming from home screen
        if (!fromHomeScreen) {
          addChatMessage(`Sandbox is live. I've got the full file context — tell me what to build and I'll apply it directly.`, 'system');
        }
        
        setTimeout(() => {
          if (iframeRef.current) {
            iframeRef.current.src = data.url;
          }
        }, 100);
        
        // Return the sandbox data so it can be used immediately
        return data;
      } else {
        throw new Error(data.error || 'Unknown error');
      }
    } catch (error: any) {
      console.error('[createSandbox] Error:', error);
      updateStatus('Error', false);
      log(`Failed to create sandbox: ${error.message}`, 'error');
      addChatMessage('Sandbox could not start — this is usually temporary. Try again in a moment.', 'error');
      throw error;
    } finally {
      setLoading(false);
      sandboxCreationRef.current = false; // Reset the ref
    }
  };

  const displayStructure = (structure: any) => {
    if (typeof structure === 'object') {
      setStructureContent(JSON.stringify(structure, null, 2));
    } else {
      setStructureContent(structure || 'No structure available');
    }
  };

  /**
   * Resume a saved project from the dashboard. Instead of creating a new
   * sandbox, this calls the /api/projects/[id]/resume endpoint which uses
   * E2B's Sandbox.connect() to resume the paused sandbox.
   */
  const resumeProjectSandbox = async (sandboxId: string) => {
    try {
      updateStatus('Resuming sandbox...', false);
      log(`Resuming sandbox: ${sandboxId}`);

      // Fetch the user's projects to find the one matching this sandboxId.
      const projectsRes = await fetch('/api/projects');
      if (!projectsRes.ok) {
        throw new Error('Failed to fetch projects');
      }
      const projectsData = await projectsRes.json();
      const project = (projectsData.projects || []).find(
        (p: any) => p.sandboxId === sandboxId,
      );

      if (!project) {
        throw new Error('Project not found — it may have been deleted.');
      }

      // Call the resume endpoint to reconnect the paused E2B sandbox.
      const resumeRes = await fetch(`/api/projects/${project._id}/resume`, {
        method: 'POST',
      });
      const resumeData = await resumeRes.json();

      if (!resumeData.success) {
        throw new Error(resumeData.error || 'Failed to resume sandbox');
      }

      console.log('[resumeProjectSandbox] Resumed:', resumeData);
      setSandboxData({
        sandboxId: resumeData.sandboxId,
        url: resumeData.url,
      });
      updateStatus('Sandbox active', true);
      log('Sandbox resumed successfully!');
      log(`URL: ${resumeData.url}`);

      // Load the preview in the iframe.
      setTimeout(() => {
        if (iframeRef.current) {
          iframeRef.current.src = resumeData.url;
        }
      }, 100);

      // Fetch sandbox files after resume.
      setTimeout(fetchSandboxFiles, 1000);

      addChatMessage('Welcome back! Your sandbox has been resumed. All your files and state are preserved.', 'system');

      setTimeout(() => {
        setShowLoadingBackground(false);
      }, 2000);
    } catch (error: any) {
      console.error('[resumeProjectSandbox] Error:', error);
      updateStatus('Error', false);
      log(`Failed to resume sandbox: ${error.message}`, 'error');
      addChatMessage('Could not resume the sandbox. It may have expired. Try creating a new one from the builder.', 'error');
      throw error;
    } finally {
      setLoading(false);
    }
  };

  const applyGeneratedCode = async (code: string, isEdit: boolean = false, overrideSandboxData?: SandboxData) => {
    setLoading(true);
    log('Applying AI-generated code...');
    
    try {
      // Show progress component instead of individual messages
      setCodeApplicationState({ stage: 'analyzing' });
      
      // Get pending packages from tool calls
      const pendingPackages = ((window as any).pendingPackages || []).filter((pkg: any) => pkg && typeof pkg === 'string');
      if (pendingPackages.length > 0) {
        console.log('[applyGeneratedCode] Sending packages from tool calls:', pendingPackages);
        // Clear pending packages after use
        (window as any).pendingPackages = [];
      }
      
      // Use streaming endpoint for real-time feedback
      const effectiveSandboxData = overrideSandboxData || sandboxData;
      const response = await fetch('/api/apply-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          response: code,
          isEdit: isEdit,
          packages: pendingPackages,
          sandboxId: effectiveSandboxData?.sandboxId // Pass the sandbox ID to ensure proper connection
        })
      });
      
      if (!response.ok) {
        throw new Error(`Failed to apply code: ${response.statusText}`);
      }
      
      // Handle streaming response
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let finalData: any = null;
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');
        
        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              
              switch (data.type) {
                case 'start':
                  // Don't add as chat message, just update state
                  setCodeApplicationState({ stage: 'analyzing' });
                  break;
                  
                case 'step':
                  // Update progress state based on step
                  if (data.message.includes('Installing') && data.packages) {
                    setCodeApplicationState({ 
                      stage: 'installing', 
                      packages: data.packages 
                    });
                  } else if (data.message.includes('Creating files') || data.message.includes('Applying')) {
                    setCodeApplicationState({ 
                      stage: 'applying',
                      filesGenerated: [] // Files will be populated when complete
                    });
                  }
                  break;
                  
                case 'package-progress':
                  // Handle package installation progress
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case 'command':
                  // Don't show npm install commands - they're handled by info messages
                  if (data.command && !data.command.includes('npm install')) {
                    addChatMessage(data.command, 'command', { commandType: 'input' });
                  }
                  break;
                  
                case 'success':
                  if (data.installedPackages) {
                    setCodeApplicationState(prev => ({ 
                      ...prev,
                      installedPackages: data.installedPackages 
                    }));
                  }
                  break;
                  
                case 'file-progress':
                  // Skip file progress messages, they're noisy
                  break;
                  
                case 'file-complete':
                  // Could add individual file completion messages if desired
                  break;
                  
                case 'command-progress':
                  addChatMessage(`${data.action} command: ${data.command}`, 'command', { commandType: 'input' });
                  break;
                  
                case 'command-output':
                  addChatMessage(data.output, 'command', { 
                    commandType: data.stream === 'stderr' ? 'error' : 'output' 
                  });
                  break;
                  
                case 'command-complete':
                  if (data.success) {
                    addChatMessage(`Done.`, 'system');
                  } else {
                    addChatMessage(`Command failed (exit code ${data.exitCode}). Check the output above.`, 'system');
                  }
                  break;
                  
                case 'complete':
                  finalData = data;
                  setCodeApplicationState({ stage: 'complete' });
                  // Clear the state after a delay
                  setTimeout(() => {
                    setCodeApplicationState({ stage: null });
                  }, 3000);
                  // Reset loading state when complete
                  setLoading(false);
                  break;
                  
                case 'error':
                  addChatMessage(`Error: ${data.message || data.error || 'Something unexpected happened'}`, 'system');
                  // Reset loading state on error
                  setLoading(false);
                  break;
                  
                case 'warning':
                  addChatMessage(`${data.message}`, 'system');
                  break;
                  
                case 'info':
                  // Show info messages, especially for package installation
                  if (data.message) {
                    addChatMessage(data.message, 'system');
                  }
                  break;
              }
            } catch {
              // Ignore parse errors
            }
          }
        }
      }
      
      // Process final data
      if (finalData && finalData.type === 'complete') {
        const data: any = {
          success: true,
          results: finalData.results,
          explanation: finalData.explanation,
          structure: finalData.structure,
          message: finalData.message,
          autoCompleted: finalData.autoCompleted,
          autoCompletedComponents: finalData.autoCompletedComponents,
          warning: finalData.warning,
          missingImports: finalData.missingImports,
          debug: finalData.debug
        };
        
        if (data.success) {
          const { results } = data;
        
        // Log package installation results without duplicate messages
        if (results.packagesInstalled?.length > 0) {
          log(`Packages installed: ${results.packagesInstalled.join(', ')}`);
        }
        
        if (results.filesCreated?.length > 0) {
          log('Files created:');
          results.filesCreated.forEach((file: string) => {
            log(`  ${file}`, 'command');
          });
          
          // Verify files were actually created by refreshing the sandbox if needed
          if (sandboxData?.sandboxId && results.filesCreated.length > 0) {
            // Small delay to ensure files are written
            setTimeout(() => {
              // Force refresh the iframe to show new files
              if (iframeRef.current) {
                iframeRef.current.src = iframeRef.current.src;
              }
            }, 1000);
          }
        }
        
        if (results.filesUpdated?.length > 0) {
          log('Files updated:');
          results.filesUpdated.forEach((file: string) => {
            log(`  ${file}`, 'command');
          });
        }
        
        // Update conversation context with applied code
        setConversationContext(prev => ({
          ...prev,
          appliedCode: [...prev.appliedCode, {
            files: [...(results.filesCreated || []), ...(results.filesUpdated || [])],
            timestamp: new Date()
          }]
        }));
        
        if (results.commandsExecuted?.length > 0) {
          log('Commands executed:');
          results.commandsExecuted.forEach((cmd: string) => {
            log(`  $ ${cmd}`, 'command');
          });
        }
        
        if (results.errors?.length > 0) {
          results.errors.forEach((err: string) => {
            log(err, 'error');
          });
        }
        
        if (data.structure) {
          displayStructure(data.structure);
        }
        
        if (data.explanation) {
          log(data.explanation);
        }
        
        if (data.autoCompleted) {
          log('Auto-generating missing components...', 'command');
          
          if (data.autoCompletedComponents) {
            setTimeout(() => {
              log('Auto-generated missing components:', 'info');
              data.autoCompletedComponents.forEach((comp: string) => {
                log(`  ${comp}`, 'command');
              });
            }, 1000);
          }
        } else if (data.warning) {
          log(data.warning, 'error');
          
          if (data.missingImports && data.missingImports.length > 0) {
            const missingList = data.missingImports.join(', ');
            addChatMessage(
              `Type "create the missing components: ${missingList}" to fix this.`,
              'system'
            );
          }
        }
        
        log('Code applied successfully!');
        console.log('[applyGeneratedCode] Response data:', data);
        console.log('[applyGeneratedCode] Debug info:', data.debug);
        console.log('[applyGeneratedCode] Current sandboxData:', sandboxData);
        console.log('[applyGeneratedCode] Current iframe element:', iframeRef.current);
        console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current?.src);
        
        // Set applying code state for edits to show loading overlay
        // Removed overlay - changes apply directly
        
        if (results.filesCreated?.length > 0) {
          setConversationContext(prev => ({
            ...prev,
            appliedCode: [...prev.appliedCode, {
              files: results.filesCreated,
              timestamp: new Date()
            }]
          }));
          
          // Update the chat message to show success
          // Only show file list if not in edit mode
          if (isEdit) {
            addChatMessage(`Done. Take a look.`, 'system');
          } else {
            // Check if this is part of a generation flow (has recent AI recreation message)
            const recentMessages = chatMessages.slice(-5);
            const isPartOfGeneration = recentMessages.some(m => 
              m.content.includes('AI recreation generated') || 
              m.content.includes('Code generated')
            );
            
            // Don't show files if part of generation flow to avoid duplication
            if (isPartOfGeneration) {
              addChatMessage(`Applied ${results.filesCreated.length} files. Live — go take a look.`, 'system');
            } else {
              addChatMessage(`Applied ${results.filesCreated.length} files successfully!`, 'system', {
                appliedFiles: results.filesCreated
              });
            }
          }
          
          // If there are failed packages, add a message about checking for errors
          if (results.packagesFailed?.length > 0) {
            addChatMessage(`⚠️ Some packages didn't install. Check the error banner above.`, 'system');
          }
          
          // Fetch updated file structure
          await fetchSandboxFiles();
          
          // Skip automatic package check - it's not needed here and can cause false "no sandbox" messages
          // Packages are already installed during the apply-ai-code-stream process
          
          // Test build to ensure everything compiles correctly
          // Skip build test for now - it's causing errors with undefined activeSandbox
          // The build test was trying to access global.activeSandbox from the frontend,
          // but that's only available in the backend API routes
          console.log('[build-test] Skipping build test - would need API endpoint');
          
          // Force iframe refresh after applying code
          const refreshDelay = appConfig.codeApplication.defaultRefreshDelay; // Allow Vite to process changes
          
          setTimeout(() => {
            const currentSandboxData = effectiveSandboxData;
            if (iframeRef.current && currentSandboxData?.url) {
              console.log('[home] Refreshing iframe after code application...');
              
              // Method 1: Change src with timestamp
              const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&applied=true`;
              iframeRef.current.src = urlWithTimestamp;
              
              // Method 2: Force reload after a short delay
              setTimeout(() => {
                try {
                  if (iframeRef.current?.contentWindow) {
                    iframeRef.current.contentWindow.location.reload();
                    console.log('[home] Force reloaded iframe content');
                  }
                } catch (e) {
                  console.log('[home] Could not reload iframe (cross-origin):', e);
                }
                // Reload completed
              }, 1000);
            }
          }, refreshDelay);
          
          // Vite error checking removed - handled by template setup
        }
        
          // Give Vite HMR a moment to detect changes, then ensure refresh
          const currentSandboxData = effectiveSandboxData;
          if (iframeRef.current && currentSandboxData?.url) {
            // Wait for Vite to process the file changes
            // If packages were installed, wait longer for Vite to restart
            const packagesInstalled = results?.packagesInstalled?.length > 0 || data.results?.packagesInstalled?.length > 0;
            const refreshDelay = packagesInstalled ? appConfig.codeApplication.packageInstallRefreshDelay : appConfig.codeApplication.defaultRefreshDelay;
            console.log(`[applyGeneratedCode] Packages installed: ${packagesInstalled}, refresh delay: ${refreshDelay}ms`);
            
            setTimeout(async () => {
            if (iframeRef.current && currentSandboxData?.url) {
              console.log('[applyGeneratedCode] Starting iframe refresh sequence...');
              console.log('[applyGeneratedCode] Current iframe src:', iframeRef.current.src);
              console.log('[applyGeneratedCode] Sandbox URL:', currentSandboxData.url);
              
              // Method 1: Try direct navigation first
              try {
                const urlWithTimestamp = `${currentSandboxData.url}?t=${Date.now()}&force=true`;
                console.log('[applyGeneratedCode] Attempting direct navigation to:', urlWithTimestamp);
                
                // Remove any existing onload handler
                iframeRef.current.onload = null;
                
                // Navigate directly
                iframeRef.current.src = urlWithTimestamp;
                
                // Wait a bit and check if it loaded
                await new Promise(resolve => setTimeout(resolve, 2000));
                
                // Try to access the iframe content to verify it loaded
                try {
                  const iframeDoc = iframeRef.current.contentDocument || iframeRef.current.contentWindow?.document;
                  if (iframeDoc && iframeDoc.readyState === 'complete') {
                    console.log('[applyGeneratedCode] Iframe loaded successfully');
                    return;
                  }
                } catch {
                  console.log('[applyGeneratedCode] Cannot access iframe content (CORS), assuming loaded');
                  return;
                }
              } catch (e) {
                console.error('[applyGeneratedCode] Direct navigation failed:', e);
              }
              
              // Method 2: Force complete iframe recreation if direct navigation failed
              console.log('[applyGeneratedCode] Falling back to iframe recreation...');
              const parent = iframeRef.current.parentElement;
              const newIframe = document.createElement('iframe');
              
              // Copy attributes
              newIframe.className = iframeRef.current.className;
              newIframe.title = iframeRef.current.title;
              newIframe.allow = iframeRef.current.allow;
              // Copy sandbox attributes
              const sandboxValue = iframeRef.current.getAttribute('sandbox');
              if (sandboxValue) {
                newIframe.setAttribute('sandbox', sandboxValue);
              }
              
              // Remove old iframe
              iframeRef.current.remove();
              
              // Add new iframe
              newIframe.src = `${currentSandboxData.url}?t=${Date.now()}&recreated=true`;
              parent?.appendChild(newIframe);
              
              // Update ref
              (iframeRef as any).current = newIframe;
              
              console.log('[applyGeneratedCode] Iframe recreated with new content');
            } else {
              console.error('[applyGeneratedCode] No iframe or sandbox URL available for refresh');
            }
          }, refreshDelay); // Dynamic delay based on whether packages were installed
        }
        
        } else {
          throw new Error(finalData?.error || 'Failed to apply code');
        }
      } else {
        // If no final data was received, still close loading
        addChatMessage('Code application may have partially succeeded. Check the preview.', 'system');
      }
    } catch (error: any) {
      log(`Failed to apply code: ${error.message}`, 'error');
    } finally {
      setLoading(false);
      // Clear isEdit flag after applying code
      setGenerationProgress(prev => ({
        ...prev,
        isEdit: false
      }));
    }
  };

  const fetchSandboxFiles = async () => {
    if (!sandboxData) return;
    
    try {
      const response = await fetch('/api/get-sandbox-files', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        }
      });
      
      if (response.ok) {
        const data = await response.json();
        if (data.success) {
          setSandboxFiles(data.files || {});
          setFileStructure(data.structure || '');
          console.log('[fetchSandboxFiles] Updated file list:', Object.keys(data.files || {}).length, 'files');
        }
      }
    } catch (error) {
      console.error('[fetchSandboxFiles] Error fetching files:', error);
    }
  };
  
//   const restartViteServer = async () => {
//     try {
//       addChatMessage('Restarting Vite dev server...', 'system');
//       
//       const response = await fetch('/api/restart-vite', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' }
//       });
//       
//       if (response.ok) {
//         const data = await response.json();
//         if (data.success) {
//           addChatMessage('✓ Vite dev server restarted successfully!', 'system');
//           
//           // Refresh the iframe after a short delay
//           setTimeout(() => {
//             if (iframeRef.current && sandboxData?.url) {
//               iframeRef.current.src = `${sandboxData.url}?t=${Date.now()}`;
//             }
//           }, 2000);
//         } else {
//           addChatMessage(`Failed to restart Vite: ${data.error}`, 'error');
//         }
//       } else {
//         addChatMessage('Failed to restart Vite server', 'error');
//       }
//     } catch (error) {
//       console.error('[restartViteServer] Error:', error);
//       addChatMessage(`Error restarting Vite: ${error instanceof Error ? error.message : 'Unknown error'}`, 'error');
//     }
//   };

//   const applyCode = async () => {
//     const code = promptInput.trim();
//     if (!code) {
//       log('Please enter some code first', 'error');
//       addChatMessage('No code to apply. Please generate code first.', 'system');
//       return;
//     }
//     
//     // Prevent double clicks
//     if (loading) {
//       console.log('[applyCode] Already loading, skipping...');
//       return;
//     }
//     
//     // Determine if this is an edit based on whether we have applied code before
//     const isEdit = conversationContext.appliedCode.length > 0;
//     await applyGeneratedCode(code, isEdit);
//   };

  const renderMainContent = () => {
    if (activeTab === 'generation' && (generationProgress.isGenerating || generationProgress.files.length > 0)) {
      return (
        /* Generation Tab Content */
        <div className="absolute inset-0 flex overflow-hidden">
          {/* File Explorer - Hide during edits */}
          {!generationProgress.isEdit && (
            <div className="w-[250px] border-r border-gray-200 bg-white flex flex-col flex-shrink-0">
            <div className="p-4 bg-gray-100 text-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <BsFolderFill style={{ width: '16px', height: '16px' }} />
                <span className="text-sm font-medium">Explorer</span>
              </div>
            </div>
            
            {/* File Tree */}
            <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
              <div className="text-sm">
                {/* Root app folder */}
                <div 
                  className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                  onClick={() => toggleFolder('app')}
                >
                  {expandedFolders.has('app') ? (
                    <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                  ) : (
                    <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                  )}
                  {expandedFolders.has('app') ? (
                    <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                  ) : (
                    <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-blue-500" />
                  )}
                  <span className="font-medium text-gray-800">app</span>
                </div>
                
                {expandedFolders.has('app') && (
                  <div className="ml-6">
                    {/* Group files by directory */}
                    {(() => {
                      const fileTree: { [key: string]: Array<{ name: string; edited?: boolean }> } = {};
                      
                      // Create a map of edited files
                      // const editedFiles = new Set(
                      //   generationProgress.files
                      //     .filter(f => f.edited)
                      //     .map(f => f.path)
                      // );
                      
                      // Process all files from generation progress
                      generationProgress.files.forEach(file => {
                        const parts = file.path.split('/');
                        const dir = parts.length > 1 ? parts.slice(0, -1).join('/') : '';
                        const fileName = parts[parts.length - 1];
                        
                        if (!fileTree[dir]) fileTree[dir] = [];
                        fileTree[dir].push({
                          name: fileName,
                          edited: file.edited || false
                        });
                      });
                      
                      return Object.entries(fileTree).map(([dir, files]) => (
                        <div key={dir} className="mb-1">
                          {dir && (
                            <div 
                              className="flex items-center gap-2 py-0.5 px-3 hover:bg-gray-100 rounded cursor-pointer text-gray-700"
                              onClick={() => toggleFolder(dir)}
                            >
                              {expandedFolders.has(dir) ? (
                                <FiChevronDown style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                              ) : (
                                <FiChevronRight style={{ width: '16px', height: '16px' }} className="text-gray-600" />
                              )}
                              {expandedFolders.has(dir) ? (
                                <BsFolder2Open style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                              ) : (
                                <BsFolderFill style={{ width: '16px', height: '16px' }} className="text-yellow-600" />
                              )}
                              <span className="text-gray-700">{dir.split('/').pop()}</span>
                            </div>
                          )}
                          {(!dir || expandedFolders.has(dir)) && (
                            <div className={dir ? 'ml-8' : ''}>
                              {files.sort((a, b) => a.name.localeCompare(b.name)).map(fileInfo => {
                                const fullPath = dir ? `${dir}/${fileInfo.name}` : fileInfo.name;
                                const isSelected = selectedFile === fullPath;
                                
                                return (
                                  <div 
                                    key={fullPath} 
                                    className={`flex items-center gap-2 py-0.5 px-3 rounded cursor-pointer transition-all ${
                                      isSelected 
                                        ? 'bg-blue-500 text-white' 
                                        : 'text-gray-700 hover:bg-gray-100'
                                    }`}
                                    onClick={() => handleFileClick(fullPath)}
                                  >
                                    {getFileIcon(fileInfo.name)}
                                    <span className={`text-xs flex items-center gap-1 ${isSelected ? 'font-medium' : ''}`}>
                                      {fileInfo.name}
                                      {fileInfo.edited && (
                                        <span className={`text-[10px] px-1 rounded ${
                                          isSelected ? 'bg-blue-400' : 'bg-orange-500 text-white'
                                        }`}>✓</span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      ));
                    })()}
                  </div>
                )}
              </div>
            </div>
          </div>
          )}
          
          {/* Code Content */}
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Thinking Mode Display - Only show during active generation */}
            {generationProgress.isGenerating && (generationProgress.isThinking || generationProgress.thinkingText) && (
              <div className="px-6 pb-6">
                <div className="flex items-center gap-2 mb-2">
                  <div className="text-purple-600 font-medium flex items-center gap-2">
                    {generationProgress.isThinking ? (
                      <>
                        <div className="w-3 h-3 bg-purple-600 rounded-full animate-pulse" />
                        AI is thinking...
                      </>
                    ) : (
                      <>
                        <span className="text-purple-600">✓</span>
                        Thought for {generationProgress.thinkingDuration || 0} seconds
                      </>
                    )}
                  </div>
                </div>
                {generationProgress.thinkingText && (
                  <div className="bg-purple-950 border border-purple-700 rounded-lg p-4 max-h-48 overflow-y-auto scrollbar-hide">
                    <pre className="text-xs font-mono text-purple-300 whitespace-pre-wrap">
                      {generationProgress.thinkingText}
                    </pre>
                  </div>
                )}
              </div>
            )}
            
            {/* Live Code Display */}
            <div className="flex-1 rounded-lg p-6 flex flex-col min-h-0 overflow-hidden">
              <div className="flex-1 overflow-y-auto min-h-0 scrollbar-hide" ref={codeDisplayRef}>
                {/* Show selected file if one is selected */}
                {selectedFile ? (
                  <div className="animate-in fade-in slide-in-from-top-2 duration-300">
                    <div className="bg-black border border-gray-200 rounded-lg overflow-hidden shadow-sm">
                      <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {getFileIcon(selectedFile)}
                          <span className="font-mono text-sm">{selectedFile}</span>
                        </div>
                        <button
                          onClick={() => setSelectedFile(null)}
                          className="hover:bg-black/20 p-1 rounded transition-colors"
                        >
                          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="bg-gray-900 border border-gray-700 rounded">
                        <SyntaxHighlighter
                          language={(() => {
                            const ext = selectedFile.split('.').pop()?.toLowerCase();
                            if (ext === 'css') return 'css';
                            if (ext === 'json') return 'json';
                            if (ext === 'html') return 'html';
                            return 'jsx';
                          })()}
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                          }}
                          showLineNumbers={true}
                        >
                          {(() => {
                            // Find the file content from generated files
                            const file = generationProgress.files.find(f => f.path === selectedFile);
                            return file?.content || '// File content will appear here';
                          })()}
                        </SyntaxHighlighter>
                      </div>
                    </div>
                  </div>
                ) : /* If no files parsed yet, show loading or raw stream */
                generationProgress.files.length === 0 && !generationProgress.currentFile ? (
                  generationProgress.isThinking ? (
                    // Beautiful loading state while thinking
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center">
                        <div className="mb-8 relative">
                          <div className="w-48 h-48 mx-auto">
                            <div className="absolute inset-0 border-8 border-gray-800 rounded-full"></div>
                            <div className="absolute inset-0 border-8 border-green-500 rounded-full animate-spin border-t-transparent"></div>
                          </div>
                        </div>
                        <h3 className="text-xl font-medium text-white mb-2">Reading your request...</h3>
                        <p className="text-gray-400 text-sm">{generationProgress.status || 'Planning the clone...'}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                      <div className="px-4 py-2 bg-gradient-to-r from-orange-500 to-red-500 text-white flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-4 h-4 bg-white rounded-full animate-ping absolute" />
                            <div className="w-4 h-4 bg-white rounded-full relative" />
                          </div>
                          <span className="font-mono text-sm font-semibold">⚡ AI Streaming Live...</span>
                          <span className="text-xs opacity-80">{generationProgress.streamedCode.length} characters</span>
                        </div>
                      </div>
                      <div className="p-4 bg-gray-900 rounded relative">
                        <div className="absolute top-2 right-2 flex items-center gap-2 bg-black/50 px-3 py-1 rounded-full backdrop-blur-sm">
                          <span className="text-green-400 text-xs font-mono">● LIVE</span>
                        </div>
                        <SyntaxHighlighter
                          language="jsx"
                          style={vscDarkPlus}
                          customStyle={{
                            margin: 0,
                            padding: '1rem',
                            fontSize: '0.875rem',
                            background: 'transparent',
                          }}
                          showLineNumbers={true}
                        >
                          {generationProgress.streamedCode || 'Starting code generation...'}
                        </SyntaxHighlighter>
                        <div className="flex items-center gap-1 mt-2">
                          <span className="inline-block w-2 h-4 bg-orange-500 animate-pulse" />
                          <span className="text-gray-400 text-xs font-mono">Streaming...</span>
                        </div>
                      </div>
                    </div>
                  )
                ) : (
                  <div className="space-y-4">
                    {/* Show current file being generated */}
                    {generationProgress.currentFile && (
                      <div className="bg-black border-2 border-gray-400 rounded-lg overflow-hidden shadow-sm">
                        <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                            <span className="font-mono text-sm">{generationProgress.currentFile.path}</span>
                            <span className={`px-2 py-0.5 text-xs rounded ${
                              generationProgress.currentFile.type === 'css' ? 'bg-blue-600 text-white' :
                              generationProgress.currentFile.type === 'javascript' ? 'bg-yellow-600 text-white' :
                              generationProgress.currentFile.type === 'json' ? 'bg-green-600 text-white' :
                              'bg-gray-200 text-gray-700'
                            }`}>
                              {generationProgress.currentFile.type === 'javascript' ? 'JSX' : generationProgress.currentFile.type.toUpperCase()}
                            </span>
                          </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 rounded">
                          <SyntaxHighlighter
                            language={
                              generationProgress.currentFile.type === 'css' ? 'css' :
                              generationProgress.currentFile.type === 'json' ? 'json' :
                              generationProgress.currentFile.type === 'html' ? 'html' :
                              'jsx'
                            }
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.75rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={true}
                          >
                            {generationProgress.currentFile.content}
                          </SyntaxHighlighter>
                          <span className="inline-block w-3 h-4 bg-orange-400 ml-4 mb-4 animate-pulse" />
                        </div>
                      </div>
                    )}
                    
                    {/* Show completed files */}
                    {generationProgress.files.map((file, idx) => (
                      <div key={idx} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-green-500">✓</span>
                            <span className="font-mono text-sm">{file.path}</span>
                          </div>
                          <span className={`px-2 py-0.5 text-xs rounded ${
                            file.type === 'css' ? 'bg-blue-600 text-white' :
                            file.type === 'javascript' ? 'bg-yellow-600 text-white' :
                            file.type === 'json' ? 'bg-green-600 text-white' :
                            'bg-gray-200 text-gray-700'
                          }`}>
                            {file.type === 'javascript' ? 'JSX' : file.type.toUpperCase()}
                          </span>
                        </div>
                        <div className="bg-gray-900 border border-gray-700  max-h-48 overflow-y-auto scrollbar-hide">
                          <SyntaxHighlighter
                            language={
                              file.type === 'css' ? 'css' :
                              file.type === 'json' ? 'json' :
                              file.type === 'html' ? 'html' :
                              'jsx'
                            }
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.75rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={true}
                            wrapLongLines={true}
                          >
                            {file.content}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    ))}
                    
                    {/* Show remaining raw stream if there's content after the last file */}
                    {!generationProgress.currentFile && generationProgress.streamedCode.length > 0 && (
                      <div className="bg-black border border-gray-200 rounded-lg overflow-hidden">
                        <div className="px-4 py-2 bg-[#36322F] text-white flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-16 h-16 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
                            <span className="font-mono text-sm">Processing...</span>
                          </div>
                        </div>
                        <div className="bg-gray-900 border border-gray-700 rounded">
                          <SyntaxHighlighter
                            language="jsx"
                            style={vscDarkPlus}
                            customStyle={{
                              margin: 0,
                              padding: '1rem',
                              fontSize: '0.75rem',
                              background: 'transparent',
                            }}
                            showLineNumbers={false}
                          >
                            {(() => {
                              // Show only the tail of the stream after the last file
                              const lastFileEnd = generationProgress.files.length > 0 
                                ? generationProgress.streamedCode.lastIndexOf('</file>') + 7
                                : 0;
                              let remainingContent = generationProgress.streamedCode.slice(lastFileEnd).trim();
                              
                              // Remove explanation tags and content
                              remainingContent = remainingContent.replace(/<explanation>[\s\S]*?<\/explanation>/g, '').trim();

                              // If only whitespace or nothing left, show loading message
                              // Use "Loading sandbox..." instead of "Waiting for next file..." for better UX
                              return remainingContent || 'Building preview...';
                            })()}
                          </SyntaxHighlighter>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
            
            {/* Progress indicator */}
            {generationProgress.components.length > 0 && (
              <div className="mx-6 mb-6">
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-orange-500 to-orange-400 transition-all duration-300"
                    style={{
                      width: `${(generationProgress.currentComponent / Math.max(generationProgress.components.length, 1)) * 100}%`
                    }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      );
    } else if (activeTab === 'preview') {
      // Show loading state for initial generation or when starting a new generation with existing sandbox
      const isInitialGeneration = !sandboxData?.url && (urlScreenshot || isCapturingScreenshot || isPreparingDesign || loadingStage);
      const isNewGenerationWithSandbox = isStartingNewGeneration && sandboxData?.url;
      const shouldShowLoadingOverlay = (isInitialGeneration || isNewGenerationWithSandbox) && 
        (loading || generationProgress.isGenerating || isPreparingDesign || loadingStage || isCapturingScreenshot || isStartingNewGeneration);
      
      if (isInitialGeneration || isNewGenerationWithSandbox) {
        return (
          <div className="relative w-full h-full bg-gray-900">
            {/* Screenshot as background when available */}
            {urlScreenshot && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img 
                src={urlScreenshot} 
                alt="Website preview" 
                className="absolute inset-0 w-full h-full object-cover transition-opacity duration-700"
                style={{ 
                  opacity: isScreenshotLoaded ? 1 : 0,
                  willChange: 'opacity'
                }}
                onLoad={() => setIsScreenshotLoaded(true)}
                loading="eager"
              />
            )}
            
            {/* Loading overlay - only show when actively processing initial generation */}
            {shouldShowLoadingOverlay && (
              <div className="absolute inset-0 bg-black/70 flex flex-col items-center justify-center backdrop-blur-sm">
                {/* Loading animation with skeleton */}
                <div className="text-center max-w-md">
                  {/* Animated skeleton lines */}
                  <div className="mb-6 space-y-3">
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse" 
                         style={{ animationDuration: '1.5s', animationDelay: '0s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-4/5 mx-auto" 
                         style={{ animationDuration: '1.5s', animationDelay: '0.2s' }} />
                    <div className="h-2 bg-gradient-to-r from-transparent via-white/20 to-transparent rounded animate-pulse w-3/5 mx-auto" 
                         style={{ animationDuration: '1.5s', animationDelay: '0.4s' }} />
                  </div>
                  
                  {/* Status text */}
                  <p className="text-white text-lg font-medium">
                    {isCapturingScreenshot ? 'Reading the site...' :
                     isPreparingDesign ? 'Planning your clone...' :
                     generationProgress.isGenerating ? 'Generating code...' :
                     'Almost there...'}
                  </p>
                  
                  {/* Subtle progress hint */}
                  <p className="text-white/60 text-sm mt-2">
                    {isCapturingScreenshot ? 'Capturing what the site looks like' :
                     isPreparingDesign ? 'Figuring out the layout and structure' :
                     generationProgress.isGenerating ? 'Writing React components' :
                     'Setting things up...'}
                  </p>
                </div>
              </div>
            )}
          </div>
        );
      }
      
      // Show sandbox iframe - keep showing during edits, only hide during initial loading
      if (sandboxData?.url) {
        return (
          <div className="relative w-full h-full">
            {/* Loading skeleton — fades out as the iframe fades in */}
            <motion.div
              className="absolute inset-0 bg-gray-50 flex items-center justify-center z-[1]"
              initial={{ opacity: 1 }}
              animate={{ opacity: iframeRevealed ? 0 : 1 }}
              transition={{ duration: 0.8, ease: 'easeOut' }}
              style={{ pointerEvents: iframeRevealed ? 'none' : 'auto' }}
            >
              <div className="text-center">
                <div className="w-12 h-12 border-3 border-gray-200 border-t-orange-500 rounded-full animate-spin mx-auto mb-3" />
                <p className="text-sm text-gray-400">Loading preview…</p>
              </div>
            </motion.div>

            {/* Iframe — loads immediately, fades in over 1s once loaded */}
            <motion.iframe
              ref={iframeRef}
              src={sandboxData.url}
              className="w-full h-full border-none"
              title="MirrorSite AI Sandbox"
              allow="clipboard-write"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
              initial={{ opacity: 0 }}
              animate={{ opacity: iframeRevealed ? 1 : 0 }}
              transition={{ duration: 1, ease: 'easeOut' }}
              onLoad={() => setIframeRevealed(true)}
            />
            
            {/* Package installation overlay - shows when installing packages or applying code */}
            {codeApplicationState.stage && codeApplicationState.stage !== 'complete' && (
              <div className="absolute inset-0 bg-white/95 backdrop-blur-sm flex items-center justify-center z-10">
                <div className="text-center max-w-md">
                  <div className="mb-6">
                    {/* Animated icon based on stage */}
                    {codeApplicationState.stage === 'installing' ? (
                      <div className="w-16 h-16 mx-auto">
                        <svg className="w-full h-full animate-spin" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                      </div>
                    ) : null}
                  </div>
                  
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">
                    {codeApplicationState.stage === 'analyzing' && 'Reading your code...'}
                    {codeApplicationState.stage === 'installing' && 'Installing packages...'}
                    {codeApplicationState.stage === 'applying' && 'Applying changes...'}
                  </h3>
                  
                  {/* Package list during installation */}
                  {codeApplicationState.stage === 'installing' && codeApplicationState.packages && (
                    <div className="mb-4">
                      <div className="flex flex-wrap gap-2 justify-center">
                        {codeApplicationState.packages.map((pkg, index) => (
                          <span 
                            key={index}
                            className={`px-2 py-1 text-xs rounded-full transition-all ${
                              codeApplicationState.installedPackages?.includes(pkg)
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {pkg}
                            {codeApplicationState.installedPackages?.includes(pkg) && (
                              <span className="ml-1">✓</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  
                  {/* Files being generated */}
                  {codeApplicationState.stage === 'applying' && codeApplicationState.filesGenerated && (
                    <div className="text-sm text-gray-600">
                      Creating {codeApplicationState.filesGenerated.length} files...
                    </div>
                  )}
                  
                  <p className="text-sm text-gray-500 mt-2">
                    {codeApplicationState.stage === 'analyzing' && 'Reading generated code...'}
                    {codeApplicationState.stage === 'installing' && 'Installing dependencies — this takes a moment...'}
                    {codeApplicationState.stage === 'applying' && 'Writing files to your sandbox...'}
                  </p>
                </div>
              </div>
            )}
            
            {/* Show a subtle indicator when code is being edited/generated */}
            {generationProgress.isGenerating && generationProgress.isEdit && !codeApplicationState.stage && (
              <div className="absolute top-4 right-4 inline-flex items-center gap-2 px-3 py-1.5 bg-black/80 backdrop-blur-sm rounded-lg">
                <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
                <span className="text-white text-xs font-medium">Generating code...</span>
              </div>
            )}
            
            {/* Refresh button */}
            <button
              onClick={() => {
                if (iframeRef.current && sandboxData?.url) {
                  console.log('[Manual Refresh] Forcing iframe reload...');
                  const newSrc = `${sandboxData.url}?t=${Date.now()}&manual=true`;
                  iframeRef.current.src = newSrc;
                }
              }}
              className="absolute bottom-4 right-4 bg-white/90 hover:bg-white text-gray-700 p-2 rounded-lg shadow-lg transition-all duration-200 hover:scale-105"
              title="Refresh sandbox"
            >
              <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </button>
          </div>
        );
      }
      
      // Default state when no sandbox and no screenshot
      return (
        <div className="flex items-center justify-center h-full bg-gray-50 text-gray-600 text-lg">
          {screenshotError ? (
            <div className="text-center">
              <p className="mb-2">Couldn't capture a screenshot of that site.</p>
              <p className="text-sm text-gray-500">The clone can still proceed — or try a different URL.</p>
            </div>
          ) : sandboxData ? (
            <div className="text-gray-500">
              <div className="w-16 h-16 border-2 border-gray-300 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
              <p className="text-sm">Spinning up preview...</p>
            </div>
          ) : (
            <div className="text-gray-500 text-center">
              <p className="text-sm">Your first clone starts with a URL</p>
            </div>
          )}
        </div>
      );
    }
    return null;
  };

  const sendChatMessage = async () => {
    const message = aiChatInput.trim();
    if (!message) return;
    
    if (!aiEnabled) {
      addChatMessage('AI is disabled. Please enable it first.', 'system');
      return;
    }
    
    addChatMessage(message, 'user');
    setAiChatInput('');
    
    // Check for special commands
    const lowerMessage = message.toLowerCase().trim();
    if (lowerMessage === 'check packages' || lowerMessage === 'install packages' || lowerMessage === 'npm install') {
      if (!sandboxData) {
        // More helpful message - user might be trying to run this too early
        addChatMessage('The sandbox is still being set up. Please wait for the generation to complete, then try again.', 'system');
        return;
      }
      await checkAndInstallPackages();
      return;
    }
    
    // Start sandbox creation in parallel if needed
    let sandboxPromise: Promise<void> | null = null;
    let sandboxCreating = false;
    
    if (!sandboxData) {
      sandboxCreating = true;
      addChatMessage('Creating sandbox while I plan your app...', 'system');
      sandboxPromise = createSandbox(true).catch((error: any) => {
        addChatMessage('Sandbox could not start — this is usually temporary. Try again in a moment.', 'error');
        throw error;
      });
    }
    
    // Determine if this is an edit
    const isEdit = conversationContext.appliedCode.length > 0;
    
    try {
      // Generation tab is already active from scraping phase
      setGenerationProgress(prev => ({
        ...prev,  // Preserve all existing state
        isGenerating: true,
        status: 'Starting AI generation...',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: true,
        thinkingText: 'Analyzing your request...',
        thinkingDuration: undefined,
        currentFile: undefined,
        lastProcessedPosition: 0,
        // Add isEdit flag to generation progress
        isEdit: isEdit,
        // Keep existing files for edits - we'll mark edited ones differently
        files: prev.files
      }));
      
      // Backend now manages file state - no need to fetch from frontend
      console.log('[chat] Using backend file cache for context');
      
      const fullContext = {
        sandboxId: sandboxData?.sandboxId || (sandboxCreating ? 'pending' : null),
        structure: structureContent,
        recentMessages: chatMessages.slice(-20),
        conversationContext: conversationContext,
        currentCode: promptInput,
        sandboxUrl: sandboxData?.url,
        sandboxCreating: sandboxCreating
      };
      
      // Debug what we're sending
      console.log('[chat] Sending context to AI:');
      console.log('[chat] - sandboxId:', fullContext.sandboxId);
      console.log('[chat] - isEdit:', conversationContext.appliedCode.length > 0);
      
      const response = await fetch('/api/generate-ai-code-stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: message,
          model: aiModel,
          context: fullContext,
          isEdit: conversationContext.appliedCode.length > 0
        })
      });
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let generatedCode = '';
      let explanation = '';
      let buffer = ''; // Buffer for incomplete lines
      
      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          const chunk = decoder.decode(value, { stream: true });
          console.log('[chat] Received chunk:', chunk.length, 'bytes');
          buffer += chunk;
          const lines = buffer.split('\n');
          
          // Keep the last line in buffer if it's incomplete
          buffer = lines.pop() || '';
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                
                if (data.type === 'status') {
                  setGenerationProgress(prev => ({ ...prev, status: data.message }));
                } else if (data.type === 'thinking') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: true,
                    thinkingText: (prev.thinkingText || '') + data.text
                  }));
                } else if (data.type === 'thinking_complete') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    isThinking: false,
                    thinkingDuration: data.duration
                  }));
                } else if (data.type === 'conversation') {
                  // Add conversational text to chat only if it's not code
                  let text = data.text || '';
                  
                  // Remove package tags from the text
                  text = text.replace(/<package>[^<]*<\/package>/g, '');
                  text = text.replace(/<packages>[^<]*<\/packages>/g, '');
                  
                  // Filter out any XML tags and file content that slipped through
                  if (!text.includes('<file') && !text.includes('import React') && 
                      !text.includes('export default') && !text.includes('className=') &&
                      text.trim().length > 0) {
                    addChatMessage(text.trim(), 'ai');
                  }
                } else if (data.type === 'stream' && data.raw) {
                  setGenerationProgress(prev => {
                    const newStreamedCode = prev.streamedCode + data.text;
                    
                    // Tab is already switched after scraping
                    
                    const updatedState = { 
                      ...prev, 
                      streamedCode: newStreamedCode,
                      isStreaming: true,
                      isThinking: false,
                      status: 'Generating code...'
                    };
                    
                    // Process complete files from the accumulated stream
                    const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                    let match;
                    const processedFiles = new Set(prev.files.map(f => f.path));
                    
                    while ((match = fileRegex.exec(newStreamedCode)) !== null) {
                      const filePath = match[1];
                      const fileContent = match[2];
                      
                      // Only add if we haven't processed this file yet
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        // Check if file already exists
                        const existingFileIndex = updatedState.files.findIndex(f => f.path === filePath);
                        
                        if (existingFileIndex >= 0) {
                          // Update existing file and mark as edited
                          updatedState.files = [
                            ...updatedState.files.slice(0, existingFileIndex),
                            {
                              ...updatedState.files[existingFileIndex],
                              content: fileContent.trim(),
                              type: fileType,
                              completed: true,
                              edited: true
                            },
                            ...updatedState.files.slice(existingFileIndex + 1)
                          ];
                        } else {
                          // Add new file
                          updatedState.files = [...updatedState.files, {
                            path: filePath,
                            content: fileContent.trim(),
                            type: fileType,
                            completed: true,
                            edited: false
                          }];
                        }
                        
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Completed ${filePath}`;
                        }
                        processedFiles.add(filePath);
                      }
                    }
                    
                    // Check for current file being generated (incomplete file at the end)
                    const lastFileMatch = newStreamedCode.match(/<file path="([^"]+)">([^]*?)$/);
                    if (lastFileMatch && !lastFileMatch[0].includes('</file>')) {
                      const filePath = lastFileMatch[1];
                      const partialContent = lastFileMatch[2];
                      
                      if (!processedFiles.has(filePath)) {
                        const fileExt = filePath.split('.').pop() || '';
                        const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                        fileExt === 'css' ? 'css' :
                                        fileExt === 'json' ? 'json' :
                                        fileExt === 'html' ? 'html' : 'text';
                        
                        updatedState.currentFile = { 
                          path: filePath, 
                          content: partialContent, 
                          type: fileType 
                        };
                        // Only show file status if not in edit mode
                        if (!prev.isEdit) {
                          updatedState.status = `Generating ${filePath}`;
                        }
                      }
                    } else {
                      updatedState.currentFile = undefined;
                    }
                    
                    return updatedState;
                  });
                } else if (data.type === 'app') {
                  setGenerationProgress(prev => ({ 
                    ...prev, 
                    status: 'Generated App.jsx structure'
                  }));
                } else if (data.type === 'component') {
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${data.name}`,
                    components: [...prev.components, { 
                      name: data.name, 
                      path: data.path, 
                      completed: true 
                    }],
                    currentComponent: data.index
                  }));
                } else if (data.type === 'package') {
                  // Handle package installation from tool calls
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: data.message || `Installing ${data.name}`
                  }));
                } else if (data.type === 'complete') {
                  generatedCode = data.generatedCode;
                  explanation = data.explanation;
                  
                  // Save the last generated code
                  setConversationContext(prev => ({
                    ...prev,
                    lastGeneratedCode: generatedCode
                  }));
                  
                  // Clear thinking state when generation completes
                  setGenerationProgress(prev => ({
                    ...prev,
                    isThinking: false,
                    thinkingText: undefined,
                    thinkingDuration: undefined
                  }));
                  
                  // Store packages to install from tool calls
                  if (data.packagesToInstall && data.packagesToInstall.length > 0) {
                    console.log('[generate-code] Packages to install from tools:', data.packagesToInstall);
                    // Store packages globally for later installation
                    (window as any).pendingPackages = data.packagesToInstall;
                  }
                  
                  // Parse all files from the completed code if not already done
                  const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
                  const parsedFiles: Array<{path: string; content: string; type: string; completed: boolean}> = [];
                  let fileMatch;
                  
                  while ((fileMatch = fileRegex.exec(data.generatedCode)) !== null) {
                    const filePath = fileMatch[1];
                    const fileContent = fileMatch[2];
                    const fileExt = filePath.split('.').pop() || '';
                    const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                    fileExt === 'css' ? 'css' :
                                    fileExt === 'json' ? 'json' :
                                    fileExt === 'html' ? 'html' : 'text';
                    
                    parsedFiles.push({
                      path: filePath,
                      content: fileContent.trim(),
                      type: fileType,
                      completed: true
                    });
                  }
                  
                  setGenerationProgress(prev => ({
                    ...prev,
                    status: `Generated ${parsedFiles.length > 0 ? parsedFiles.length : prev.files.length} file${(parsedFiles.length > 0 ? parsedFiles.length : prev.files.length) !== 1 ? 's' : ''}!`,
                    isGenerating: false,
                    isStreaming: false,
                    isEdit: prev.isEdit,
                    // Keep the files that were already parsed during streaming
                    files: prev.files.length > 0 ? prev.files : parsedFiles
                  }));
                } else if (data.type === 'error') {
                  throw new Error(data.error || data.message || 'AI generation failed');
                }
              } catch (e) {
                if (e instanceof Error && e.message !== 'Unexpected end of JSON input') {
                  throw e;
                }
                console.error('Failed to parse SSE data:', e);
              }
            }
          }
        }
      }
      
      if (generatedCode) {
        // Parse files from generated code for metadata
        const fileRegex = /<file path="([^"]+)">([^]*?)<\/file>/g;
        const generatedFiles = [];
        let match;
        while ((match = fileRegex.exec(generatedCode)) !== null) {
          generatedFiles.push(match[1]);
        }
        
        // Show appropriate message based on edit mode
        if (isEdit && generatedFiles.length > 0) {
          // For edits, show which file(s) were edited
          const editedFileNames = generatedFiles.map(f => f.split('/').pop()).join(', ');
          addChatMessage(
            explanation || `Updated ${editedFileNames}`,
            'ai',
            {
              appliedFiles: [generatedFiles[0]] // Only show the first edited file
            }
          );
        } else {
          // For new generation, show all files
          addChatMessage(explanation || 'Code generated!', 'ai', {
            appliedFiles: generatedFiles
          });
        }
        
        setPromptInput(generatedCode);
        // Don't show the Generated Code panel by default
        // setLeftPanelVisible(true);
        
        // Wait for sandbox creation if it's still in progress
        let activeSandboxData = sandboxData;
        if (sandboxPromise) {
          addChatMessage('Waiting for sandbox to be ready...', 'system');
          try {
            const newSandboxData = await sandboxPromise;
            if (newSandboxData != null) {
              activeSandboxData = newSandboxData;
              // Also update the state for future use
              setSandboxData(newSandboxData);
            }
            // Remove the waiting message
            setChatMessages(prev => prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...'));
          } catch {
            addChatMessage('Sandbox could not start — cannot apply code. Try again in a moment.', 'error');
            return;
          }
        }
        
        if (activeSandboxData && generatedCode) {
          // For new sandbox creations (especially Vercel), add a delay to ensure Vite is ready
          if (sandboxCreating) {
            console.log('[startGeneration] New sandbox created, waiting for services to be ready...');
            await new Promise(resolve => setTimeout(resolve, 2000));
          }
          
          // Use isEdit flag that was determined at the start
          // Pass the sandbox data from the promise if it's different from the state
          await applyGeneratedCode(generatedCode, isEdit, activeSandboxData !== sandboxData ? activeSandboxData : undefined);
        }
      }
      
      // Show completion status briefly then switch to preview
      setGenerationProgress(prev => ({
        ...prev,
        isGenerating: false,
        isStreaming: false,
        status: 'Generation complete!',
        isEdit: prev.isEdit,
        // Clear thinking state on completion
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined
      }));
      
      setTimeout(() => {
        // Switch to preview but keep files for display
        setActiveTab('preview');
      }, 1000); // Reduced from 3000ms to 1000ms
    } catch (error: any) {
      setChatMessages(prev => prev.filter(msg => msg.content !== 'Thinking...'));
      addChatMessage(`Error: ${error.message}`, 'system');
      // Reset generation progress and switch back to preview on error
      setGenerationProgress({
        isGenerating: false,
        status: '',
        components: [],
        currentComponent: 0,
        streamedCode: '',
        isStreaming: false,
        isThinking: false,
        thinkingText: undefined,
        thinkingDuration: undefined,
        files: [],
        currentFile: undefined,
        lastProcessedPosition: 0
      });
      setActiveTab('preview');
    }
  };


  const downloadZip = async () => {
    if (!sandboxData) {
      addChatMessage('Please wait for the sandbox to be created before downloading.', 'system');
      return;
    }
    
    setLoading(true);
    log('Creating zip file...');
    addChatMessage('Creating ZIP file of your Vite app...', 'system');
    
    try {
      const response = await fetch('/api/create-zip', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      
      if (data.success) {
        log('Zip file created!');
        addChatMessage('ZIP file created! Download starting...', 'system');
        
        const link = document.createElement('a');
        link.href = data.dataUrl;
        link.download = data.fileName || 'e2b-project.zip';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        addChatMessage(
          'Your Vite app has been downloaded! To run it locally:\n' +
          '1. Unzip the file\n' +
          '2. Run: npm install\n' +
          '3. Run: npm run dev\n' +
          '4. Open http://localhost:5173',
          'system'
        );
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      log(`Failed to create zip: ${error.message}`, 'error');
      addChatMessage(`Failed to create ZIP: ${error.message}`, 'system');
    } finally {
      setLoading(false);
    }
  };

  const reapplyLastGeneration = async () => {
    if (!conversationContext.lastGeneratedCode) {
      addChatMessage('No previous generation to re-apply', 'system');
      return;
    }
    
    if (!sandboxData) {
      addChatMessage('Please create a sandbox first', 'system');
      return;
    }
    
    addChatMessage('Re-applying last generation...', 'system');
    const isEdit = conversationContext.appliedCode.length > 0;
    await applyGeneratedCode(conversationContext.lastGeneratedCode, isEdit);
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const handleFileClick = async (filePath: string) => {
    setSelectedFile(filePath);
    // TODO: Add file content fetching logic here
  };

  const getFileIcon = (fileName: string) => {
    const ext = fileName.split('.').pop()?.toLowerCase();
    
    if (ext === 'jsx' || ext === 'js') {
      return <SiJavascript style={{ width: '16px', height: '16px' }} className="text-yellow-500" />;
    } else if (ext === 'tsx' || ext === 'ts') {
      return <SiReact style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'css') {
      return <SiCss3 style={{ width: '16px', height: '16px' }} className="text-blue-500" />;
    } else if (ext === 'json') {
      return <SiJson style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    } else {
      return <FiFile style={{ width: '16px', height: '16px' }} className="text-gray-600" />;
    }
  };

//   const clearChatHistory = () => {
//     setChatMessages([{
//       content: 'Chat history cleared. How can I help you?',
//       type: 'system',
//       timestamp: new Date()
//     }]);
//   };
// 

//   const cloneWebsite = async () => {
//     let url = urlInput.trim();
//     if (!url) {
//       setUrlStatus(prev => [...prev, 'Please enter a URL']);
//       return;
//     }
//     
//     if (!url.match(/^https?:\/\//i)) {
//       url = 'https://' + url;
//     }
//     
//     setUrlStatus([`Using: ${url}`, 'Starting to scrape...']);
//     
//     setUrlOverlayVisible(false);
//     
//     // Remove protocol for cleaner display
//     const cleanUrl = url.replace(/^https?:\/\//i, '');
//     addChatMessage(`Starting to clone ${cleanUrl}...`, 'system');
//     
//     // Capture screenshot immediately and switch to preview tab
//     captureUrlScreenshot(url);
//     
//     try {
//       addChatMessage('Scraping website content...', 'system');
//       const scrapeResponse = await fetch('/api/scrape-url-enhanced', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ url })
//       });
//       
//       if (!scrapeResponse.ok) {
//         throw new Error(`Scraping failed: ${scrapeResponse.status}`);
//       }
//       
//       const scrapeData = await scrapeResponse.json();
//       
//       if (!scrapeData.success) {
//         throw new Error(scrapeData.error || 'Failed to scrape website');
//       }
//       
//       addChatMessage(`Scraped ${scrapeData.content.length} characters from ${url}`, 'system');
//       
//       // Clear preparing design state and switch to generation tab
//       setIsPreparingDesign(false);
//       setActiveTab('generation');
//       
//       setConversationContext(prev => ({
//         ...prev,
//         scrapedWebsites: [...prev.scrapedWebsites, {
//           url,
//           content: scrapeData,
//           timestamp: new Date()
//         }],
//         currentProject: `Clone of ${url}`
//       }));
//       
//       // Start sandbox creation in parallel with code generation
//       let sandboxPromise: Promise<any> | null = null;
//       if (!sandboxData) {
//         addChatMessage('Creating sandbox while generating your React app...', 'system');
//         sandboxPromise = createSandbox(true);
//       }
//       
//       addChatMessage('Analyzing and generating React recreation...', 'system');
//       
//       const recreatePrompt = `I scraped this website and want you to recreate it as a modern React application.
// 
// URL: ${url}
// 
// SCRAPED CONTENT:
// ${scrapeData.content}
// 
// ${homeContextInput ? `ADDITIONAL CONTEXT/REQUIREMENTS FROM USER:
// ${homeContextInput}
// 
// Please incorporate these requirements into the design and implementation.` : ''}
// 
// REQUIREMENTS:
// 1. Create a COMPLETE React application with App.jsx as the main component
// 2. App.jsx MUST import and render all other components
// 3. Recreate the main sections and layout from the scraped content
// 4. ${homeContextInput ? `Apply the user's context/theme: "${homeContextInput}"` : `Use a modern dark theme with excellent contrast:
//    - Background: #0a0a0a
//    - Text: #ffffff
//    - Links: #60a5fa
//    - Accent: #3b82f6`}
// 5. Make it fully responsive
// 6. Include hover effects and smooth transitions
// 7. Create separate components for major sections (Header, Hero, Features, etc.)
// 8. Use semantic HTML5 elements
// 
// IMPORTANT CONSTRAINTS:
// - DO NOT use React Router or any routing libraries
// - Use regular <a> tags with href="#section" for navigation, NOT Link or NavLink components
// - This is a single-page application, no routing needed
// - ALWAYS create src/App.jsx that imports ALL components
// - Each component should be in src/components/
// - Use Tailwind CSS for ALL styling (no custom CSS files)
// - Make sure the app actually renders visible content
// - Create ALL components that you reference in imports
// 
// IMAGE HANDLING RULES:
// - When the scraped content includes images, USE THE ORIGINAL IMAGE URLS whenever appropriate
// - Keep existing images from the scraped site (logos, product images, hero images, icons, etc.)
// - Use the actual image URLs provided in the scraped content, not placeholders
// - Only use placeholder images or generic services when no real images are available
// - For company logos and brand images, ALWAYS use the original URLs to maintain brand identity
// - If scraped data contains image URLs, include them in your img tags
// - Example: If you see "https://example.com/logo.png" in the scraped content, use that exact URL
// 
// Focus on the key sections and content, making it clean and modern while preserving visual assets.`;
//       
//       setGenerationProgress(prev => ({
//         isGenerating: true,
//         status: 'Initializing AI...',
//         components: [],
//         currentComponent: 0,
//         streamedCode: '',
//         isStreaming: true,
//         isThinking: false,
//         thinkingText: undefined,
//         thinkingDuration: undefined,
//         // Keep previous files until new ones are generated
//         files: prev.files || [],
//         currentFile: undefined,
//         lastProcessedPosition: 0
//       }));
//       
//       // Switch to generation tab when starting
//       setActiveTab('generation');
//       
//       const aiResponse = await fetch('/api/generate-ai-code-stream', {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({
//           prompt: recreatePrompt,
//           model: aiModel,
//           context: {
//             sandboxId: sandboxData?.id,
//             structure: structureContent,
//             conversationContext: conversationContext
//           }
//         })
//       });
//       
//       if (!aiResponse.ok) {
//         throw new Error(`AI generation failed: ${aiResponse.status}`);
//       }
//       
//       const reader = aiResponse.body?.getReader();
//       const decoder = new TextDecoder();
//       let generatedCode = '';
//       let explanation = '';
//       
//       if (reader) {
//         while (true) {
//           const { done, value } = await reader.read();
//           if (done) break;
//           
//           const chunk = decoder.decode(value);
//           const lines = chunk.split('\n');
//           
//           for (const line of lines) {
//             if (line.startsWith('data: ')) {
//               try {
//                 const data = JSON.parse(line.slice(6));
//                 
//                 if (data.type === 'status') {
//                   setGenerationProgress(prev => ({ ...prev, status: data.message }));
//                 } else if (data.type === 'thinking') {
//                   setGenerationProgress(prev => ({ 
//                     ...prev, 
//                     isThinking: true,
//                     thinkingText: (prev.thinkingText || '') + data.text
//                   }));
//                 } else if (data.type === 'thinking_complete') {
//                   setGenerationProgress(prev => ({ 
//                     ...prev, 
//                     isThinking: false,
//                     thinkingDuration: data.duration
//                   }));
//                 } else if (data.type === 'conversation') {
//                   // Add conversational text to chat only if it's not code
//                   let text = data.text || '';
//                   
//                   // Remove package tags from the text
//                   text = text.replace(/<package>[^<]*<\/package>/g, '');
//                   text = text.replace(/<packages>[^<]*<\/packages>/g, '');
//                   
//                   // Filter out any XML tags and file content that slipped through
//                   if (!text.includes('<file') && !text.includes('import React') && 
//                       !text.includes('export default') && !text.includes('className=') &&
//                       text.trim().length > 0) {
//                     addChatMessage(text.trim(), 'ai');
//                   }
//                 } else if (data.type === 'stream' && data.raw) {
//                   setGenerationProgress(prev => ({ 
//                     ...prev, 
//                     streamedCode: prev.streamedCode + data.text,
//                     lastProcessedPosition: prev.lastProcessedPosition || 0
//                   }));
//                 } else if (data.type === 'component') {
//                   setGenerationProgress(prev => ({
//                     ...prev,
//                     status: `Generated ${data.name}`,
//                     components: [...prev.components, { 
//                       name: data.name,
//                       path: data.path,
//                       completed: true
//                     }],
//                     currentComponent: prev.currentComponent + 1
//                   }));
//                 } else if (data.type === 'complete') {
//                   generatedCode = data.generatedCode;
//                   explanation = data.explanation;
//                   
//                   // Save the last generated code
//                   setConversationContext(prev => ({
//                     ...prev,
//                     lastGeneratedCode: generatedCode
//                   }));
//                 }
//               } catch (e) {
//                 console.error('Error parsing streaming data:', e);
//               }
//             }
//           }
//         }
//       }
//       
//       setGenerationProgress(prev => ({
//         ...prev,
//         isGenerating: false,
//         isStreaming: false,
//         status: 'Generation complete!',
//         isEdit: prev.isEdit
//       }));
//       
//       if (generatedCode) {
//         addChatMessage('AI recreation generated!', 'system');
//         
//         // Add the explanation to chat if available
//         if (explanation && explanation.trim()) {
//           addChatMessage(explanation, 'ai');
//         }
//         
//         setPromptInput(generatedCode);
//         // Don't show the Generated Code panel by default
//         // setLeftPanelVisible(true);
//         
//         // Wait for sandbox creation if it's still in progress
//         let activeSandboxData = sandboxData;
//         if (sandboxPromise) {
//           addChatMessage('Waiting for sandbox to be ready...', 'system');
//           try {
//             const newSandboxData = await sandboxPromise;
//             if (newSandboxData) {
//               activeSandboxData = newSandboxData;
//             }
//             // Remove the waiting message
//             setChatMessages(prev => prev.filter(msg => msg.content !== 'Waiting for sandbox to be ready...'));
//           } catch (error: any) {
//             addChatMessage('Sandbox could not start — cannot apply code. Try again in a moment.', 'error');
//             throw error;
//           }
//         }
//         
//         // Only apply code if we have sandbox data
//         if (activeSandboxData) {
//           // First application for cloned site should not be in edit mode
//           await applyGeneratedCode(generatedCode, false);
//         }
//         
//         addChatMessage(
//           `Successfully recreated ${url} as a modern React app${homeContextInput ? ` with your requested context: "${homeContextInput}"` : ''}! The scraped content is now in my context, so you can ask me to modify specific sections or add features based on the original site.`, 
//           'ai',
//           {
//             scrapedUrl: url,
//             scrapedContent: scrapeData,
//             generatedCode: generatedCode
//           }
//         );
//         
//         setUrlInput('');
//         setUrlStatus([]);
//         setHomeContextInput('');
//         
//         // Clear generation progress and all screenshot/design states
//         setGenerationProgress(prev => ({
//           ...prev,
//           isGenerating: false,
//           isStreaming: false,
//           status: 'Generation complete!'
//         }));
//         
//         // Clear screenshot and preparing design states to prevent them from showing on next run
//         setUrlScreenshot(null);
//         setIsPreparingDesign(false);
//         setTargetUrl('');
//         setScreenshotError(null);
//         setLoadingStage(null); // Clear loading stage
//         setShowLoadingBackground(false); // Clear loading background
//         
//         setTimeout(() => {
//           // Switch back to preview tab but keep files
//           setActiveTab('preview');
//         }, 1000); // Show completion briefly then switch
//       } else {
//         throw new Error('Failed to generate recreation');
//       }
//       
//     } catch (error: any) {
//       addChatMessage(`Failed to clone website: ${error.message}`, 'system');
//       setUrlStatus([]);
//       setIsPreparingDesign(false);
//       // Clear all states on error
//       setUrlScreenshot(null);
//       setTargetUrl('');
//       setScreenshotError(null);
//       setLoadingStage(null);
//       setGenerationProgress(prev => ({
//         ...prev,
//         isGenerating: false,
//         isStreaming: false,
//         status: '',
//         // Keep files to display in sidebar
//         files: prev.files
//       }));
//       setActiveTab('preview');
//     }
//   };

  const captureUrlScreenshot = async (url: string) => {
    setIsCapturingScreenshot(true);
    setScreenshotError(null);
    try {
      const response = await fetch('/api/scrape-screenshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
      });
      
      const data = await response.json();
      if (data.success && data.screenshot) {
        setIsScreenshotLoaded(false); // Reset loaded state for new screenshot
        setUrlScreenshot(data.screenshot);
        // Set preparing design state
        setIsPreparingDesign(true);
        // Store the clean URL for display
        const cleanUrl = url.replace(/^https?:\/\//i, '');
        setTargetUrl(cleanUrl);
        // Switch to preview tab to show the screenshot
        if (activeTab !== 'preview') {
          setActiveTab('preview');
        }
      } else {
        setScreenshotError(data.error || 'Failed to capture screenshot');
      }
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      setScreenshotError('Network error while capturing screenshot');
    } finally {
      setIsCapturingScreenshot(false);
    }
  };

  const handleHomeScreenSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await startGeneration();
  };

  const startGeneration = async () => {
    const target = homeUrlInput.trim();
    if (!target || pipelineStartedRef.current) return;

    const storedMode = sessionStorage.getItem('brandExtensionMode') === 'true' ? 'brand' : 'clone';
    const inputs: PipelineInputs = {
      ...pipelineInputsRef.current,
      style: pipelineInputsRef.current.style || selectedStyle || undefined,
      model: pipelineInputsRef.current.model || aiModel || undefined,
      instructions: pipelineInputsRef.current.instructions || homeContextInput || undefined,
      mode: pipelineInputsRef.current.mode || storedMode,
      brandPrompt: pipelineInputsRef.current.brandPrompt || sessionStorage.getItem('brandExtensionPrompt') || undefined,
    };
    pipelineInputsRef.current = inputs;

    setHomeScreenFading(true);
    setShowHomeScreen(false);
    setActiveTab('preview');
    setLoading(true);
    setIsStartingNewGeneration(true);
    setLoadingStage('gathering');
    setShowLoadingBackground(true);
    setUrlInput(target);
    setUrlOverlayVisible(false);
    setChatMessages([]);
    addChatMessage(
      inputs.mode === 'brand' ? 'Analyzing brand guidelines...' : `Starting five-phase clone pipeline for ${target}...`,
      'system',
    );
    console.log('[Phase: pipeline] Fresh clone requested from main generation entry', {
      targetUrl: target,
      mode: inputs.mode,
      model: inputs.model || 'default',
    });

    let screenshotUrl = target;
    if (!/^https?:\/\//i.test(screenshotUrl)) screenshotUrl = 'https://' + screenshotUrl;
    void captureUrlScreenshot(screenshotUrl);

    sessionStorage.removeItem('brandExtensionMode');
    sessionStorage.removeItem('brandExtensionPrompt');
    sessionStorage.removeItem('siteMarkdown');
    sessionStorage.removeItem('autoStart');

    window.setTimeout(() => setIsStartingNewGeneration(false), 1000);
    runGenerationPipeline(target, { inputs });
  };
  return (
    <HeaderProvider>
      {/* Resume / Restart prompt (Req 6.4, 18.3) */}
      {resumePrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm" data-resume-prompt>
          <div className="mx-4 w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h3 className="text-lg font-semibold text-gray-900">
              Resume previous generation?
            </h3>
            <p className="mt-2 text-sm text-gray-600">
              A previous generation was interrupted during the{' '}
              <span className="font-medium text-gray-900">
                {resumePrompt.lastSuccessfulPhase ?? 'unknown'}
              </span>{' '}
              phase. Resume to continue from where it left off, or restart from
              scratch.
            </p>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => {
                  if (resumePrompt.sandboxUrl) {
                    setSandboxData((prev) =>
                      prev
                        ? { ...prev, url: resumePrompt.sandboxUrl as string }
                        : { url: resumePrompt.sandboxUrl as string, sandboxId: resumePrompt.sandboxId ?? 'resume-sandbox', createdAt: new Date(), files: {} },
                    );
                  }
                  if (resumePrompt.sandboxId) {
                    setPipeline((prev) => ({ ...prev, active: true }));
                  }
                  runGenerationPipeline(homeUrlInput || sessionStorage.getItem('targetUrl') || '', {
                    resume: true,
                  });
                }}
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-700"
              >
                Resume
              </button>
              <button
                type="button"
                onClick={() => setResumePrompt(null)}
                className="rounded-lg bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200"
              >
                Restart
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Low Balance Modal */}
      <LowBalanceModal
        isOpen={showLowBalanceModal}
        onClose={() => {
          setShowLowBalanceModal(false);
          // Redirect back to builder page
          router.push('/builder');
        }}
        currentBalance={lowBalanceData.currentBalance}
        estimatedTokens={lowBalanceData.estimatedTokens}
        targetUrl={lowBalanceData.targetUrl}
      />
      
      <div className="font-sans bg-background text-foreground h-screen flex flex-col">
      <div className="bg-white py-[15px] py-[8px] border-b border-border-faint flex items-center justify-between shadow-sm">
        <HeaderBrandKit />
        <div className="flex items-center gap-2">
          {/* Model Selector - Left side */}
          <select
            value={aiModel}
            onChange={(e) => {
              const newModel = e.target.value;
              setAiModel(newModel);
              const params = new URLSearchParams(searchParams);
              params.set('model', newModel);
              if (sandboxData?.sandboxId) {
                params.set('sandbox', sandboxData.sandboxId);
              }
              router.push(`/generation?${params.toString()}`);
            }}
            className="px-3 py-1.5 text-sm text-gray-900 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:border-gray-300 transition-colors"
          >
            {userModels.map(model => (
              <option key={model} value={model}>
                {appConfig.ai.modelDisplayNames?.[model] || model}
              </option>
            ))}
          </select>
          
          {/* Manage Models Link */}
          <Link 
            href="/models" 
            className="text-xs text-blue-600 hover:text-blue-700 font-medium whitespace-nowrap px-2"
          >
            Manage ({userModels.length}/3)
          </Link>
          
          <button 
            onClick={() => createSandbox()}
            className="p-8 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100"
            title="Create new sandbox"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </button>
          <button 
            onClick={reapplyLastGeneration}
            className="p-8 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Re-apply last generation"
            disabled={!conversationContext.lastGeneratedCode || !sandboxData}
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button 
            onClick={downloadZip}
            disabled={!sandboxData}
            className="p-8 rounded-lg transition-colors bg-gray-50 border border-gray-200 text-gray-700 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Download your Vite app as ZIP"
          >
            <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </button>
          <UserMenu />

        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Center Panel - AI Chat (1/3 of remaining width) */}
        <div className="flex-1 max-w-[400px] flex flex-col border-r border-border bg-background">
          {/* Sidebar Input Component */}
          {!hasInitialSubmission ? (
            <div className="p-4 border-b border-border">
              <SidebarInput
                onSubmit={(url, style, model, instructions) => {
                  // Mark that we've had an initial submission
                  setHasInitialSubmission(true);
                  
                  // Store the configuration in sessionStorage (same as home page)
                  sessionStorage.setItem('targetUrl', url);
                  sessionStorage.setItem('selectedStyle', style);
                  sessionStorage.setItem('selectedModel', model);
                  if (instructions) {
                    sessionStorage.setItem('additionalInstructions', instructions);
                  }
                  sessionStorage.setItem('autoStart', 'true');
                  
                  // Start generation using the existing logic
                  setHomeUrlInput(url);
                  setHomeContextInput(instructions || '');
                  // Use the progressive pipeline for the initial generation
                  // (Req 18.3) — falls back to the legacy flow on error.
                  runGenerationPipeline(url);
                }}
                disabled={loading || generationProgress.isGenerating}
              />
            </div>
          ) : null}

          {/* Progressive pipeline progress panel (Req 18.3) */}
          {pipeline.active && (
            <div className="p-4 border-b border-border">
              <ProgressUI
                currentPhase={pipeline.currentPhase}
                sectionStatuses={pipeline.sectionStatuses}
                overallPercent={pipeline.overallPercent}
                executionLog={pipeline.executionLog}
                tokenUsageByPhase={pipeline.tokenUsageByPhase}
                errors={pipeline.errors}
                startedAt={pipeline.startedAt}
              />
            </div>
          )}

          {conversationContext.scrapedWebsites.length > 0 && (
            <div className="p-4 bg-card border-b border-gray-200">
              <div className="flex flex-col gap-4">
                {conversationContext.scrapedWebsites.map((site, idx) => {
                  // Extract favicon and site info from the scraped data
                  const metadata = site.content?.metadata || {};
                  const sourceURL = metadata.sourceURL || site.url;
                  const favicon = metadata.favicon || `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
                  const siteName = metadata.ogSiteName || metadata.title || new URL(sourceURL).hostname;
                  const screenshot = site.content?.screenshot || sessionStorage.getItem('websiteScreenshot');
                  
                  return (
                    <div key={idx} className="flex flex-col gap-3">
                      {/* Site info with favicon */}
                      <div className="flex items-center gap-4 text-sm">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img 
                          src={favicon} 
                          alt={siteName}
                          className="w-16 h-16 rounded"
                          onError={(e) => {
                            e.currentTarget.src = `https://www.google.com/s2/favicons?domain=${new URL(sourceURL).hostname}&sz=128`;
                          }}
                        />
                        <a 
                          href={sourceURL} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-black hover:text-gray-700 truncate max-w-[250px] font-medium"
                          title={sourceURL}
                        >
                          {siteName}
                        </a>
                      </div>
                      
                      {/* Pinned screenshot */}
                      {screenshot && (
                        <div className="w-full">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-gray-600">Screenshot Preview</span>
                            <button
                              onClick={() => setScreenshotCollapsed(!screenshotCollapsed)}
                              className="text-gray-500 hover:text-gray-700 transition-colors p-1"
                              aria-label={screenshotCollapsed ? 'Expand screenshot' : 'Collapse screenshot'}
                            >
                              <svg
                                width="16"
                                height="16"
                                viewBox="0 0 16 16"
                                fill="none"
                                xmlns="http://www.w3.org/2000/svg"
                                className={`transition-transform duration-300 ${screenshotCollapsed ? 'rotate-180' : ''}`}
                              >
                                <path d="M4 6L8 10L12 6" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                              </svg>
                            </button>
                          </div>
                          <div
                            className="w-full rounded-lg overflow-hidden border border-gray-200 transition-all duration-300"
                            style={{
                              opacity: screenshotCollapsed ? 0 : 1,
                              transform: screenshotCollapsed ? 'translateY(-20px)' : 'translateY(0)',
                              pointerEvents: screenshotCollapsed ? 'none' : 'auto',
                              maxHeight: screenshotCollapsed ? '0' : '200px'
                            }}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={screenshot}
                              alt={`${siteName} preview`}
                              className="w-full h-auto object-cover"
                              style={{ maxHeight: '200px' }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <div
            className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 scrollbar-hide"
            ref={chatMessagesRef}>
            {chatMessages.map((msg, idx) => {
              // Check if this message is from a successful generation
              const isGenerationComplete = msg.content.includes('Successfully recreated') || 
                                         msg.content.includes('AI recreation generated!') ||
                                         msg.content.includes('Code generated!');
              
              // Get the files from metadata if this is a completion message
              // const completedFiles = msg.metadata?.appliedFiles || [];
              
              return (
                <div key={idx} className="block">
                  <div className={`flex ${msg.type === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className="block">
                      <div className={`block rounded-[10px] px-14 py-8 ${
                        msg.type === 'user' ? 'bg-[#36322F] text-white ml-auto max-w-[80%]' :
                        msg.type === 'ai' ? 'bg-gray-100 text-gray-900 mr-auto max-w-[80%]' :
                        msg.type === 'system' ? 'bg-[#36322F] text-white text-sm' :
                        msg.type === 'command' ? 'bg-[#36322F] text-white font-mono text-sm' :
                        msg.type === 'error' ? 'bg-red-900 text-red-100 text-sm border border-red-700' :
                        'bg-[#36322F] text-white text-sm'
                      }`}>
                    {msg.type === 'command' ? (
                      <div className="flex items-start gap-2">
                        <span className={`text-xs ${
                          msg.metadata?.commandType === 'input' ? 'text-blue-400' :
                          msg.metadata?.commandType === 'error' ? 'text-red-400' :
                          msg.metadata?.commandType === 'success' ? 'text-green-400' :
                          'text-gray-400'
                        }`}>
                          {msg.metadata?.commandType === 'input' ? '$' : '>'}
                        </span>
                        <span className="flex-1 whitespace-pre-wrap text-white">{msg.content}</span>
                      </div>
                    ) : msg.type === 'error' ? (
                      <div className="flex items-start gap-3">
                        <div className="flex-shrink-0">
                          <div className="w-8 h-8 bg-red-800 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-red-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold mb-1">Build Errors Detected</div>
                          <div className="whitespace-pre-wrap text-sm">{msg.content}</div>
                          <div className="mt-2 text-xs opacity-70">Press 'F' or click the Fix button above to resolve</div>
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm">{msg.content}</span>
                    )}
                      </div>
                  
                      {/* Show branding data if this is a brand extraction message */}
                      {msg.metadata?.brandingData && (
                        <div className="mt-3 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 rounded-xl overflow-hidden max-w-[500px] shadow-sm">
                          <div className="bg-[#36322F] px-16 py-12">
                            <div className="flex items-center gap-8">
                              <Image
                                src={`https://www.google.com/s2/favicons?domain=${msg.metadata.sourceUrl}&sz=32`}
                                alt=""
                                width={64}
                                height={64}
                                className="w-16 h-16"
                              />
                              <div className="text-sm font-semibold text-white">
                                Brand Guidelines
                              </div>
                            </div>
                          </div>

                          <div className="p-16">
                            {/* Color Scheme Mode */}
                            {msg.metadata.brandingData.colorScheme && (
                              <div className="mb-16">
                                <div className="text-sm">
                                  <span className="text-gray-600 font-medium">Mode:</span>{' '}
                                  <span className="font-semibold text-gray-900 capitalize">{msg.metadata.brandingData.colorScheme}</span>
                                </div>
                              </div>
                            )}

                            {/* Colors */}
                            {msg.metadata.brandingData.colors && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Colors</div>
                                <div className="flex flex-wrap gap-12">
                                  {msg.metadata.brandingData.colors.primary && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.primary }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Primary</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.primary}</div>
                                      </div>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.colors.accent && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.accent }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Accent</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.accent}</div>
                                      </div>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.colors.background && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.background }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Background</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.background}</div>
                                      </div>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.colors.textPrimary && (
                                    <div className="flex items-center gap-8">
                                      <div className="w-32 h-32 rounded border border-gray-300" style={{ backgroundColor: msg.metadata.brandingData.colors.textPrimary }} />
                                      <div className="text-sm">
                                        <div className="font-semibold text-gray-900">Text</div>
                                        <div className="text-gray-600 font-mono text-xs">{msg.metadata.brandingData.colors.textPrimary}</div>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Typography */}
                            {msg.metadata.brandingData.typography && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Typography</div>
                                <div className="grid grid-cols-2 gap-12 text-sm">
                                  {msg.metadata.brandingData.typography.fontFamilies?.primary && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Primary:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontFamilies.primary}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontFamilies?.heading && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Heading:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontFamilies.heading}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontSizes?.h1 && (
                                    <div>
                                      <span className="text-gray-600 font-medium">H1 Size:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.h1}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontSizes?.h2 && (
                                    <div>
                                      <span className="text-gray-600 font-medium">H2 Size:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.h2}</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.typography.fontSizes?.body && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Body Size:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.typography.fontSizes.body}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Spacing */}
                            {msg.metadata.brandingData.spacing && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Spacing</div>
                                <div className="flex flex-wrap gap-16 text-sm">
                                  {msg.metadata.brandingData.spacing.baseUnit && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Base Unit:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.spacing.baseUnit}px</span>
                                    </div>
                                  )}
                                  {msg.metadata.brandingData.spacing.borderRadius && (
                                    <div>
                                      <span className="text-gray-600 font-medium">Border Radius:</span>{' '}
                                      <span className="font-semibold text-gray-900">{msg.metadata.brandingData.spacing.borderRadius}</span>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Button Styles */}
                            {msg.metadata.brandingData.components?.buttonPrimary && (
                              <div className="mb-16">
                                <div className="text-sm font-semibold text-gray-900 mb-8">Button Styles</div>
                                <div className="flex flex-wrap gap-12">
                                  <div>
                                    <div className="text-xs text-gray-600 mb-6 font-medium">Primary Button</div>
                                    <button
                                      className="px-16 py-8 text-sm font-medium"
                                      style={{
                                        backgroundColor: msg.metadata.brandingData.components.buttonPrimary.background,
                                        color: msg.metadata.brandingData.components.buttonPrimary.textColor,
                                        borderRadius: msg.metadata.brandingData.components.buttonPrimary.borderRadius,
                                        boxShadow: msg.metadata.brandingData.components.buttonPrimary.shadow
                                      }}
                                    >
                                      Sample Button
                                    </button>
                                  </div>
                                  {msg.metadata.brandingData.components?.buttonSecondary && (
                                    <div>
                                      <div className="text-xs text-gray-600 mb-6 font-medium">Secondary Button</div>
                                      <button
                                        className="px-16 py-8 text-sm font-medium"
                                        style={{
                                          backgroundColor: msg.metadata.brandingData.components.buttonSecondary.background,
                                          color: msg.metadata.brandingData.components.buttonSecondary.textColor,
                                          borderRadius: msg.metadata.brandingData.components.buttonSecondary.borderRadius,
                                          boxShadow: msg.metadata.brandingData.components.buttonSecondary.shadow
                                        }}
                                      >
                                        Sample Button
                                      </button>
                                    </div>
                                  )}
                                </div>
                              </div>
                            )}

                            {/* Personality */}
                            {msg.metadata.brandingData.personality && (
                              <div className="text-sm">
                                <span className="text-gray-600 font-medium">Personality:</span>{' '}
                                <span className="font-semibold text-gray-900 capitalize">
                                  {msg.metadata.brandingData.personality.tone} tone, {msg.metadata.brandingData.personality.energy} energy
                                </span>
                              </div>
                            )}

                            {/* Target Audience */}
                            {msg.metadata.brandingData.personality?.targetAudience && (
                              <div className="text-sm mt-8">
                                <span className="text-gray-600 font-medium">Target:</span>{' '}
                                <span className="text-gray-900">{msg.metadata.brandingData.personality.targetAudience}</span>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Show applied files if this is an apply success message */}
                      {msg.metadata?.appliedFiles && msg.metadata.appliedFiles.length > 0 && (
                    <div className="mt-3 inline-block bg-gray-100 rounded-[10px] p-5">
                      <div className="text-sm font-medium mb-3 text-gray-700">
                        {msg.content.includes('Applied') ? 'Files Updated:' : 'Generated Files:'}
                      </div>
                      <div className="flex flex-wrap items-start gap-2">
                        {msg.metadata.appliedFiles.map((filePath, fileIdx) => {
                          const fileName = filePath.split('/').pop() || filePath;
                          const fileExt = fileName.split('.').pop() || '';
                          const fileType = fileExt === 'jsx' || fileExt === 'js' ? 'javascript' :
                                          fileExt === 'css' ? 'css' :
                                          fileExt === 'json' ? 'json' : 'text';

                          return (
                            <div
                              key={`applied-${fileIdx}`}
                              className="inline-flex items-center gap-1.5 px-6 py-1.5 bg-[#36322F] text-white rounded-[10px] text-sm animate-fade-in-up"
                              style={{ animationDelay: `${fileIdx * 30}ms` }}
                            >
                              <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                                fileType === 'css' ? 'bg-blue-400' :
                                fileType === 'javascript' ? 'bg-yellow-400' :
                                fileType === 'json' ? 'bg-green-400' :
                                'bg-gray-400'
                              }`} />
                              {fileName}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                  
                      {/* Show generated files for completion messages - but only if no appliedFiles already shown */}
                      {isGenerationComplete && generationProgress.files.length > 0 && idx === chatMessages.length - 1 && !msg.metadata?.appliedFiles && !chatMessages.some(m => m.metadata?.appliedFiles) && (
                    <div className="mt-2 inline-block bg-gray-100 rounded-[10px] p-3">
                      <div className="text-xs font-medium mb-1 text-gray-700">Generated Files:</div>
                      <div className="flex flex-wrap items-start gap-1">
                        {generationProgress.files.map((file, fileIdx) => (
                          <div
                            key={`complete-${fileIdx}`}
                            className="inline-flex items-center gap-1.5 px-6 py-1.5 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                            style={{ animationDelay: `${fileIdx * 30}ms` }}
                          >
                            <span className={`inline-block w-1.5 h-1.5 rounded-full ${
                              file.type === 'css' ? 'bg-blue-400' :
                              file.type === 'javascript' ? 'bg-yellow-400' :
                              file.type === 'json' ? 'bg-green-400' :
                              'bg-gray-400'
                            }`} />
                            {file.path.split('/').pop()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                    </div>
                    </div>
                  </div>
              );
            })}
            
            {/* Code application progress */}
            {codeApplicationState.stage && (
              <CodeApplicationProgress state={codeApplicationState} />
            )}
            
            {/* File generation progress - inline display (during generation) */}
            {generationProgress.isGenerating && (
              <div className="inline-block bg-gray-100 rounded-lg p-3">
                <div className="text-sm font-medium mb-2 text-gray-700">
                  {generationProgress.status}
                </div>
                <div className="flex flex-wrap items-start gap-1">
                  {/* Show completed files */}
                  {generationProgress.files.map((file, idx) => (
                    <div
                      key={`file-${idx}`}
                      className="inline-flex items-center gap-1.5 px-6 py-1.5 bg-[#36322F] text-white rounded-[10px] text-xs animate-fade-in-up"
                      style={{ animationDelay: `${idx * 30}ms` }}
                    >
                      <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                      {file.path.split('/').pop()}
                    </div>
                  ))}
                  
                  {/* Show current file being generated */}
                  {generationProgress.currentFile && (
                    <div className="flex items-center gap-1 px-2 py-1 bg-[#36322F]/70 text-white rounded-[10px] text-sm animate-pulse"
                      style={{ animationDelay: `${generationProgress.files.length * 30}ms` }}>
                      <div className="w-16 h-16 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      {generationProgress.currentFile.path.split('/').pop()}
                    </div>
                  )}
                </div>
                
                {/* Live streaming response display */}
                {generationProgress.streamedCode && (
                  <motion.div 
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.3 }}
                    className="mt-3 border-t border-gray-300 pt-3"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex items-center gap-1">
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-gray-600">AI Response Stream</span>
                      </div>
                      <div className="flex-1 h-px bg-gradient-to-r from-gray-300 to-transparent" />
                    </div>
                    <div className="bg-gray-900 border border-gray-700 rounded max-h-128 overflow-y-auto scrollbar-hide">
                      <SyntaxHighlighter
                        language="jsx"
                        style={vscDarkPlus}
                        customStyle={{
                          margin: 0,
                          padding: '0.75rem',
                          fontSize: '11px',
                          lineHeight: '1.5',
                          background: 'transparent',
                          maxHeight: '8rem',
                          overflow: 'hidden'
                        }}
                      >
                        {(() => {
                          const lastContent = generationProgress.streamedCode.slice(-1000);
                          // Show the last part of the stream, starting from a complete tag if possible
                          const startIndex = lastContent.indexOf('<');
                          return startIndex !== -1 ? lastContent.slice(startIndex) : lastContent;
                        })()}
                      </SyntaxHighlighter>
                      <span className="inline-block w-3 h-4 bg-orange-400 ml-3 mb-3 animate-pulse" />
                    </div>
                  </motion.div>
                )}
              </div>
            )}
          </div>

          <div className="p-4 border-t border-border bg-background-base">
            <HeroInput
              value={aiChatInput}
              onChange={setAiChatInput}
              onSubmit={sendChatMessage}
              placeholder="Describe what you want to build..."
              showSearchFeatures={false}
            />
          </div>
        </div>

        {/* Right Panel - Preview or Generation (2/3 of remaining width) */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="px-3 pt-4 pb-4 bg-white border-b border-gray-200 flex justify-between items-center">
            <div className="flex items-center gap-2">
              {/* Toggle-style Code/View switcher */}
              <div className="inline-flex bg-gray-100 border border-gray-200 rounded-md p-0.5">
                <button
                  onClick={() => setActiveTab('generation')}
                  className={`px-3 py-1 rounded transition-all text-xs font-medium ${
                    activeTab === 'generation' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                    </svg>
                    <span>Code</span>
                  </div>
                </button>
                <button
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1 rounded transition-all text-xs font-medium ${
                    activeTab === 'preview' 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'bg-transparent text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                    <span>View</span>
                  </div>
                </button>
              </div>
            </div>
            <div className="flex gap-2 items-center">
              {/* Files generated count */}
              {activeTab === 'generation' && !generationProgress.isEdit && generationProgress.files.length > 0 && (
                <div className="text-gray-500 text-xs font-medium">
                  {generationProgress.files.length} files generated
                </div>
              )}
              
              {/* Live Code Generation Status */}
              {activeTab === 'generation' && generationProgress.isGenerating && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
                  {generationProgress.isEdit ? 'Editing code' : 'Live generation'}
                </div>
              )}
              
              {/* Sandbox Status Indicator */}
              {sandboxData && (
                <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-gray-100 border border-gray-200 rounded-md text-xs font-medium text-gray-700">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
                  Sandbox active
                </div>
              )}
              
              {/* Open in new tab button */}
              {sandboxData && (
                <a 
                  href={sandboxData.url} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  title="Open in new tab"
                  className="p-1.5 rounded-md transition-all text-gray-600 hover:text-gray-900 hover:bg-gray-100"
                >
                  <svg width="14" height="14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              )}
            </div>
          </div>
          <div className="flex-1 relative overflow-hidden">
            {renderMainContent()}
          </div>
        </div>
      </div>




    </div>
    </HeaderProvider>
  );
}

export default function Page() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <AISandboxPage />
    </Suspense>
  );
}