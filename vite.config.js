import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const projectRoot = fileURLToPath(new URL('.', import.meta.url))
const sourceFiles = execFileSync('git', [
  'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--',
  'src', 'public', 'server', 'package.json', 'package-lock.json', 'vite.config.js', 'wrangler.jsonc',
], { cwd: projectRoot, encoding: 'utf8' }).split('\0').filter(Boolean).sort()
const revision = createHash('sha256')
for (const file of sourceFiles) {
  const path = new URL(file, import.meta.url)
  if (existsSync(path)) revision.update(file).update('\0').update(readFileSync(path)).update('\0')
}
const appVersion = revision.digest('hex').slice(0, 8)

// The frontend calls the API under the same origin (/api).
// In development and preview, Vite forwards those requests to the API server.
const apiProxy = {
  '/api': process.env.DOMUS_API_URL || 'http://localhost:3001',
}

// https://vite.dev/config/
export default defineConfig({
  define: { 'import.meta.env.VITE_APP_VERSION': JSON.stringify(appVersion) },
  plugins: [react()],
  server: {
    proxy: apiProxy,
  },
  preview: {
    proxy: apiProxy,
  },
})
