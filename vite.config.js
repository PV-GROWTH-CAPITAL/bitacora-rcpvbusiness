import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

// PWA (reglas en CLAUDE.md): solo se precachea el build estático; todo lo
// que va a Supabase va siempre por la red; las actualizaciones se avisan
// (src/AvisoActualizacion.jsx) y nunca recargan solas.
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      manifest: {
        id: "/",
        name: "RCPV Bitácora",
        short_name: "Bitácora",
        description: "Bitácora de trading y contabilidad de cuentas fondeadas.",
        lang: "es-ES",
        start_url: "/",
        scope: "/",
        display: "standalone",
        theme_color: "#14213D",
        background_color: "#14213D",
        icons: [
          { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
          { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
          { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
      workbox: {
        globPatterns: ["**/*.{js,css,html,ico,png,svg,webp,woff,woff2,webmanifest}"],
        navigateFallback: "index.html",
        // No servir index.html en lugar de .html sueltos de public/ ni de /.netlify/.
        navigateFallbackDenylist: [/^\/\.netlify\//, /\.html$/],
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Auth, REST, storage y URLs firmadas: nunca en caché.
            urlPattern: ({ url }) => url.hostname.endsWith(".supabase.co"),
            handler: "NetworkOnly",
          },
        ],
      },
      devOptions: { enabled: false },
    }),
  ],
});
