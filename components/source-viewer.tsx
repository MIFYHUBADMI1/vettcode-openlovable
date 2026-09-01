"use client"

import { useState, useEffect, useCallback, useMemo, useRef } from "react"
import { cn } from "@/lib/utils"
import { toast } from "sonner"
import {
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  Search,
  Download,
  Copy,
  Check,
  Loader2,
  AlertCircle,
  Code2,
  Files,
  X,
  GitBranch,
  Braces,
  Terminal,
  Settings,
  PanelLeftClose,
  PanelLeft,
  Puzzle,
  Bug,
  Boxes,
} from "lucide-react"

/* ═══════════════════════════════════════════════════════════════════════════════
   ZIP PARSING — zero dependencies, pure binary format reader
   ═══════════════════════════════════════════════════════════════════════════════ */

interface ZipEntry {
  path: string
  isDir: boolean
  size: number
  compressedSize: number
  method: number
  offset: number
}

function readUint16(v: DataView, o: number) { return v.getUint16(o, true) }
function readUint32(v: DataView, o: number) { return v.getUint32(o, true) }

async function parseZip(buffer: ArrayBuffer): Promise<ZipEntry[]> {
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const entries: ZipEntry[] = []

  let eocdOffset = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (readUint32(view, i) === 0x06054b50) { eocdOffset = i; break }
  }
  if (eocdOffset === -1) throw new Error("Not a valid ZIP file")

  const centralDirOffset = readUint32(view, eocdOffset + 16)
  const numEntries = readUint16(view, eocdOffset + 10)

  let offset = centralDirOffset
  for (let i = 0; i < numEntries; i++) {
    if (readUint32(view, offset) !== 0x02014b50) break
    const compMethod = readUint16(view, offset + 10)
    const compSize = readUint32(view, offset + 20)
    const uncompSize = readUint32(view, offset + 24)
    const nameLen = readUint16(view, offset + 28)
    const extraLen = readUint16(view, offset + 30)
    const commentLen = readUint16(view, offset + 32)
    const localHeaderOffset = readUint32(view, offset + 42)
    const name = new TextDecoder().decode(bytes.slice(offset + 46, offset + 46 + nameLen))

    entries.push({
      path: name,
      isDir: name.endsWith("/"),
      size: uncompSize,
      compressedSize: compSize,
      method: compMethod,
      offset: localHeaderOffset,
    })
    offset += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function extractFile(buffer: ArrayBuffer, entry: ZipEntry): Promise<string> {
  if (entry.isDir) return ""
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const localNameLen = readUint16(view, entry.offset + 26)
  const localExtraLen = readUint16(view, entry.offset + 28)
  const dataOffset = entry.offset + 30 + localNameLen + localExtraLen
  const dataBytes = bytes.slice(dataOffset, dataOffset + entry.compressedSize)

  if (entry.method === 0) return new TextDecoder().decode(dataBytes)
  if (entry.method === 8) {
    try {
      const ds = new DecompressionStream("deflate-raw")
      const writer = ds.writable.getWriter()
      writer.write(dataBytes)
      writer.close()
      const reader = ds.readable.getReader()
      const chunks: Uint8Array[] = []
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        chunks.push(value)
      }
      const totalLen = chunks.reduce((s, c) => s + c.length, 0)
      const result = new Uint8Array(totalLen)
      let pos = 0
      for (const chunk of chunks) { result.set(chunk, pos); pos += chunk.length }
      return new TextDecoder().decode(result)
    } catch { return `[Cannot decompress: ${entry.path}]` }
  }
  return `[Unknown compression: ${entry.path}]`
}

/* ═══════════════════════════════════════════════════════════════════════════════
   FILE TREE
   ═══════════════════════════════════════════════════════════════════════════════ */

interface TreeNode { name: string; path: string; isDir: boolean; size?: number; children: TreeNode[] }

function buildTree(entries: ZipEntry[]): TreeNode {
  const root: TreeNode = { name: "", path: "", isDir: true, children: [] }
  for (const entry of entries) {
    const parts = entry.path.split("/").filter(Boolean)
    let current = root
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const existing = current.children.find((c) => c.name === part)
      if (existing) { current = existing }
      else {
        const node: TreeNode = {
          name: part,
          path: parts.slice(0, i + 1).join("/"),
          isDir: isLast ? entry.isDir : true,
          size: isLast && !entry.isDir ? entry.size : undefined,
          children: [],
        }
        current.children.push(node)
        current = node
      }
    }
  }
  function sortTree(node: TreeNode) {
    node.children.sort((a, b) => a.isDir !== b.isDir ? (a.isDir ? -1 : 1) : a.name.localeCompare(b.name))
    node.children.forEach(sortTree)
  }
  sortTree(root)
  return root
}

function hasMatchingDescendant(node: TreeNode, query: string): boolean {
  const q = query.toLowerCase()
  if (node.path.toLowerCase().includes(q)) return true
  return node.children.some((c) => (c.isDir ? hasMatchingDescendant(c, q) : c.path.toLowerCase().includes(q)))
}

/* ═══════════════════════════════════════════════════════════════════════════════
   LANGUAGE & FILE TYPE HELPERS
   ═══════════════════════════════════════════════════════════════════════════════ */

const LANG_MAP: Record<string, string> = {
  ts: "TypeScript", tsx: "TypeScript React", js: "JavaScript", jsx: "JavaScript React",
  py: "Python", rb: "Ruby", go: "Go", rs: "Rust", java: "Java", kt: "Kotlin",
  swift: "Swift", css: "CSS", scss: "SCSS", less: "Less", html: "HTML", htm: "HTML",
  json: "JSON", yaml: "YAML", yml: "YAML", md: "Markdown", sql: "SQL",
  sh: "Shell", bash: "Shell", zsh: "Shell", toml: "TOML", ini: "INI",
  env: "ENV", xml: "XML", svg: "SVG", graphql: "GraphQL", prisma: "Prisma",
  dockerfile: "Dockerfile", makefile: "Makefile",
}

