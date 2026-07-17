/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_VISUAL_RADAR_DATA_MODE?: "static";
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
