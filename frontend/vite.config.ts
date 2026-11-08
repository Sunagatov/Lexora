import {defineConfig} from 'vite'
import react from '@vitejs/plugin-react'
import {offlinePlugin} from './offlinePlugin.js'

const localApiPort = process.env.LOCAL_API_PORT ?? '8002'
const localApiBaseUrl = process.env.LOCAL_API_BASE_URL ?? `http://127.0.0.1:${localApiPort}`

export default defineConfig({
  plugins: [react(), offlinePlugin()],
  resolve: {
    alias: {
      '@': `${import.meta.dirname}/src`,
    },
  },
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
