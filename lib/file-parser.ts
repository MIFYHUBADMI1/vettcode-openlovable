import { FileInfo, ImportInfo, ComponentInfo } from '@/types/file-manifest';

/**
 * Parse a JavaScript/JSX file to extract imports, exports, and component info
 */
export function parseJavaScriptFile(content: string, filePath: string): Partial<FileInfo> {
  const imports = extractImports(content);
  const exports = extractExports(content);
  const componentInfo = extractComponentInfo(content, filePath);
  const fileType = determineFileType(filePath, content);
  
  return {
    imports,
    exports,
    componentInfo,
    type: fileType,
  };
}

/**
 * Extract import statements from file content
 */
function extractImports(content: string): ImportInfo[] {
  const imports: ImportInfo[] = [];
  
  // Match import statements
  const importRegex = /import\s+(?:(.+?)\s+from\s+)?['"](.+?)['"]/g;
  const matches = content.matchAll(importRegex);
  
  for (const match of matches) {
    const [, importClause, source] = match;
    const importInfo: ImportInfo = {
      source,
      imports: [],
      isLocal: source.startsWith('./') || source.startsWith('../') || source.startsWith('@/'),
    };
    
    if (importClause) {
      // Handle default import
      const defaultMatch = importClause.match(/^(\w+)(?:,|$)/);
      if (defaultMatch) {
        importInfo.defaultImport = defaultMatch[1];
      }
      
      // Handle named imports
      const namedMatch = importClause.match(/\{([^}]+)\}/);
      if (namedMatch) {
        importInfo.imports = namedMatch[1]
          .split(',')
          .map(imp => imp.trim())
          .map(imp => imp.split(/\s+as\s+/)[0].trim());
      }
    }
    
    imports.push(importInfo);
  }
  
  return imports;
}

/**
 * Extract export statements from file content
 */
function extractExports(content: string): string[] {
  const exports: string[] = [];
  
  // Match default export
  if (/export\s+default\s+/m.test(content)) {
    // Try to find the name of the default export
    const defaultExportMatch = content.match(/export\s+default\s+(?:function\s+)?(\w+)/);
    if (defaultExportMatch) {
      exports.push(`default:${defaultExportMatch[1]}`);
    } else {
      exports.push('default');
    }
  }
  
  // Match named exports
  const namedExportRegex = /export\s+(?:const|let|var|function|class)\s+(\w+)/g;
  const namedMatches = content.matchAll(namedExportRegex);
  
  for (const match of namedMatches) {
    exports.push(match[1]);
  }
  
  // Match export { ... } statements
  const exportBlockRegex = /export\s+\{([^}]+)\}/g;
  const blockMatches = content.matchAll(exportBlockRegex);
  
  for (const match of blockMatches) {
    const names = match[1]
      .split(',')
      .map(exp => exp.trim())
      .map(exp => exp.split(/\s+as\s+/)[0].trim());
    exports.push(...names);
  }
  
  return exports;
}

/**
 * Extract React component information
 */
function extractComponentInfo(content: string, filePath: string): ComponentInfo | undefined {
  // Check if this is likely a React component
  const hasJSX = /<[A-Z]\w*|<[a-z]+\s+[^>]*\/?>/.test(content);
  if (!hasJSX && !content.includes('React')) return undefined;
  
  // Try to find component name
  let componentName = '';
  
  // Check for function component
  const funcComponentMatch = content.match(/(?:export\s+)?(?:default\s+)?function\s+([A-Z]\w*)\s*\(/);
  if (funcComponentMatch) {
    componentName = funcComponentMatch[1];
  } else {
    // Check for arrow function component
    const arrowComponentMatch = content.match(/(?:export\s+)?(?:default\s+)?(?:const|let)\s+([A-Z]\w*)\s*=\s*(?:\([^)]*\)|[^=])*=>/);
    if (arrowComponentMatch) {
      componentName = arrowComponentMatch[1];
    }
  }
  
  // If no component name found, try to get from filename
  if (!componentName) {
    const fileName = filePath.split('/').pop()?.replace(/\.(jsx?|tsx?)$/, '');
    if (fileName && /^[A-Z]/.test(fileName)) {
      componentName = fileName;
    }
  }
  
  if (!componentName) return undefined;
  
  // Extract hooks used
  const hooks: string[] = [];
  const hookRegex = /use[A-Z]\w*/g;
  const hookMatches = content.matchAll(hookRegex);
  for (const match of hookMatches) {
    if (!hooks.includes(match[0])) {
      hooks.push(match[0]);
    }
  }
  
  // Check if component has state
  const hasState = hooks.includes('useState') || hooks.includes('useReducer');
  
  // Extract child components (rough approximation)
  const childComponents: string[] = [];
  const componentRegex = /<([A-Z]\w*)[^>]*(?:\/?>|>)/g;
  const componentMatches = content.matchAll(componentRegex);
  
  for (const match of componentMatches) {
    const comp = match[1];
    if (!childComponents.includes(comp) && comp !== componentName) {
      childComponents.push(comp);
    }
  }
  
  return {
    name: componentName,
    hooks,
    hasState,
    childComponents,
  };
}

