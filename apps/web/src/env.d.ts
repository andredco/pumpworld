/// <reference types="vite/client" />

declare const __PUMPWORLD_WS__: string;
declare const __PUMPWORLD_HTTP__: string;

declare module "*.md?raw" {
  const src: string;
  export default src;
}
