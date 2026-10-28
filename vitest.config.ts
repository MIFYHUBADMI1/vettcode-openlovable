import { defineConfig } from 'vitest/config'
import path from 'path'

// Mirrors Next.js's build-time aliasing of the `server-only` sentinel, which
// vitest does not perform (the package is not installed as a dependency).
const serverOnlyShim = {
  name: 'server-only-shim',
  resolveId(id: string) {
    if (id === 'server-only' || id === 'client-only') {
      return '\0server-only-stub'
    }
    return null
  },
  load(id: string) {
    if (id === '\0server-only-stub') return 'export {}'
    return null
  },
}

export default defineConfig({
  plugins: [serverOnlyShim],
  test: {
    globals: true,
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, '.'),
    },
  },
})