/**
 * Determine file type based on path and content
 */
function determineFileType(
  filePath: string,
  content: string
): FileInfo['type'] {
  const fileName = filePath.split('/').pop()?.toLowerCase() || '';
  const dirPath = filePath.toLowerCase();
  
  // Style files
  if (fileName.endsWith('.css')) return 'style';
  
  // Config files
  if (fileName.includes('config') || 
      fileName === 'vite.config.js' ||
      fileName === 'tailwind.config.js' ||
      fileName === 'postcss.config.js') {
    return 'config';
  }
  
  // Hook files
  if (dirPath.includes('/hooks/') || fileName.startsWith('use')) {
    return 'hook';
  }
  
  // Context files
  if (dirPath.includes('/context/') || fileName.includes('context')) {
    return 'context';
  }
  
  // Layout components
  if (fileName.includes('layout') || content.includes('children')) {
    return 'layout';
  }
  
  // Page components (in pages directory or have routing)
  if (dirPath.includes('/pages/') || 
      content.includes('useRouter') ||
      content.includes('useParams')) {
    return 'page';
  }
  
  // Utility files
  if (dirPath.includes('/utils/') || 
      dirPath.includes('/lib/') ||
      !content.includes('export default')) {
    return 'utility';
  }
  
  // Default to component
  return 'component';
}

/**
 * Build component dependency tree
 */
export function buildComponentTree(files: Record<string, FileInfo>) {
  const tree: Record<string, {
    file: string;
    imports: string[];
    importedBy: string[];
    type: 'page' | 'layout' | 'component';
  }> = {};
  
  // First pass: collect all components
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.componentInfo) {
      const componentName = fileInfo.componentInfo.name;
      tree[componentName] = {
        file: path,
        imports: [],
        importedBy: [],
        type: fileInfo.type === 'page' ? 'page' : 
              fileInfo.type === 'layout' ? 'layout' : 'component',
      };
    }
  }
  
  // Second pass: build relationships
  for (const [path, fileInfo] of Object.entries(files)) {
    if (fileInfo.componentInfo && fileInfo.imports) {
      const componentName = fileInfo.componentInfo.name;
      
      // Find imported components
      for (const imp of fileInfo.imports) {
        if (imp.isLocal && imp.defaultImport) {
          // Check if this import is a component we know about
          if (tree[imp.defaultImport]) {
            tree[componentName].imports.push(imp.defaultImport);
            tree[imp.defaultImport].importedBy.push(componentName);
          }
        }
      }
    }
  }
  
  return tree;
}

// ---------------------------------------------------------------------------
// Progressive AI Response Parsing (Req 13.1 – 13.7)
// ---------------------------------------------------------------------------

/**
 * Recognized file extensions for progressive extraction (Req 13.5).
 */
const RECOGNIZED_EXTENSIONS = new Set([
  '.jsx',
  '.js',
  '.tsx',
  '.ts',
  '.css',
  '.json',
]);

/**
 * A single file extracted from an AI response.
 */
export interface ParsedFile {
  /** Relative file path as specified in the <file path="..."> tag */
  path: string;
  /** File content, with standalone ellipsis placeholders stripped */
  content: string;
  /** True when the file block had a closing </file> tag */
  isComplete: boolean;
}

/**
 * Result returned by `parseAIResponse`.
 */
export interface AIResponseParseResult {
  files: ParsedFile[];
}

/**
 * Returns true if the given file path has a recognized extension (Req 13.5).
 */
function hasRecognizedExtension(filePath: string): boolean {
  const lastDot = filePath.lastIndexOf('.');
  if (lastDot === -1) return false;
  const ext = filePath.slice(lastDot).toLowerCase();
  return RECOGNIZED_EXTENSIONS.has(ext);
}

/**
 * Strips standalone ellipsis placeholders from file content while preserving
 * all legitimate spread operators (`...identifier`) (Req 13.7).
 *
 * A standalone ellipsis is:
 *   - A line that contains ONLY `...` (optionally surrounded by whitespace), OR
 *   - `...` followed by whitespace / end-of-line but NOT followed by a word character
 *     (i.e. not a spread operator pattern like `...props`).
 */
