import typography from '@tailwindcss/typography';
import forms from '@tailwindcss/forms';

/** @type {import('tailwindcss').Config} */
const config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,html}"],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#1FC35A',
          hover: '#18A54B',
          active: '#148C3F',
          muted: 'rgba(31, 195, 90, 0.1)',
        },
        background: {
          light: '#FFFFFF',
          offset: '#F9F8F5',
          dark: '#022D0D',
        },
        text: {
          primary: '#022D0D',
          secondary: '#4A5568',
          muted: '#718096',
          inverse: '#FFFFFF',
        },
        border: {
          light: '#E2E8F0',
          medium: '#CBD5E0',
        },
        cregis: {
          neutral: {
            50: '#F9F8F5',
            100: '#F1F5F9',
            200: '#E2E8F0',
            300: '#CBD5E0',
            400: '#94A3B8',
            500: '#64748B',
            600: '#475569',
            700: '#334155',
            800: '#1E293B',
            900: '#0F172A',
          },
        },
      },
      spacing: {
        sidebar: '280px',
        'ai-drawer': '400px',
        'container-max': '1280px',
      },
      borderRadius: {
        cregis: '8px',
      },
      boxShadow: {
        card: '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
        'card-hover':
          '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
        modal:
          '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'Helvetica Neue',
          'Arial',
          'sans-serif',
        ],
      },
      fontSize: {
        h1: ['32px', { lineHeight: '1.2', fontWeight: '800' }],
        h2: ['24px', { lineHeight: '1.3', fontWeight: '700' }],
        h3: ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        body: ['16px', { lineHeight: '1.6', fontWeight: '400' }],
        caption: ['14px', { lineHeight: '1.5', fontWeight: '400' }],
      },
    },
  },
  plugins: [typography, forms],
};

export default config;

