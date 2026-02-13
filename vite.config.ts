import { defineConfig } from 'vite';
import { svelte } from '@sveltejs/vite-plugin-svelte';
import { viteStaticCopy } from 'vite-plugin-static-copy';
import zipPack from 'vite-plugin-zip-pack';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = process.env.NODE_ENV === 'development';
const devDistDir = process.env.VITE_DEV_DIST_DIR || '';

export default defineConfig({
  plugins: [
    svelte(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/i18n/*.yaml',
          dest: 'i18n',
          transform: {
            encoding: 'utf8',
            handler: (content: string) => JSON.stringify(content)
          }
        },
        {
          src: 'public/icon.png',
          dest: '.'
        },
        {
          src: 'public/preview.png',
          dest: '.'
        },
        {
          src: 'README*.md',
          dest: '.'
        },
        {
          src: 'plugin.json',
          dest: '.'
        }
      ]
    }),
    !isDev && zipPack({
      inDir: './dist',
      outDir: './',
      outFileName: 'package.zip'
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@components': path.resolve(__dirname, './src/components'),
      '@services': path.resolve(__dirname, './src/services'),
      '@types': path.resolve(__dirname, './src/types'),
      '@libs': path.resolve(__dirname, './src/libs')
    },
    conditions: ['svelte']
  },
  build: {
    lib: {
      entry: path.resolve(__dirname, 'src/index.ts'),
      formats: ['cjs'],
      fileName: () => 'index.js'
    },
    outDir: devDistDir || 'dist',
    emptyOutDir: true,
    minify: !isDev,
    sourcemap: isDev,
    rollupOptions: {
      external: ['siyuan'],
      output: {
        assetFileNames: (assetInfo) => {
          if (assetInfo.name === 'style.css') {
            return 'index.css';
          }
          return assetInfo.name || 'assets/[name][extname]';
        },
        exports: 'named'
      }
    }
  },
  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `
          @use "sass:color";
          @use "sass:map";
        `
      }
    }
  }
});