function stripStandaloneEllipsis(content: string): string {
  // Remove lines that are purely `...` (optionally indented)
  // Use a line-by-line approach for precision
  const lines = content.split('\n');
  const filtered = lines.filter((line) => {
    const trimmed = line.trim();
    // Keep the line if it is NOT a standalone ellipsis
    // A standalone ellipsis line: the trimmed content is exactly "..."
    if (trimmed === '...') return false;
    return true;
  });
  return filtered.join('\n');
}

/**
 * Internal record for tracking candidate versions of a file during parsing.
 */
interface FileCandidate {
  content: string;
  isComplete: boolean;
}

/**
 * Decide whether `incoming` should replace `existing` according to the merge
 * rules (Req 13.2, 13.3):
 *   - Complete version always beats an incomplete one.
 *   - Among entries with equal completeness status, the LONGER content wins.
 *   - The longer version ALWAYS wins regardless of completeness status.
 */
function shouldReplace(
  existing: FileCandidate,
  incoming: FileCandidate,
): boolean {
  // Complete beats incomplete
  if (incoming.isComplete && !existing.isComplete) return true;
  if (!incoming.isComplete && existing.isComplete) return false;
  // Same completeness — longer wins
  return incoming.content.length > existing.content.length;
}

/**
 * Parse an AI-generated response string and extract all `<file path="...">` blocks.
 *
 * Behaviour:
 * - Extracts files even when the closing `</file>` tag is absent (streaming
 *   partial support, Req 13.1).
 * - Deduplicates: for the same path, retains the longer / more-complete version
 *   (Req 13.2, 13.3).
 * - Strips standalone `...` ellipsis placeholders from content while preserving
 *   spread operators (Req 13.7).
 * - Emits a `console.warn` for every file that lacks a closing tag (Req 13.6).
 * - Excludes files whose paths have unrecognized extensions (Req 13.5).
 */
export function parseAIResponse(rawResponse: string): AIResponseParseResult {
  const candidateMap = new Map<string, FileCandidate>();

  // -----------------------------------------------------------------------
  // Step 1: Extract all <file path="..."> blocks (complete and partial)
  //
  // Strategy:
  //   (a) First, extract every COMPLETE block (has </file> closing tag).
  //   (b) Then, extract every PARTIAL block starting at a <file path="...">
  //       that was NOT fully consumed by the complete-block pass.
  //
  // We build a set of character ranges already claimed by complete blocks so
  // we can skip them when searching for partial ones.
  // -----------------------------------------------------------------------

  // (a) Complete blocks — greedy match stops at the FIRST </file>
  const completeRegex = /<file path="([^"]+)">([\s\S]*?)<\/file>/g;
  const claimedRanges: Array<[number, number]> = [];

  let m: RegExpExecArray | null;

  while ((m = completeRegex.exec(rawResponse)) !== null) {
    const filePath = m[1];
    const rawContent = m[2];
    const start = m.index;
    const end = m.index + m[0].length;
    claimedRanges.push([start, end]);

    if (!hasRecognizedExtension(filePath)) continue;

    const content = stripStandaloneEllipsis(rawContent.trim());
    const candidate: FileCandidate = { content, isComplete: true };

    const existing = candidateMap.get(filePath);
    if (!existing || shouldReplace(existing, candidate)) {
      candidateMap.set(filePath, candidate);
    }
  }

  // (b) Partial blocks — find every <file path="..."> opening tag, skip those
  //     whose position falls within a claimed range (already parsed completely).
  const openTagRegex = /<file path="([^"]+)">/g;

  while ((m = openTagRegex.exec(rawResponse)) !== null) {
    const tagStart = m.index;
    const contentStart = m.index + m[0].length;
    const filePath = m[1];

    // Check if this tag is inside an already-claimed range
    const isClaimed = claimedRanges.some(
      ([s, e]) => tagStart >= s && tagStart < e,
    );
    if (isClaimed) continue;

    // Extract content from after the opening tag to end-of-string (no closing tag)
    const rawContent = rawResponse.slice(contentStart);

    if (!hasRecognizedExtension(filePath)) continue;

    const content = stripStandaloneEllipsis(rawContent.trim());
    const candidate: FileCandidate = { content, isComplete: false };

    const existing = candidateMap.get(filePath);
    if (!existing || shouldReplace(existing, candidate)) {
      candidateMap.set(filePath, candidate);
    }
  }

  // -----------------------------------------------------------------------
  // Step 2: Build output, emitting warnings for incomplete files (Req 13.6)
  // -----------------------------------------------------------------------
  const files: ParsedFile[] = [];

  for (const [path, { content, isComplete }] of candidateMap.entries()) {
    if (!isComplete) {
      console.warn(
        `[parseAIResponse] File "${path}" appears to be truncated (no closing </file> tag) — applying partial content anyway.`,
      );
    }
    files.push({ path, content, isComplete });
  }

  return { files };
}
