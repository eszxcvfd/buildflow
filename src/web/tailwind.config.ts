import type { Config } from 'tailwindcss';

/**
 * DashCode palette port (stage 1 foundation).
 * Canonical source: /home/trung/Downloads/theme/dashcode/tailwind.config.cjs.
 * `gray` overrides Tailwind's default gray with the DashCode slate-like ramp
 * (500 #68768A … 900 #0F172A); the default `slate` scale is left intact.
 */
const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: {
        DEFAULT: '15px',
        sm: '15px',
        lg: '15px',
        xl: '0',
        '2xl': '0',
      },
      screens: {
        sm: '640px',
        md: '768px',
        lg: '1024px',
        xl: '1280px',
        '2xl': '1280px',
      },
    },
    extend: {
      colors: {
        primary: {
          50: '#F6F8FF',
          100: '#EDF0FF',
          200: '#D1DAFE',
          300: '#B4C2FD',
          400: '#8092FF',
          500: '#4669FA',
          600: '#3F5EDF',
          700: '#2A3F96',
          800: '#203071',
          900: '#151F49',
        },
        danger: {
          50: '#FFF7F7',
          100: '#FEEFEF',
          200: '#FCD6D7',
          300: '#FABBBD',
          400: '#F68B8D',
          500: '#F1595C',
          600: '#D75052',
          700: '#913638',
          800: '#6D292A',
          900: '#461A1B',
        },
        warning: {
          50: '#FFFAF8',
          100: '#FFF4F1',
          200: '#FEE4DA',
          300: '#FDD2C3',
          400: '#FCB298',
          500: '#FA916B',
          600: '#DF8260',
          700: '#965741',
          800: '#714231',
          900: '#492B20',
        },
        info: {
          50: '#F3FEFF',
          100: '#E7FEFF',
          200: '#C5FDFF',
          300: '#A3FCFF',
          400: '#5FF9FF',
          500: '#0CE7FA',
          600: '#00B8D4',
          700: '#007A8D',
          800: '#005E67',
          900: '#003F42',
        },
        success: {
          50: '#F3FEF8',
          100: '#E7FDF1',
          200: '#C5FBE3',
          300: '#A3F9D5',
          400: '#5FF5B1',
          500: '#50C793',
          600: '#3F9A7A',
          700: '#2E6D61',
          800: '#1F4B47',
          900: '#0F2A2E',
        },
        gray: {
          50: '#F9FAFB',
          100: '#F4F5F7',
          200: '#E5E7EB',
          300: '#D2D6DC',
          400: '#9FA6B2',
          500: '#68768A',
          600: '#475569',
          700: '#334155',
          800: '#1E293B',
          900: '#0F172A',
        },
      },
      fontFamily: {
        inter: ['var(--font-inter)', 'var(--font-be-vietnam-pro)', 'sans-serif'],
        mono: ['var(--font-jetbrains-mono)', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        base: '0px 0px 1px rgba(40, 41, 61, 0.08), 0px 0.5px 2px rgba(96, 97, 112, 0.16)',
        base2: '0px 2px 4px rgba(40, 41, 61, 0.04), 0px 8px 16px rgba(96, 97, 112, 0.16)',
        base3: '16px 10px 40px rgba(15, 23, 42, 0.22)',
        dropdown: '0px 4px 8px rgba(0, 0, 0, 0.08)',
      },
    },
  },
  plugins: [],
};

export default config;
