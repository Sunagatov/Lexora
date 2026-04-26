import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'

const localApiPort = process.env.LOCAL_API_PORT ?? '8002'
const localApiBaseUrl = process.env.LOCAL_API_BASE_URL ?? `http://127.0.0.1:${localApiPort}`

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: localApiBaseUrl,
        changeOrigin: true,
      },
      '/auth': {
        target: localApiBaseUrl,
        changeOrigin: true,
      },
    },
  },
})
