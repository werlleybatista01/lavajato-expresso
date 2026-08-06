import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({ plugins: [react()], base: '/lavajato-expresso/', test: { environment: 'jsdom', setupFiles: './src/test/setup.ts', include: ['src/**/*.test.ts', 'src/**/*.test.tsx'] } })
