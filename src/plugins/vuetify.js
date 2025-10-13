// Vuetify plugin setup
import 'vuetify/styles'
import { createVuetify } from 'vuetify'
import { aliases, mdi } from 'vuetify/iconsets/mdi'
import '@mdi/font/css/materialdesignicons.css'

const lightTheme = {
  dark: false,
  colors: {
    background: '#FFFFFF',
    surface: '#FFFFFF',
    primary: '#1565c0',
    'primary-darken-1': '#0d47a1',
    secondary: '#ff9800',
    'secondary-darken-1': '#ef6c00',
    error: '#d32f2f',
    info: '#0288d1',
    success: '#2e7d32',
    warning: '#ed6c02'
  }
}

export default createVuetify({
  theme: {
    defaultTheme: 'lightTheme',
    themes: { lightTheme }
  },
  icons: {
    defaultSet: 'mdi',
    aliases,
    sets: { mdi }
  }
})
