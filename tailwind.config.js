/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#c45c4a',
          dark: '#a34a3a',
          light: '#e07a68',
        },
        surface: {
          DEFAULT: '#faf6f2',
          card: '#ffffff',
          'card-warm': '#f5f0e8',
        },
        muted: '#5c5348',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'app-title': ['1rem', { lineHeight: '1.4', fontWeight: '700' }],
        'sm-app-title': ['1.125rem', { lineHeight: '1.4', fontWeight: '700' }],
        'md-app-title': ['1.25rem', { lineHeight: '1.4', fontWeight: '700' }],
        'lg-app-title': ['1.375rem', { lineHeight: '1.4', fontWeight: '700' }],
        'kpi-label': ['0.6875rem', { lineHeight: '1.25', letterSpacing: '0.04em' }],
        'sm-kpi-label': ['0.75rem', { lineHeight: '1.25', letterSpacing: '0.04em' }],
        'kpi-value': ['1.25rem', { lineHeight: '1.25', fontWeight: '700' }],
        'sm-kpi-value': ['1.375rem', { lineHeight: '1.25', fontWeight: '700' }],
        'md-kpi-value': ['1.5rem', { lineHeight: '1.25', fontWeight: '700' }],
        'lg-kpi-value': ['1.625rem', { lineHeight: '1.25', fontWeight: '700' }],
        'chart-title': ['0.875rem', { fontWeight: '600' }],
        'sm-chart-title': ['0.9375rem', { fontWeight: '600' }],
        'md-chart-title': ['1rem', { fontWeight: '600' }],
        'chart-subtitle': ['0.75rem', { color: '#5c5348' }],
        'sm-chart-subtitle': ['0.8125rem', { color: '#5c5348' }],
        'md-chart-subtitle': ['0.875rem', { color: '#5c5348' }],
      },
      borderRadius: {
        card: '8px',
      },
      boxShadow: {
        card: '0 1px 3px rgba(0,0,0,0.06)',
      },
    },
  },
  plugins: [],
}
