import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
// https://vite.dev/config/
export default defineConfig({
    plugins: [react()],
    resolve: {
        alias: {
            "@": path.resolve(__dirname, "./src"),
        },
    },
    build: {
        // Enable code splitting and optimization
        rollupOptions: {
            output: {
                manualChunks: {
                    // Split vendor libraries
                    vendor: ['react', 'react-dom', '@tanstack/react-query'],
                    ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', 'lucide-react'],
                    utils: ['date-fns', 'clsx', 'tailwind-merge']
                },
                // Optimize chunk naming for better caching
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js',
                assetFileNames: 'assets/[ext]/[name]-[hash].[ext]'
            }
        },
        // Enable source maps for production debugging
        sourcemap: true,
        // Optimize bundle size
        minify: 'terser',
        // Set appropriate chunk size limit for better caching
        chunkSizeWarningLimit: 1000
    },
    // Optimize dependencies during build
    optimizeDeps: {
        include: ['react', 'react-dom', '@tanstack/react-query', 'date-fns']
    },
    // Development server optimization
    server: {
        fs: {
            // Allow serving files from project root
            allow: ['..']
        }
    },
    // Preview server optimization
    preview: {
        port: 4173,
        strictPort: true
    }
});
