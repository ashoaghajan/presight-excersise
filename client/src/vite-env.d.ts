/// <reference types="vite/client" />

/**
 * Typed `import.meta.env`. Every custom variable the client reads must be
 * declared here — otherwise a typo silently becomes `undefined` at runtime.
 */
interface ImportMetaEnv {
  readonly VITE_API_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
