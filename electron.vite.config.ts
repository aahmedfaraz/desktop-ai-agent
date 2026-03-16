import { defineConfig } from "electron-vite"
import react from "@vitejs/plugin-react"
import path from "path"

export default defineConfig({
  main: {
    build: {
      // Type cast to bypass overly strict electron-vite typings while still
      // providing the runtime-required entry configuration.
      ...({
        lib: {
          entry: path.resolve(__dirname, "electron/main/index.ts"),
        },
      } as any),
    },
  },
  preload: {
    build: {
      ...({
        lib: {
          entry: path.resolve(__dirname, "electron/preload/index.ts"),
          formats: ["cjs"],
        },
      } as any),
    },
  },
  renderer: {
    plugins: [react()],
    server: {
      port: 5173,
    },
  },
})