import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  // Localhost only by default. To test on a phone on the same network,
  // opt in for that run: `npm run dev -- --host`.
  server: { port: Number(process.env.PORT) || 5180 },
})
