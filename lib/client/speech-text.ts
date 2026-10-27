/**
 * Chat replies are markdown on screen; copy and read-aloud need the words
 * themselves. Three flavours:
 *  - `plainTextFromMarkdown` keeps the shape (line breaks, list markers, code,
 *    link targets) so pasting into a document still makes sense.
 *  - `speechTextFromMarkdown` is what a voice should say: prose only, syntax
 *    removed, and a final sweep guarantees no markdown character survives —
 *    models write `##Title`, `### Plan ###`, deep-indented lists and stray `**`
 *    as often as they write tidy markdown.
 *  - `normalizeMarkdown` repairs the sloppy forms for the RENDERER, which
 *    follows CommonMark and shows `##Title` literally.
 */

const ABBREVIATIONS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\be\.g\./gi, "for example"],
  [/\bi\.e\./gi, "that is"],
  [/\bvs\./gi, "versus"],
  [/\betc\./gi, "and so on"],
  [/\bmr\./gi, "mister"],
  [/\bmrs\./gi, "misses"],
  [/\bdr\./gi, "doctor"],
  [/\bprof\./gi, "professor"],
  [/\bst\./gi, "saint"],
  [/\bfig\./gi, "figure"],
  [/\bdept\./gi, "department"],
  [/\bmisc\./gi, "miscellaneous"],
]

/** Symbols a voice would either skip or mangle; say the word instead. */
const SPEECH_SYMBOLS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\s*&\s*/g, " and "],
  [/\s*→\s*/g, " to "],
  [/\s*=>\s*/g, " to "],
  [/\s*\+\s*/g, " plus "],
  [/\s*—\s*/g, ", "],
  [/\s*–\s*/g, ", "],
  [/\s*\|\s*/g, ", "],
  [/(\d)\s*%/g, "$1 percent"],
]

const HTML_ENTITIES: Readonly<Record<string, string>> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
}

