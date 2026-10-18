import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const EXPORT_DIR = fileURLToPath(new URL('./maya/export/', import.meta.url))
const ALLOWED = /^(scene\.json|scene\.bin|textures\/[A-Za-z0-9_-]+\.png)$/

// Dev-server endpoint for the Maya export (open the app with ?export=maya).
// It only writes scene.json, scene.bin and textures/*.png into maya/export.
// The custom header makes browsers preflight any cross-site request, which
// this server never approves, so only the app itself can write.
function mayaExport() {
  return {
    name: 'home-twin-maya-export',
    configureServer(server) {
      server.middlewares.use('/__maya/export', (req, res) => {
        const fail = (code, msg) => {
          res.statusCode = code
          res.end(msg)
        }
        if (req.method !== 'POST') return fail(405, 'POST only')
        if (req.headers['x-home-twin'] !== '1') return fail(403, 'Not from the app')
        const file = new URL(req.url, 'http://localhost').searchParams.get('file') ?? ''
        if (!ALLOWED.test(file)) return fail(400, 'Unexpected file name')
        const parts = []
        let size = 0
        req.on('data', (chunk) => {
          size += chunk.length
          if (size > 300_000_000) req.destroy()
          else parts.push(chunk)
        })
        req.on('end', async () => {
          const path = join(EXPORT_DIR, file)
          await mkdir(dirname(path), { recursive: true })
          await writeFile(path, Buffer.concat(parts))
          res.end('ok')
        })
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), mayaExport()],
  // Localhost only by default. To test on a phone on the same network,
  // opt in for that run: `npm run dev -- --host`.
  server: { port: Number(process.env.PORT) || 5180 },
})
