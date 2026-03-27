/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    screens: {
      sm: '640px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      colors: {
        ck: {
          bg: '#08111f',
          panel: '#11213b',
          primary: '#4f7dff',
          accent: '#10b981',
          muted: '#9fb2cb',
        },
      },
      borderRadius: {
        shell: '32px',
      },
      boxShadow: {
        shell: '0 32px 90px rgba(30, 24, 40, 0.3)',
      },
      transitionTimingFunction: {
        premium: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
};
