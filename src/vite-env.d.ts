/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Set for the single-file build, which has no server to rewrite paths. */
  readonly VITE_HASH_ROUTER?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