/** Paired emphasis, bold before italics so `**` isn't eaten by `*`. */
const EMPHASIS: ReadonlyArray<readonly [RegExp, string]> = [
  [/\*\*([\s\S]+?)\*\*/g, "$1"],
  [/__([\s\S]+?)__/g, "$1"],
  [/~~([\s\S]+?)~~/g, "$1"],
  [/(^|[\s([{])\*([^*\n]+?)\*/g, "$1$2"],
  [/(^|[\s([{])_([^_\n]+?)_(?=$|[\s).,;:!?"'])/g, "$1$2"],
]

const FENCE = /^\s{0,7}(`{3,}|~{3,})/
const HTML_TAGS = /<\/?[a-z][^<>]*>/gi
const LINK = /\[([^\]]*)\]\(\s*([^)\s]*)[^)]*\)/g
const AUTOLINK = /<((?:https?|ftp|mailto):[^>\s]+)>/gi
const BARE_URL = /(?:https?|ftp):\/\/[^\s<>"'`()[\]{}]+/gi
/** ATX headings in every shape a model produces them in. */
const HEADING_OPEN = /^\s{0,7}#{1,7}\s*/
const HEADING_CLOSE = /\s*#+\s*$/
const QUOTE_MARKER = /^\s{0,7}>\s?/
/** Bullets: ASCII, unicode and dash variants. */
const BULLET_MARKER = /^\s{0,7}[-–—*+•·◦▪‣]\s+/
const NUMBERED_MARKER = /^\s{0,7}\(?\d{1,3}[.)\]]\s+/
const RULE_LINE = /^\s{0,7}([-*_]\s*){3,}$/

function decodeEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (whole, name: string) => {
    if (name[0] === "#") {
      const code = name[1] === "x" || name[1] === "X" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : whole
    }
    const known = HTML_ENTITIES[name.toLowerCase()]
    if (known !== undefined) return known
    // "M&amp;B" already handled; anything else keeps its literal text.
    return whole
  })
}

/** Inline syntax removal shared by copy and speech. */
function stripInline(text: string, forSpeech: boolean): string {
  let out = decodeEntities(text)
  // A line break must stay a break — deleting <br> welds two sentences
  // together and the voice reads the merged word.
  out = out.replace(/<br\s*\/?\s*>/gi, forSpeech ? ". " : "\n").replace(HTML_TAGS, "")
  // Images: the alt text is the readable part.
  out = out.replace(/!\[([^\]]*)\]\([^)]*\)/g, "$1")
  out = out.replace(LINK, (_whole, label: string, href: string) => {
    if (forSpeech) return label || "a link"
    if (!href) return label
    if (!label || label === href) return href
    return `${label} (${href})`
  })
  out = out.replace(AUTOLINK, (_whole, href: string) => (forSpeech ? "a link" : href))
  // Speech has no use for a 60-character URL; copy must keep it verbatim.
  if (forSpeech) out = out.replace(BARE_URL, "a link")
  // Inline code keeps its content, loses its fence.
  out = out.replace(/`([^`\n]+)`/g, "$1")
  for (const [pattern, replacement] of EMPHASIS) out = out.replace(pattern, replacement)
  // Backslash-escaped markdown ("2 \* not emphasis") becomes the character.
  out = out.replace(/\\([\\`*_[\]()>#~|])/g, "$1")
  return out.replace(/[ \t]+/g, " ").trim()
}

function lines(markdown: string): string[] {
  return markdown.replace(/\r\n/g, "\n").split("\n")
}

function isTableSeparator(line: string): boolean {
  return line.includes("|") && /^\s*\|?[\s:|-]+\|[\s:|-]*$/.test(line) && line.includes("-")
}

/**
 * Models sometimes emit the two-character escape `\n` (or a typo'd `/n`) where
 * they meant a real line break. On screen and in code samples that text is
 * theirs to keep; read aloud it becomes "backslash n", so the speech path turns
 * those artifacts back into breaks.
 */
function expandLiteralBreaks(markdown: string): string {
  return markdown
    .replace(/\\r\\n/g, "\n")
    .replace(/\\[nrt]/g, "\n")
    .replace(/(?:\s*\/n){2,}/g, "\n")
    .replace(/(^|\s)\/n(?=\s|$)/g, "$1\n")
}

/** `## Where you stand` — the shape CommonMark accepts. */
const HEADING_SPACED = /^\s{0,3}#{1,7}\s/
/** `##Pricing` — hashes jammed onto the words. Only with 2+ hashes, because a
 * single `#` is far more often "#1" or a hashtag than a heading. */
const HEADING_SLOPPY = /^\s{0,3}#{2,7}(?=[^\s#])/

/** A line that really is a heading, in either the tidy or the sloppy shape. */
function isHeadingLine(line: string): boolean {
  return HEADING_SPACED.test(line) || HEADING_SLOPPY.test(line)
}

function headingText(line: string): string {
  return isHeadingLine(line) ? line.replace(HEADING_OPEN, "").replace(HEADING_CLOSE, "") : line
}

/** Markdown → readable text, shape included. Used by the copy button. */
export function plainTextFromMarkdown(markdown: string): string {
  const out: string[] = []
  let inCode = false
  for (const raw of lines(markdown)) {
    // Fenced code: keep the code itself (comment hashes and all), drop the fence.
    if (FENCE.test(raw)) {
      inCode = !inCode
      continue
    }
    if (inCode) {
      out.push(raw)
      continue
    }
    if (isTableSeparator(raw) || RULE_LINE.test(raw)) continue
    const marked = headingText(raw).replace(QUOTE_MARKER, "").trim()
    out.push(stripInline(marked, false))
  }
  return out
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
}

/**
 * Markdown → words to speak. Code blocks and table rules are dropped (a voice
 * reading a SQL snippet or a column of `|---|` helps nobody), abbreviations are
 * spelled out, and a final sweep guarantees no leftover `#`, `*`, `_`, `` ` ``
 * or `~` reaches the speech engine.
 */
export function speechTextFromMarkdown(markdown: string): string {
  const out: string[] = []
  let inCode = false
  for (const raw of lines(expandLiteralBreaks(markdown))) {
    if (FENCE.test(raw)) {
      inCode = !inCode
      continue
    }
    if (inCode) continue
    // A table row is a list of cells, not a sentence.
    if (raw.includes("|")) {
      if (isTableSeparator(raw)) continue
      const cells = raw
        .split("|")
        .map((cell) => cell.trim())
        .filter(Boolean)
      if (cells.length) out.push(stripInline(cells.join(", "), true))
      continue
    }
    if (RULE_LINE.test(raw)) continue
    const line = stripInline(
      headingText(raw)
        .replace(QUOTE_MARKER, "")
        .replace(BULLET_MARKER, "")
        // "1." would be read as "one point"; the period is a false sentence end.
        .replace(NUMBERED_MARKER, "")
        .trim(),
      true,
    )
    if (line) out.push(line)
  }

  let text = out.join(". ").replace(/\. \./g, ".").replace(/\.\.$/g, ".")
  // Joining lines with ". " can double a period a line already ended with.
  text = text.replace(/\s*\.\s*([.!?])/g, "$1")
  for (const [pattern, replacement] of SPEECH_SYMBOLS) text = text.replace(pattern, replacement)
  for (const [pattern, replacement] of ABBREVIATIONS) text = text.replace(pattern, replacement)
  return sweepSpeechPunctuation(text)
}

/** Last line of defence: whatever survived, a voice never reads markup. */
function sweepSpeechPunctuation(text: string): string {
  let out = text
  // Arithmetic and numbering that must become words, not silence.
  out = out.replace(/(\d)\s*[*xX]\s*(?=\d)/g, "$1 times ")
  out = out.replace(/(\d)\s*\/\s*(?=\d)/g, "$1 divided by ")
  out = out.replace(/#(\d+)/g, "number $1")
  out = out
    .replace(/[*~`]/g, "")
    .replace(/#+/g, "")
    .replace(/(\w)_(?=\w)/g, "$1 ")
    .replace(/_{2,}/g, " ")
    .replace(/\\(?=[*_#`~[\]])/g, "")
    // No English word contains a backslash; whatever is left is syntax the
    // voice would announce as "backslash".
    .replace(/\\/g, " ")
    .replace(/<[a-z/][^<>]*>/gi, "")
    // Empty brackets left behind by a link whose label was the URL.
    .replace(/[([{\s]\)/g, " ")
  return out.replace(/\s+/g, " ").replace(/\s+([,.!?;:])/g, "$1").trim()
}

/**
 * Repair the markdown shapes CommonMark (and therefore react-markdown) renders
 * literally instead of as headings: `##Title`, `## Plan ##`. Fence-aware, so
 * comment lines inside code samples are never touched.
 */
export function normalizeMarkdown(markdown: string): string {
  const out: string[] = []
  let inCode = false
  for (const line of lines(markdown)) {
    if (FENCE.test(line)) {
      inCode = !inCode
      out.push(line)
      continue
    }
    if (inCode) {
      out.push(line)
      continue
    }
    // `##Title` needs its space back and `### Plan ###` loses the trailing
    // hashes; everything else (a real "C#" in prose, a 4-space-indented
    // comment, a "#1" ranking) passes through untouched.
    out.push(
      isHeadingLine(line)
        ? line.replace(/^(\s{0,3}#{1,7})(?=[^\s#])/, "$1 ").replace(HEADING_CLOSE, "")
        : line,
    )
  }
  return out.join("\n")
}

/**
 * Chunk for the browser speech queue.
 *
 * Chrome stops speaking long utterances after roughly ten seconds without
 * firing an event, and the Web Speech API has no way to raise that limit, so
 * each sentence-sized piece goes in as its own utterance.
 */
export function chunkForSpeech(text: string, maxLength = 220): string[] {
  const sentences = text
    .split(/(?<=[.!?;:])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)
  const chunks: string[] = []
  let current = ""
  for (const sentence of sentences) {
    if (!current) {
      // A single over-long sentence is still better cut on a word.
      if (sentence.length <= maxLength) {
        current = sentence
        continue
      }
      const words = sentence.split(" ")
      for (const word of words) {
        if (current && `${current} ${word}`.length > maxLength) {
          chunks.push(current)
          current = word
        } else {
          current = current ? `${current} ${word}` : word
        }
      }
      if (current) chunks.push(current)
      current = ""
      continue
    }
    if (`${current} ${sentence}`.length <= maxLength) {
      current = `${current} ${sentence}`
    } else {
      chunks.push(current)
      current = sentence
    }
  }
  if (current) chunks.push(current)
  return chunks
}