const FILE_COLORS: Record<string, string> = {
  ts: "#3178c6", tsx: "#3178c6", js: "#f7df1e", jsx: "#f7df1e",
  py: "#3776ab", rb: "#cc342d", go: "#00add8", rs: "#dea584",
  css: "#264de4", scss: "#cf649a", html: "#e34c26", json: "#000000",
  yaml: "#cb171e", yml: "#cb171e", md: "#083fa1", sql: "#e38c00",
  sh: "#4eaa25", dockerfile: "#2496ed", prisma: "#2d3748",
}

function getLanguage(filePath: string): string {
  const ext = filePath.split(".").pop()?.toLowerCase() ?? ""
  const base = filePath.split("/").pop()?.toLowerCase() ?? ""
  if (base === "dockerfile") return "Dockerfile"
  if (base === "makefile") return "Makefile"
  if (base === ".env" || base.startsWith(".env.")) return "ENV"
  return LANG_MAP[ext] ?? "Plain Text"
}

function getFileColor(name: string): string {
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  return FILE_COLORS[ext] ?? "#8b8b8b"
}

function getFileIcon(name: string, isDir: boolean) {
  if (isDir) return null
  const ext = name.split(".").pop()?.toLowerCase() ?? ""
  const color = getFileColor(name)
  const label = ext.toUpperCase().slice(0, 2)
  return (
    <span
      className="inline-flex size-4 shrink-0 items-center justify-center rounded-[3px] text-[8px] font-bold leading-none"
      style={{ backgroundColor: `${color}18`, color }}
    >
      {label}
    </span>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════════════════════════════════════ */

interface SourceViewerProps {
  projectId: string
  projectName: string
}

interface SourceMeta {
  filesCount: number
  lastCommitSha?: string
  downloadUrl?: string
}

export function SourceViewer({ projectId, projectName }: SourceViewerProps) {
  // --- State ---
  const [entries, setEntries] = useState<ZipEntry[]>([])
  const [tree, setTree] = useState<TreeNode | null>(null)
  const [openFiles, setOpenFiles] = useState<string[]>([])
  const [activeFile, setActiveFile] = useState<string | null>(null)
  const [fileContent, setFileContent] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [extracting, setExtracting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedDirs, setExpandedDirs] = useState<Set<string>>(new Set())
  const [zipBuffer, setZipBuffer] = useState<ArrayBuffer | null>(null)
  const [meta, setMeta] = useState<SourceMeta | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [hoveredLine, setHoveredLine] = useState<number | null>(null)
  const [sidebarTab, setSidebarTab] = useState<"files" | "search">("files")
  const fileCache = useMemo(() => new Map<string, string>(), [])

  // --- Find in file state ---
  const [findOpen, setFindOpen] = useState(false)
  const [findQuery, setFindQuery] = useState("")
  const [findCaseSensitive, setFindCaseSensitive] = useState(false)
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0)
  const [replaceOpen, setReplaceOpen] = useState(false)
  const [replaceValue, setReplaceValue] = useState("")
  const findInputRef = useRef<HTMLInputElement>(null)
  const replaceInputRef = useRef<HTMLInputElement>(null)

  // Compute all match positions: [{ line, col, endCol }]
  const findMatches = useMemo(() => {
    if (!findQuery || !fileContent) return []
    const matches: Array<{ line: number; col: number; endCol: number }> = []
    const lines = fileContent.split("\n")
    const query = findCaseSensitive ? findQuery : findQuery.toLowerCase()
    for (let i = 0; i < lines.length; i++) {
      const line = findCaseSensitive ? lines[i] : lines[i].toLowerCase()
      let startIdx = 0
      while (startIdx < line.length) {
        const found = line.indexOf(query, startIdx)
        if (found === -1) break
        matches.push({ line: i, col: found, endCol: found + query.length })
        startIdx = found + 1
      }
    }
    return matches
  }, [findQuery, findCaseSensitive, fileContent])

  // Reset match index when results change
  useEffect(() => { setCurrentMatchIdx(0) }, [findMatches.length, findQuery])

  // Auto-scroll to current match
  useEffect(() => {
    if (findMatches.length === 0 || !codeRef.current) return
    const match = findMatches[currentMatchIdx]
    if (!match) return
    const lineEl = codeRef.current.querySelector(`[data-line="${match.line}"]`)
    if (lineEl) {
      lineEl.scrollIntoView({ behavior: "smooth", block: "center" })
    }
  }, [currentMatchIdx, findMatches])

  // --- Open file ---
  const openFile = useCallback(async (path: string, buf?: ArrayBuffer | null, ents?: ZipEntry[]) => {
    const zBuf = buf ?? zipBuffer
    const zEnts = ents ?? entries
    if (!zBuf) return

    setActiveFile(path)
    setOpenFiles((prev) => prev.includes(path) ? prev : [...prev, path])
    setExtracting(true)

    if (fileCache.has(path)) {
      setFileContent(fileCache.get(path)!)
      setExtracting(false)
      return
    }

    const entry = zEnts.find((e) => e.path === path)
    if (!entry) { setFileContent(""); setExtracting(false); return }

    const content = await extractFile(zBuf, entry)
    fileCache.set(path, content)
    setFileContent(content)
    setExtracting(false)
  }, [zipBuffer, entries, fileCache])

  // --- Full-text search across all files ---
  interface FileMatch {
    filePath: string
    matches: Array<{ lineNum: number; line: string; before: string; match: string; after: string }>
  }
  const [globalSearchQuery, setGlobalSearchQuery] = useState("")
  const [globalSearchCaseSensitive, setGlobalSearchCaseSensitive] = useState(false)
  const [globalSearchResults, setGlobalSearchResults] = useState<FileMatch[]>([])
  const [globalSearchTotal, setGlobalSearchTotal] = useState(0)
  const [searching, setSearching] = useState(false)
  const globalSearchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Debounced full-text search across all file contents
  const runGlobalSearch = useCallback((query: string, caseSensitive: boolean) => {
    if (globalSearchTimerRef.current) clearTimeout(globalSearchTimerRef.current)
    if (!query || query.length < 2) {
      setGlobalSearchResults([])
      setGlobalSearchTotal(0)
      setSearching(false)
      return
    }
    setSearching(true)
    globalSearchTimerRef.current = setTimeout(async () => {
      const q = caseSensitive ? query : query.toLowerCase()
      const results: FileMatch[] = []
      let total = 0
      const textEntries = entries.filter((e) => !e.isDir && !e.path.startsWith("__MACOSX") && e.size > 0 && e.size < 500_000)
      // Search in batches of 10 for responsiveness
      for (let batch = 0; batch < textEntries.length; batch += 10) {
        const slice = textEntries.slice(batch, batch + 10)
        const contents = await Promise.all(
          slice.map(async (entry) => {
            if (fileCache.has(entry.path)) return fileCache.get(entry.path)!
            if (!zipBuffer) return null
            const content = await extractFile(zipBuffer, entry)
            fileCache.set(entry.path, content)
            return content
          })
        )
        for (let j = 0; j < slice.length; j++) {
          const content = contents[j]
          if (!content) continue
          const lines = content.split("\n")
          const fileMatches: FileMatch["matches"] = []
          for (let i = 0; i < lines.length; i++) {
            const line = caseSensitive ? lines[i] : lines[i].toLowerCase()
            if (line.includes(q)) {
              // Extract match with context
              const col = line.indexOf(q)
              const matchText = lines[i].slice(col, col + query.length)
              const before = lines[i].slice(Math.max(0, col - 30), col)
              const after = lines[i].slice(col + query.length, col + query.length + 40)
              fileMatches.push({ lineNum: i, line: lines[i], before, match: matchText, after })
              total++
              if (fileMatches.length >= 5) break // Limit per file in sidebar
            }
          }
          if (fileMatches.length > 0) {
            results.push({ filePath: slice[j].path, matches: fileMatches })
          }
        }
      }
      setGlobalSearchResults(results)
      setGlobalSearchTotal(total)
      setSearching(false)
    }, 300)
  }, [entries, zipBuffer, fileCache])

  // Trigger search when query or case sensitivity changes
  useEffect(() => {
    runGlobalSearch(globalSearchQuery, globalSearchCaseSensitive)
    return () => { if (globalSearchTimerRef.current) clearTimeout(globalSearchTimerRef.current) }
  }, [globalSearchQuery, globalSearchCaseSensitive, runGlobalSearch])

  // Click a search result: open file and scroll to line
  const jumpToResult = useCallback(async (filePath: string, lineNum: number) => {
    await openFile(filePath)
    setTimeout(() => {
      if (!codeRef.current) return
      const lineEl = codeRef.current.querySelector(`[data-line="${lineNum}"]`)
      if (lineEl) lineEl.scrollIntoView({ behavior: "smooth", block: "center" })
      // Flash the line
      lineEl?.classList.add("search-hit-flash")
      setTimeout(() => lineEl?.classList.remove("search-hit-flash"), 1500)
    }, 100)
  }, [openFile])

  const codeRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const lineJumpInputRef = useRef<HTMLInputElement>(null)

  // --- Line jump (Ctrl+G) ---
  const [lineJumpOpen, setLineJumpOpen] = useState(false)
  const [lineJumpValue, setLineJumpValue] = useState("")
  const totalLines = fileContent ? fileContent.split("\n").length : 0

  const handleLineJump = useCallback(() => {
    const num = parseInt(lineJumpValue, 10)
    if (isNaN(num) || num < 1 || num > totalLines) {
      toast.error("Invalid line number", { description: `Must be between 1 and ${totalLines}` })
      return
    }
    const lineIdx = num - 1
    setLineJumpOpen(false)
    setLineJumpValue("")
    setTimeout(() => {
      if (!codeRef.current) return
      const lineEl = codeRef.current.querySelector(`[data-line="${lineIdx}"]`)
      if (lineEl) {
        lineEl.scrollIntoView({ behavior: "smooth", block: "center" })
        lineEl.classList.add("search-hit-flash")
        setTimeout(() => lineEl.classList.remove("search-hit-flash"), 1500)
      }
    }, 50)
  }, [lineJumpValue, totalLines])

  // --- Replace handlers ---
  const replaceCurrentMatch = useCallback(() => {
    if (!findQuery || findMatches.length === 0 || !activeFile) return
    const match = findMatches[currentMatchIdx]
    if (!match) return

    const lines = fileContent.split("\n")
    const line = lines[match.line]
    // Verify the match is still at the expected position
    const check = findCaseSensitive ? line : line.toLowerCase()
    const query = findCaseSensitive ? findQuery : findQuery.toLowerCase()
    if (check.indexOf(query, match.col) !== match.col) return

    // Replace in the line
    lines[match.line] = line.slice(0, match.col) + replaceValue + line.slice(match.endCol)
    const newContent = lines.join("\n")

    // Update state
    setFileContent(newContent)
    if (activeFile) fileCache.set(activeFile, newContent)
    toast.success("Replaced 1 occurrence", { description: findQuery })
  }, [findQuery, findMatches, currentMatchIdx, fileContent, activeFile, replaceValue, findCaseSensitive, fileCache])

  const replaceAllMatches = useCallback(() => {
    if (!findQuery || findMatches.length === 0 || !activeFile) return

    const query = findCaseSensitive ? findQuery : findQuery.toLowerCase()
    let newContent = fileContent
    const lines = newContent.split("\n")
    let count = 0

    for (let i = 0; i < lines.length; i++) {
      const line = findCaseSensitive ? lines[i] : lines[i].toLowerCase()
      if (!line.includes(query)) continue
      // Replace all occurrences in this line
      let result = ""
      let cursor = 0
      const original = lines[i]
      while (cursor < original.length) {
        const searchLine = findCaseSensitive ? original : original.toLowerCase()
        const idx = searchLine.indexOf(query, cursor)
        if (idx === -1) { result += original.slice(cursor); break }
        result += original.slice(cursor, idx) + replaceValue
        cursor = idx + query.length
        count++
      }
      lines[i] = result
    }

    if (count === 0) return
    newContent = lines.join("\n")
    setFileContent(newContent)
    if (activeFile) fileCache.set(activeFile, newContent)
    setFindQuery("")
    toast.success(`Replaced ${count} occurrence${count > 1 ? "s" : ""}`, { description: findQuery })
  }, [findQuery, findMatches, fileContent, activeFile, replaceValue, findCaseSensitive, fileCache])

  // --- Keyboard shortcuts ---
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      // Cmd/Ctrl + F → open find in file
      if ((e.metaKey || e.ctrlKey) && e.key === "f") {
        e.preventDefault()
        setFindOpen(true)
        setTimeout(() => findInputRef.current?.focus(), 50)
      }
      // Cmd/Ctrl + H → open find & replace
      if ((e.metaKey || e.ctrlKey) && e.key === "h") {
        e.preventDefault()
        setFindOpen(true)
        setReplaceOpen(true)
        setTimeout(() => findInputRef.current?.focus(), 50)
      }
      // Escape → close find/replace
      if (e.key === "Escape" && findOpen) {
        setFindOpen(false)
        setFindQuery("")
        setReplaceOpen(false)
        setReplaceValue("")
      }
      // Cmd/Ctrl + K → focus search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault()
        setSidebarTab("search")
        setTimeout(() => searchInputRef.current?.focus(), 50)
      }
      // Cmd/Ctrl + S → download
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault()
        handleDownload()
      }
      // Cmd/Ctrl + G → next match (when find open) or line jump (when find closed)
      if ((e.metaKey || e.ctrlKey) && e.key === "g") {
        e.preventDefault()
        if (findOpen && findQuery) {
          setCurrentMatchIdx((prev) => (prev + 1) % Math.max(findMatches.length, 1))
        } else if (activeFile) {
          setLineJumpOpen(true)
          setTimeout(() => lineJumpInputRef.current?.focus(), 50)
        }
      }
      // Escape → close line jump
      if (e.key === "Escape" && lineJumpOpen) {
        setLineJumpOpen(false)
        setLineJumpValue("")
      }
      // Alt + C → toggle case sensitivity (when find open)
      if (findOpen && e.altKey && e.key.toLowerCase() === "c") {
        e.preventDefault()
        setFindCaseSensitive((prev) => !prev)
      }
    }
    window.addEventListener("keydown", handleKey)
    return () => window.removeEventListener("keydown", handleKey)
  }) // eslint-disable-line react-hooks/exhaustive-deps

  // --- Fetch and parse ZIP ---
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const res = await fetch(`/api/projects/${projectId}/source-url`)
        const json = await res.json()
        if (!json.ok) { setError(json.error?.message ?? "Failed to load source code"); return }

        const { downloadUrl, filesCount, lastCommitSha } = json.data
        setMeta({ filesCount, lastCommitSha, downloadUrl })

        const zipRes = await fetch(downloadUrl)
        if (!zipRes.ok) throw new Error("Failed to download source archive")
        const buffer = await zipRes.arrayBuffer()
        if (cancelled) return

        setZipBuffer(buffer)
        const parsed = await parseZip(buffer)
        if (cancelled) return

        setEntries(parsed)
        setTree(buildTree(parsed))

        // Auto-expand root dirs
        const rootDir = buildTree(parsed)
        const dirs = new Set<string>()
        rootDir.children.forEach((c) => { if (c.isDir) dirs.add(c.path) })
        setExpandedDirs(dirs)

        // Auto-select first meaningful file
        const firstFile = parsed.find((e) => !e.isDir && !e.path.startsWith("__MACOSX") && e.size > 0)
        if (firstFile) {
          await openFile(firstFile.path, buffer, parsed)
        }

        toast.success("Source loaded", { description: `${filesCount ?? parsed.filter(e => !e.isDir).length} files extracted` })
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Failed to load source")
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps


  // --- Close tab ---
  const closeTab = useCallback((path: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    setOpenFiles((prev) => {
      const next = prev.filter((f) => f !== path)
      if (activeFile === path && next.length > 0) {
        const idx = prev.indexOf(path)
        const newActive = next[Math.min(idx, next.length - 1)]
        setActiveFile(newActive)
        // Extract content for new active file
        if (fileCache.has(newActive)) {
          setFileContent(fileCache.get(newActive)!)
        }
      } else if (next.length === 0) {
        setActiveFile(null)
        setFileContent("")
      }
      return next
    })
  }, [activeFile, fileCache])

  // --- Toggle directory ---
  const toggleDir = useCallback((path: string) => {
    setExpandedDirs((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path); else next.add(path)
      return next
    })
  }, [])

  // --- Copy to clipboard ---
  const handleCopy = useCallback(() => {
    if (!fileContent) return
    navigator.clipboard.writeText(fileContent)
    toast.success("Copied to clipboard", { description: activeFile?.split("/").pop() })
  }, [fileContent, activeFile])

  // --- Download ZIP ---
  const handleDownload = useCallback(async () => {
    if (!meta?.downloadUrl) {
      toast.error("Download unavailable", { description: "Source archive URL not available" })
      return
    }
    try {
      toast.info("Downloading…", { description: `${projectName}.zip` })
      const res = await fetch(meta.downloadUrl)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${projectName.replace(/[^a-zA-Z0-9-_]/g, "_")}-source.zip`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      toast.success("Download started", { description: `${projectName}.zip` })
    } catch {
      toast.error("Download failed", { description: "Could not download source archive" })
    }
  }, [meta, projectName])

  // --- Stats ---
  const fileCount = entries.filter((e) => !e.isDir).length
  const totalSize = entries.reduce((s, e) => s + e.size, 0)
  const language = activeFile ? getLanguage(activeFile) : ""
  const lineCount = fileContent ? fileContent.split("\n").length : 0
  const langColor = activeFile ? getFileColor(activeFile) : "#8b8b8b"

  // ═══════════════════════════════════════════════════════════════════════════════
  //  LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (loading) {
    return (
      <div className="editor-shell flex flex-col items-center justify-center rounded-xl border border-border bg-card overflow-hidden"
        style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}>
        <div className="relative">
          <div className="absolute inset-0 animate-ping rounded-full bg-primary/20" style={{ animationDuration: "2s" }} />
          <div className="relative flex size-16 items-center justify-center rounded-2xl bg-primary/10">
            <Code2 className="size-7 text-primary animate-pulse" />
          </div>
        </div>
        <p className="mt-6 text-sm font-medium text-foreground">Extracting source code…</p>
        <p className="mt-1 text-xs text-muted-foreground">Downloading archive from Totalum</p>
        <div className="mt-4 h-1 w-48 overflow-hidden rounded-full bg-muted">
          <div className="h-full rounded-full bg-primary editor-loading-bar" />
        </div>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  ERROR STATE
  // ═══════════════════════════════════════════════════════════════════════════════
  if (error) {
    return (
      <div className="editor-shell flex flex-col items-center justify-center rounded-xl border border-destructive/20 bg-card overflow-hidden"
        style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}>
        <div className="flex size-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertCircle className="size-7 text-destructive" />
        </div>
        <p className="mt-4 text-sm font-medium text-foreground">{error}</p>
        <p className="mt-1 text-xs text-muted-foreground">Make sure the project has been built successfully</p>
      </div>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  FILE TREE NODE
  // ═══════════════════════════════════════════════════════════════════════════════
  function renderNode(node: TreeNode, depth: number = 0) {
    if (node.isDir) {
      const isExpanded = expandedDirs.has(node.path)
      const visibleChildren = globalSearchQuery
        ? node.children.filter((c) =>
            c.isDir ? hasMatchingDescendant(c, globalSearchQuery) : c.path.toLowerCase().includes(globalSearchQuery.toLowerCase()))
        : node.children

      if (globalSearchQuery && visibleChildren.length === 0) return null

      return (
        <div key={node.path} className="animate-in fade-in slide-in-from-left-1 duration-200">
          <button
            onClick={() => toggleDir(node.path)}
            className={cn(
              "group flex w-full items-center gap-1.5 py-[3px] pl-2 pr-1 text-left text-[13px] transition-all duration-150",
              "hover:bg-accent/40 rounded-[4px] mx-1",
            )}
            style={{ paddingLeft: `${depth * 14 + 6}px` }}
          >
            <ChevronRight className={cn(
              "size-3 shrink-0 text-muted-foreground/50 transition-transform duration-200",
              isExpanded && "rotate-90",
            )} />
            {isExpanded
              ? <FolderOpen className="size-4 shrink-0 text-primary/60" />
              : <Folder className="size-4 shrink-0 text-primary/60" />}
            <span className="truncate font-medium text-foreground/80 group-hover:text-foreground transition-colors">
              {node.name}
            </span>
          </button>
          <div className={cn(
            "overflow-hidden transition-all duration-200",
            isExpanded ? "opacity-100" : "max-h-0 opacity-0",
          )}>
            {visibleChildren.map((child) => renderNode(child, depth + 1))}
          </div>
        </div>
      )
    }

    const isActive = activeFile === node.path
    const color = getFileColor(node.name)

    return (
      <button
        key={node.path}
        onClick={() => openFile(node.path)}
        className={cn(
          "group flex w-full items-center gap-2 py-[3px] pl-2 pr-1 text-left text-[13px] transition-all duration-150",
          "rounded-[4px] mx-1",
          isActive
            ? "bg-primary/10 text-foreground font-medium"
            : "text-muted-foreground hover:bg-accent/40 hover:text-foreground",
        )}
        style={{ paddingLeft: `${depth * 14 + 22}px` }}
      >
        {getFileIcon(node.name, false)}
        <span className="truncate transition-colors">{node.name}</span>
        {node.size !== undefined && (
          <span className="ml-auto shrink-0 text-[10px] text-muted-foreground/40 opacity-0 group-hover:opacity-100 transition-opacity">
            {node.size > 1024 ? `${(node.size / 1024).toFixed(1)}K` : `${node.size}`}
          </span>
        )}
      </button>
    )
  }

  // ═══════════════════════════════════════════════════════════════════════════════
  //  MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════════════
  return (
    <div
      className="editor-shell flex flex-col overflow-hidden rounded-xl border border-border bg-card editor-appear"
      style={{ height: "calc(100vh - 180px)", minHeight: "500px" }}
    >
      {/* ─── TITLE BAR ─── */}
      <div className="flex items-center justify-between border-b border-border bg-muted/20 px-3 py-1.5">
        <div className="flex items-center gap-2">
          <div className="flex gap-1.5">
            <span className="size-3 rounded-full bg-destructive/60" />
            <span className="size-3 rounded-full bg-yellow-500/60" />
            <span className="size-3 rounded-full bg-success/60" />
          </div>
          <span className="ml-2 text-xs text-muted-foreground/60 font-mono">{projectName}</span>
        </div>
        <div className="flex items-center gap-1">
          {meta?.lastCommitSha && (
            <span className="flex items-center gap-1 rounded px-2 py-0.5 text-[10px] text-muted-foreground/50 font-mono">
              <GitBranch className="size-3" />
              {meta.lastCommitSha.slice(0, 7)}
            </span>
          )}
        </div>
      </div>

      {/* ─── TAB BAR ─── */}
      {openFiles.length > 0 && (
        <div className="flex items-center overflow-x-auto border-b border-border bg-muted/10 scrollbar-none">
          {openFiles.map((path) => {
            const name = path.split("/").pop() ?? path
            const isActive = activeFile === path
            const color = getFileColor(name)
            return (
              <button
                key={path}
                onClick={() => openFile(path)}
                className={cn(
                  "group flex shrink-0 items-center gap-1.5 border-r border-border px-3 py-1.5 text-[12px] transition-all duration-150",
                  isActive
                    ? "bg-background text-foreground border-t-2 border-t-primary"
                    : "text-muted-foreground hover:bg-muted/30 hover:text-foreground border-t-2 border-t-transparent",
                )}
              >
                <span className="size-2 rounded-full" style={{ backgroundColor: color }} />
                <span className="max-w-[120px] truncate font-mono">{name}</span>
                <span
                  onClick={(e) => closeTab(path, e)}
                  className="ml-1 rounded p-0.5 opacity-0 group-hover:opacity-100 hover:bg-accent transition-all duration-100"
                >
                  <X className="size-3" />
                </span>
              </button>
            )
          })}
        </div>
      )}

      {/* ─── MAIN AREA ─── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ─── ACTIVITY BAR ─── */}
        <div className="flex w-12 flex-col items-center gap-1 border-r border-border bg-muted/10 py-2">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-all duration-200",
              sidebarOpen ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title={sidebarOpen ? "Close sidebar" : "Open sidebar"}
          >
            {sidebarOpen ? <PanelLeftClose className="size-5" /> : <PanelLeft className="size-5" />}
          </button>
          <div className="my-1 h-px w-6 bg-border" />
          <button
            onClick={() => { setSidebarOpen(true); setSidebarTab("files") }}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-all duration-200",
              sidebarOpen && sidebarTab === "files"
                ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title="Explorer"
          >
            <Files className="size-5" />
          </button>
          <button
            onClick={() => { setSidebarOpen(true); setSidebarTab("search") }}
            className={cn(
              "flex size-9 items-center justify-center rounded-lg transition-all duration-200",
              sidebarOpen && sidebarTab === "search"
                ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-accent hover:text-foreground",
            )}
            title="Search (⌘K)"
          >
            <Search className="size-5" />
          </button>
          <div className="flex-1" />
          <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-all" title="Extensions">
            <Puzzle className="size-5" />
          </button>
          <button className="flex size-9 items-center justify-center rounded-lg text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-all" title="Settings">
            <Settings className="size-5" />
          </button>
        </div>

        {/* ─── SIDEBAR ─── */}
        <div className={cn(
          "flex shrink-0 flex-col border-r border-border bg-muted/5 transition-all duration-300 overflow-hidden",
          sidebarOpen ? "w-64" : "w-0 border-r-0",
        )}>
          {sidebarTab === "files" ? (
            <>
              {/* Explorer header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Explorer</span>
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground/50">
                  <Files className="size-3" />
                  {meta?.filesCount ?? fileCount}
                </div>
              </div>
              {/* Project name */}
              <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
                <FolderOpen className="size-4 text-primary/50" />
                <span className="text-xs font-semibold text-foreground truncate">{projectName}</span>
              </div>
              {/* File tree */}
              <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
                {tree?.children.map((node) => renderNode(node, 0))}
              </div>
              {/* Storage info */}
              <div className="border-t border-border px-3 py-2 text-[10px] text-muted-foreground/40">
                {totalSize > 1024 * 1024
                  ? `${(totalSize / (1024 * 1024)).toFixed(1)} MB`
                  : `${(totalSize / 1024).toFixed(1)} KB`}{" "}
                · {meta?.filesCount ?? fileCount} files
              </div>
            </>
          ) : (
            <>
              {/* Search header */}
              <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Search</span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setGlobalSearchCaseSensitive(!globalSearchCaseSensitive)}
                    className={cn(
                      "rounded px-1 py-0.5 text-[9px] font-mono font-bold transition-all",
                      globalSearchCaseSensitive
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground/40 hover:bg-accent hover:text-foreground",
                    )}
                    title="Match case"
                  >
                    Aa
                  </button>
                  <kbd className="rounded bg-muted px-1.5 py-0.5 text-[9px] text-muted-foreground/40 font-mono">⌘K</kbd>
                </div>
              </div>
              <div className="p-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground/40" />
                  <input
                    ref={searchInputRef}
                    type="text"
                    placeholder="Search across all files…"
                    value={globalSearchQuery}
                    onChange={(e) => setGlobalSearchQuery(e.target.value)}
                    className="w-full rounded-md border border-border bg-background py-1.5 pl-7 pr-3 text-xs text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/50 transition-shadow"
                  />
                  {globalSearchQuery && (
                    <button
                      onClick={() => { setGlobalSearchQuery(""); setGlobalSearchResults([]); setGlobalSearchTotal(0) }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground"
                    >
                      <X className="size-3" />
                    </button>
                  )}
                </div>
                {globalSearchQuery.length > 0 && globalSearchQuery.length < 2 && (
                  <p className="mt-1.5 text-[10px] text-muted-foreground/40">Type at least 2 characters</p>
                )}
              </div>
              {/* Search results */}
              <div className="flex-1 overflow-y-auto py-1 scrollbar-thin">
                {searching ? (
                  <div className="flex items-center justify-center gap-2 py-6">
                    <Loader2 className="size-3.5 animate-spin text-primary" />
                    <span className="text-[10px] text-muted-foreground/50">Searching…</span>
                  </div>
                ) : globalSearchQuery.length >= 2 ? (
                  globalSearchResults.length === 0 ? (
                    <p className="px-3 py-4 text-xs text-muted-foreground/40 text-center">No results found</p>
                  ) : (
                    <>
                      <div className="px-3 py-1.5 text-[10px] text-muted-foreground/50">
                        {globalSearchTotal} {globalSearchTotal === 1 ? "result" : "results"} in {globalSearchResults.length} {globalSearchResults.length === 1 ? "file" : "files"}
                      </div>
                      {globalSearchResults.map((fileMatch) => {
                        const shortName = fileMatch.filePath.split("/").pop() ?? fileMatch.filePath
                        const color = getFileColor(shortName)
                        return (
                          <div key={fileMatch.filePath} className="mb-1">
                            {/* File header */}
                            <button
                              onClick={() => openFile(fileMatch.filePath)}
                              className="flex w-full items-center gap-1.5 px-3 py-1 text-left text-[11px] font-medium text-foreground/80 hover:bg-accent/40 transition-colors"
                            >
                              <span className="size-1.5 rounded-full shrink-0" style={{ backgroundColor: color }} />
                              <span className="truncate font-mono">{shortName}</span>
                              <span className="ml-auto shrink-0 text-[9px] text-muted-foreground/40">
                                {fileMatch.matches.length}{fileMatch.matches.length >= 5 ? "+" : ""}
                              </span>
                            </button>
                            {/* Match lines with context */}
                            {fileMatch.matches.map((m, mi) => (
                              <button
                                key={mi}
                                onClick={() => jumpToResult(fileMatch.filePath, m.lineNum)}
                                className="flex w-full items-start gap-1 px-3 py-0.5 pl-6 text-left transition-colors hover:bg-accent/30 group"
                              >
                                <span className="shrink-0 text-[9px] text-muted-foreground/30 font-mono tabular-nums pt-px w-5">
                                  {m.lineNum + 1}
                                </span>
                                <span className="flex-1 truncate text-[10px] font-mono text-muted-foreground/60 leading-tight">
                                  {m.before && <span className="text-muted-foreground/30">…</span>}
                                  <span className="bg-yellow-400/30 text-foreground/80 rounded-px px-px">{m.match}</span>
                                  {m.after && <span className="text-muted-foreground/30">…</span>}
                                </span>
                              </button>
                            ))}
                          </div>
                        )
                      })}
                    </>
                  )
                ) : (
                  <p className="px-3 py-4 text-xs text-muted-foreground/40 text-center">
                    Type to search across all files
                  </p>
                )}
              </div>
            </>
          )}
        </div>

        {/* ─── EDITOR AREA ─── */}
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Breadcrumb */}
          {activeFile && (
            <div className="flex items-center gap-1 border-b border-border bg-muted/10 px-3 py-1 text-[11px]">
              {activeFile.split("/").filter(Boolean).map((part, i, arr) => (
                <span key={i} className="flex items-center gap-1 text-muted-foreground/60">
                  {i > 0 && <ChevronRight className="size-3 text-muted-foreground/30" />}
                  <span className={cn(
                    "transition-colors",
                    i === arr.length - 1 ? "text-foreground/80 font-medium" : "hover:text-foreground/60 cursor-default",
                  )}>
                    {part}
                  </span>
                </span>
              ))}
            </div>
          )}

          {/* Editor toolbar */}
          {activeFile && (
            <div className="flex items-center justify-between border-b border-border bg-muted/5 px-3 py-1">
              <div className="flex items-center gap-2">
                <span
                  className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium uppercase"
                  style={{ backgroundColor: `${langColor}12`, color: langColor }}
                >
                  {language}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/60 transition-all duration-200 hover:bg-accent hover:text-foreground"
                  title="Copy file content"
                >
                  <Copy className="size-3.5" />
                  <span className="hidden sm:inline">Copy</span>
                </button>
                <button
                  onClick={handleDownload}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-muted-foreground/60 transition-all duration-200 hover:bg-accent hover:text-foreground"
                  title="Download source ZIP (⌘S)"
                >
                  <Download className="size-3.5" />
                  <span className="hidden sm:inline">Download</span>
                </button>
              </div>
            </div>
          )}

          {/* Find / Replace bar */}
          {findOpen && (
            <div className="find-bar border-b border-border bg-background">
              {/* Find row */}
              <div className="flex items-center gap-2 px-3 py-1.5">
                <Search className="size-3.5 text-muted-foreground/40 shrink-0" />
                <input
                  ref={findInputRef}
                  type="text"
                  placeholder="Find in file…"
                  value={findQuery}
                  onChange={(e) => setFindQuery(e.target.value)}
                  className="flex-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/50 transition-shadow"
                  autoFocus
                />
                {findQuery && (
                  <span className="text-[10px] text-muted-foreground/50 font-mono tabular-nums shrink-0">
                    {findMatches.length > 0 ? `${currentMatchIdx + 1}/${findMatches.length}` : "No results"}
                  </span>
                )}
                <button
                  onClick={() => setCurrentMatchIdx((prev) => findMatches.length > 0 ? (prev - 1 + findMatches.length) % findMatches.length : 0)}
                  disabled={findMatches.length === 0}
                  className="rounded p-1 text-muted-foreground/50 hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Previous match"
                >
                  <ChevronRight className="size-3.5 rotate-90" />
                </button>
                <button
                  onClick={() => setCurrentMatchIdx((prev) => findMatches.length > 0 ? (prev + 1) % findMatches.length : 0)}
                  disabled={findMatches.length === 0}
                  className="rounded p-1 text-muted-foreground/50 hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  title="Next match (⌘G)"
                >
                  <ChevronRight className="size-3.5 -rotate-90" />
                </button>
                <div className="h-4 w-px bg-border" />
                <button
                  onClick={() => setFindCaseSensitive(!findCaseSensitive)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-mono font-bold transition-all duration-150",
                    findCaseSensitive
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/40 hover:bg-accent hover:text-foreground",
                  )}
                  title="Match case (Alt+C)"
                >
                  Aa
                </button>
                <button
                  onClick={() => setReplaceOpen(!replaceOpen)}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-[10px] font-mono font-bold transition-all duration-150",
                    replaceOpen
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground/40 hover:bg-accent hover:text-foreground",
                  )}
                  title="Toggle replace (⌘H)"
                >
                  ⇄
                </button>
                <button
                  onClick={() => { setFindOpen(false); setFindQuery(""); setReplaceOpen(false); setReplaceValue("") }}
                  className="rounded p-1 text-muted-foreground/40 hover:bg-accent hover:text-foreground transition-colors"
                  title="Close (Escape)"
                >
                  <X className="size-3.5" />
                </button>
              </div>

              {/* Replace row */}
              {replaceOpen && (
                <div className="flex items-center gap-2 border-t border-border/50 px-3 py-1.5">
                  <span className="size-3.5 shrink-0" />
                  <input
                    ref={replaceInputRef}
                    type="text"
                    placeholder="Replace…"
                    value={replaceValue}
                    onChange={(e) => setReplaceValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault()
                        replaceCurrentMatch()
                        // Move to next match after replace
                        setTimeout(() => setCurrentMatchIdx((prev) => findMatches.length > 0 ? (prev + 1) % findMatches.length : 0), 0)
                      }
                    }}
                    className="flex-1 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground font-mono placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-ring/50 transition-shadow"
                  />
                  <span className="text-[10px] text-muted-foreground/30 shrink-0 w-10" />
                  <button
                    onClick={replaceCurrentMatch}
                    disabled={findMatches.length === 0}
                    className="rounded px-2 py-1 text-[10px] font-medium text-muted-foreground/60 hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Replace current match"
                  >
                    Replace
                  </button>
                  <button
                    onClick={replaceAllMatches}
                    disabled={findMatches.length === 0}
                    className="rounded px-2 py-1 text-[10px] font-medium text-muted-foreground/60 hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                    title="Replace all matches"
                  >
                    All
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Line jump overlay */}
          {lineJumpOpen && (
            <div className="absolute inset-0 z-50 flex items-start justify-center pt-24" onClick={() => { setLineJumpOpen(false); setLineJumpValue("") }}>
              <div
                className="find-bar flex items-center gap-2 rounded-lg border border-border bg-background shadow-xl px-3 py-2"
                onClick={(e) => e.stopPropagation()}
              >
                <span className="text-[11px] text-muted-foreground/60 font-medium whitespace-nowrap">Go to line</span>
                <input
                  ref={lineJumpInputRef}
                  type="text"
                  inputMode="numeric"
                  placeholder={`1–${totalLines}`}
                  value={lineJumpValue}
                  onChange={(e) => setLineJumpValue(e.target.value.replace(/[^0-9]/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleLineJump()
                    if (e.key === "Escape") { setLineJumpOpen(false); setLineJumpValue("") }
                  }}
                  className="w-20 rounded-md border border-border bg-muted/30 px-2 py-1 text-xs text-foreground font-mono tabular-nums placeholder:text-muted-foreground/30 focus:outline-none focus:ring-1 focus:ring-ring/50"
                  autoFocus
                />
                <button
                  onClick={handleLineJump}
                  className="rounded-md bg-primary/10 px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  Go
                </button>
              </div>
            </div>
          )}

          {/* Code content */}
          <div ref={codeRef} className="relative flex-1 overflow-auto editor-scroll">
            {extracting ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="size-6 animate-spin text-primary" />
              </div>
            ) : activeFile && fileContent ? (
              <pre className="py-3 font-mono text-[13px] leading-[20px]">
                <code>
                  {(() => {
                    const lines = fileContent.split("\n")
                    // Build a map: line number → array of match cols
                    const lineMatchMap = new Map<number, Array<{ col: number; endCol: number }>>()
                    if (findOpen && findQuery) {
                      for (const m of findMatches) {
                        if (!lineMatchMap.has(m.line)) lineMatchMap.set(m.line, [])
                        lineMatchMap.get(m.line)!.push({ col: m.col, endCol: m.endCol })
                      }
                    }
                    const currentMatch = findMatches[currentMatchIdx]

                    return lines.map((line, i) => {
                      const matches = lineMatchMap.get(i)
                      const isCurrentMatchLine = currentMatch?.line === i

                      // If we have matches on this line, render with highlights
                      if (matches && matches.length > 0) {
                        const segments: React.ReactNode[] = []
                        let cursor = 0
                        for (let m = 0; m < matches.length; m++) {
                          const { col, endCol } = matches[m]
                          // Text before match
                          if (col > cursor) {
                            segments.push(<span key={`t${m}`}>{line.slice(cursor, col)}</span>)
                          }
                          // The match itself
                          const isCurrent = isCurrentMatchLine && currentMatch.col === col && currentMatch.endCol === endCol
                          segments.push(
                            <span
                              key={`m${m}`}
                              className={cn(
                                "rounded-[2px] px-px transition-colors duration-150",
                                isCurrent
                                  ? "bg-primary/40 text-foreground ring-1 ring-primary/60"
                                  : "bg-yellow-400/25 text-foreground",
                              )}
                            >
                              {line.slice(col, endCol)}
                            </span>,
                          )
                          cursor = endCol
                        }
                        // Remaining text after last match
                        if (cursor < line.length) {
                          segments.push(<span key="end">{line.slice(cursor)}</span>)
                        }

                        return (
                          <div
                            key={i}
                            data-line={i}
                            className={cn(
                              "flex transition-colors duration-100",
                              hoveredLine === i ? "bg-accent/30" : "",
                              isCurrentMatchLine && "bg-primary/5",
                            )}
                            onMouseEnter={() => setHoveredLine(i)}
                            onMouseLeave={() => setHoveredLine(null)}
                          >
                            <span className="inline-block w-14 shrink-0 select-none border-r border-border/30 pr-3 text-right text-muted-foreground/30 transition-colors duration-100"
                              style={hoveredLine === i ? { color: "var(--primary)", borderColor: "var(--primary)" } : undefined}
                            >
                              {i + 1}
                            </span>
                            <span className="flex-1 pl-4 pr-6 whitespace-pre">{segments}</span>
                          </div>
                        )
                      }

                      // No matches — plain render
                      return (
                        <div
                          key={i}
                          data-line={i}
                          className={cn(
                            "flex transition-colors duration-100",
                            hoveredLine === i ? "bg-accent/30" : "",
                          )}
                          onMouseEnter={() => setHoveredLine(i)}
                          onMouseLeave={() => setHoveredLine(null)}
                        >
                          <span className="inline-block w-14 shrink-0 select-none border-r border-border/30 pr-3 text-right text-muted-foreground/30 transition-colors duration-100"
                            style={hoveredLine === i ? { color: "var(--primary)", borderColor: "var(--primary)" } : undefined}
                          >
                            {i + 1}
                          </span>
                          <span className="flex-1 pl-4 pr-6 whitespace-pre">{line}</span>
                        </div>
                      )
                    })
                  })()}
                </code>
              </pre>
            ) : (
              <div className="flex flex-col items-center justify-center py-20 text-muted-foreground/40">
                <Code2 className="mb-3 size-10" />
                <p className="text-sm">Select a file from the explorer</p>
                <p className="mt-1 text-[11px]">Press ⌘K to search by name</p>
              </div>
            )}
          </div>

          {/* ─── STATUS BAR ─── */}
          <div className="flex items-center justify-between border-t border-border bg-primary/5 px-3 py-0.5 text-[10px] text-muted-foreground/60">
            <div className="flex items-center gap-3">
              <span className="flex items-center gap-1">
                <GitBranch className="size-3" />
                main
              </span>
              {activeFile && (
                <span className="flex items-center gap-1">
                  <span className="size-1.5 rounded-full" style={{ backgroundColor: langColor }} />
                  {language}
                </span>
              )}
            </div>
            <div className="flex items-center gap-3">
              {activeFile && <span>Ln {lineCount > 0 ? lineCount : 0} lines</span>}
              {activeFile && <span>UTF-8</span>}
              <span>{meta?.filesCount ?? fileCount} files</span>
              {meta?.lastCommitSha && <span className="font-mono">{meta.lastCommitSha.slice(0, 7)}</span>}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
