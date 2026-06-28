/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Фирменная сине-серая палитра логистической CRM
        brand: {
          50: '#eff4fb',
          100: '#dbe6f5',
          200: '#bcd0eb',
          300: '#8fb1dc',
          400: '#5b8bc9',
          500: '#386db4',
          600: '#2b5598',
          700: '#26467b',
          800: '#243d66',
          900: '#223556',
          950: '#172237'
        },
        ink: {
          50: '#f6f7f9',
          100: '#eceef2',
          200: '#d4d9e2',
          300: '#aeb7c7',
          400: '#8290a6',
          500: '#63718a',
          600: '#4e5a72',
          700: '#40495d',
          800: '#373e4f',
          900: '#1f2530',
          950: '#141821'
        }
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif']
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(20, 24, 33, 0.04), 0 1px 3px 0 rgba(20, 24, 33, 0.08)',
        panel: '0 10px 30px -12px rgba(20, 24, 33, 0.25)'
      }
    }
  },
  plugins: []
}
