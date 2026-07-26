import { defineConfig } from 'vite';

// Client build: tree-shaking + minification + hashed adlar (uzunmüddətli cache).
// worker/ Vite-ə aid deyil — onu wrangler özü bundle edir.
export default defineConfig({
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'esnext',
    minify: 'esbuild',
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false,
    },
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor libraries
          vendor: ['marked', 'dompurify'],
          // Qeyd: köhnə `firebase` manual-chunk-ı silindi — layihə Cloudflare
          // (Workers + D1 + R2 + KV) üzərindədir, firebase asılılığı yoxdur.
          // Qalıq konfiq hər build-də boş chunk yaradırdı.
        },
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      },
    },
  },
});
