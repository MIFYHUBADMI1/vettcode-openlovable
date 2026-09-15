/**
 * Utilities for building file tree representations from flat file path lists.
 * Used to visualize GitHub repository structure in a readable format.
 */

interface TreeNode {
  name: string
  type: "file" | "folder"
  children?: TreeNode[]
}

/**
 * Converts a flat list of file paths into an indented ASCII tree string.
 * 
 * Example output:
 * ```
 * ├── src/
 * │   ├── app/
 * │   │   └── page.tsx
 * │   └── lib/
 * │       └── utils.ts
 * └── package.json
 * ```
 * 
 * @param paths - Array of file paths (e.g., ["src/app/page.tsx", "package.json"])
 * @returns Formatted tree string with box-drawing characters
 */
export function buildFileTree(paths: string[]): string {
  if (paths.length === 0) return ""

  // Build tree structure
  const root: TreeNode = { name: "", type: "folder", children: [] }
  
  for (const path of paths) {
    const segments = path.split("/")
    let current = root
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!
      const isLastSegment = i === segments.length - 1
      
      if (!current.children) current.children = []
      
      let child = current.children.find(c => c.name === segment)
      if (!child) {
        child = {
          name: segment,
          type: isLastSegment ? "file" : "folder",
          children: isLastSegment ? undefined : []
        }
        current.children.push(child)
      }
      
      if (!isLastSegment) {
        current = child
      }
    }
  }

  // Sort children: folders first, then alphabetically
  sortTree(root)

  // Render tree with box-drawing characters
  const lines: string[] = []
  
  function renderNode(node: TreeNode, prefix: string, isLast: boolean) {
    if (node === root) {
      // Render root children directly
      if (node.children) {
        node.children.forEach((child, idx) => {
          const isLastChild = idx === node.children!.length - 1
          renderNode(child, "", isLastChild)
        })
      }
      return
    }

    const connector = isLast ? "└── " : "├── "
    const nameDisplay = node.type === "folder" ? `${node.name}/` : node.name
    lines.push(`${prefix}${connector}${nameDisplay}`)

    if (node.children && node.children.length > 0) {
      const childPrefix = prefix + (isLast ? "    " : "│   ")
      node.children.forEach((child, idx) => {
        const isLastChild = idx === node.children!.length - 1
        renderNode(child, childPrefix, isLastChild)
      })
    }
  }

  renderNode(root, "", true)
  return lines.join("\n")
}

/**
 * Sorts tree nodes recursively: folders first, then alphabetically.
 */
function sortTree(node: TreeNode) {
  if (!node.children) return
  
  node.children.sort((a, b) => {
    // Folders before files
    if (a.type !== b.type) {
      return a.type === "folder" ? -1 : 1
    }
    // Alphabetically
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
  })
  
  // Recursively sort children
  node.children.forEach(sortTree)
}

/**
 * Converts a flat list of file paths into a JSON tree structure.
 * Useful for interactive tree components in the browser.
 * 
 * @param paths - Array of file paths
 * @returns Root tree node with nested children
 */
export function buildFileTreeJson(paths: string[]): TreeNode {
  const root: TreeNode = { name: "root", type: "folder", children: [] }
  
  for (const path of paths) {
    const segments = path.split("/")
    let current = root
    
    for (let i = 0; i < segments.length; i++) {
      const segment = segments[i]!
      const isLastSegment = i === segments.length - 1
      
      if (!current.children) current.children = []
      
      let child = current.children.find(c => c.name === segment)
      if (!child) {
        child = {
          name: segment,
          type: isLastSegment ? "file" : "folder",
          children: isLastSegment ? undefined : []
        }
        current.children.push(child)
      }
      
      if (!isLastSegment) {
        current = child
      }
    }
  }

  sortTree(root)
  return root
}
