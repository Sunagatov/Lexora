/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_BASE_URL: string
  readonly VITE_PAGE_SIZES: string
  readonly VITE_DEFAULT_PAGE_SIZE: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}