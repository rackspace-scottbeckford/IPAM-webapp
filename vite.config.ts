import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import path from 'path';

export default defineConfig({
  base: '/IPAM-webapp/',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        // Cache all static assets with precaching (cache-first by default)
        globPatterns: ['**/*.{js,css,html,ico,png,svg,json,woff,woff2}'],
        // No runtime caching rules — the app makes zero outbound network requests.
        // All assets are precached at install time, ensuring full offline support
        // without any risk of transmitting plan data to external servers.
        runtimeCaching: [],
      },
      includeAssets: ['favicon.ico', 'icons/*.svg', 'icons/*.png'],
      manifest: {
        name: 'Cloud IPAM Web Application',
        short_name: 'Cloud IPAM',
        description: 'IP Address Management for cloud migrations — fully offline capable',
        theme_color: '#EB0000',
        background_color: '#ffffff',
        display: 'standalone',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  css: {
    modules: {
      localsConvention: 'camelCaseOnly',
      scopeBehaviour: 'local',
    },
  },
});
