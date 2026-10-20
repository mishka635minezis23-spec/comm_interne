import { defineConfig } from "vite";
import { resolve } from "node:path";

export default defineConfig({
  appType: "mpa",
  server: {
    host: "0.0.0.0",
    port: 5173,
    strictPort: true
  },
  preview: {
    host: "0.0.0.0",
    port: 4173,
    strictPort: true
  },
  build: {
    rollupOptions: {
      input: {
        index: resolve(process.cwd(), "index.html"),
        reception: resolve(process.cwd(), "reception.html"),
        personnel: resolve(process.cwd(), "personnel.html"),
        disponibilite: resolve(process.cwd(), "disponibilite.html"),
        historique: resolve(process.cwd(), "historique.html"),
        admin: resolve(process.cwd(), "admin.html")
      }
    }
  }
});
