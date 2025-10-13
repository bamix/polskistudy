import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import vuetify from 'vite-plugin-vuetify'

export default defineConfig({
  // Relative base so the app works on GitHub Pages under /<user>/<repo>/
  base: './',
  plugins: [
    vue(),
    vuetify({
      autoImport: true,
      // styles: 'sass' // could switch to sass later
    })
  ],
})
