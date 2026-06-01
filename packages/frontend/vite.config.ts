import { defineConfig, loadEnv } from 'vite'
import vue from '@vitejs/plugin-vue'
import { resolve, join } from 'path'

export default defineConfig(({ mode }) => {
  // ルートの .env を読み込む (packages/frontend から ../../ が monorepo root)
  const rootEnv = loadEnv(mode, join(__dirname, '../..'), '')

  const frontendPort = parseInt(rootEnv.FRONTEND_PORT || '5200')
  const serverPort = rootEnv.SERVER_PORT || '4001'

  return {
    plugins: [vue()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
      },
    },
    server: {
      port: frontendPort,
      proxy: {
        '/api': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, ''),
        },
        '/audio': {
          target: `http://localhost:${serverPort}`,
          changeOrigin: true,
        },
      },
    },
  }
})
