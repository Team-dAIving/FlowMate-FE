/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Backend base URL, e.g. http://localhost:8080. Empty → the app runs on local mock data. */
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
