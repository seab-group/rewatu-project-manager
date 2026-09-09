/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        cyan: {
          DEFAULT: '#00D2F5',
          50: '#E6FAFE',
          600: '#00B4D4',
          // Text-only step. #00B4D4 is 2.5:1 on white — fine as a fill, not as
          // a link. Links and coloured labels use this instead.
          link: '#007B91',
          chart: '#0092AD',
        },
        violet: {
          DEFAULT: '#7B5CFA',
          50: '#F0EDFE',
          600: '#5B3FE0',
        },
        indigo: {
          DEFAULT: '#33307C',
          800: '#26235C',
        },
        ink: {
          DEFAULT: '#1B2430',
          muted: '#5C6672',
          // Darkened from the brand's #97A1AC, which is 2.5:1 on canvas. Kept
          // as `ink-ghost` for decoration, where contrast does not apply.
          faint: '#676D75',
          ghost: '#97A1AC',
        },
        line: '#E3E8ED',
        canvas: '#F6F8FA',
        surface: '#FFFFFF',
        success: { DEFAULT: '#1E7A52', bg: '#DFF1E7' },
        warning: { DEFAULT: '#966210', bg: '#FCEFD6' },
        danger: { DEFAULT: '#A32020', bg: '#FBE5E5' },
        neutral: { DEFAULT: '#5E6D83', bg: '#EDF0F3' },
      },
      borderRadius: { card: '16px' },
      boxShadow: {
        card: '0 1px 2px rgba(27, 36, 48, 0.04), 0 1px 3px rgba(27, 36, 48, 0.04)',
        raised: '0 4px 12px rgba(27, 36, 48, 0.08), 0 1px 3px rgba(27, 36, 48, 0.04)',
        pop: '0 12px 32px rgba(27, 36, 48, 0.16), 0 2px 8px rgba(27, 36, 48, 0.08)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      backgroundImage: {
        'rw-gradient': 'linear-gradient(135deg, #00D2F5, #7B5CFA)',
      },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '-800px 0' }, '100%': { backgroundPosition: '800px 0' } },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'scale-in': { from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' }, to: { opacity: '1', transform: 'translateY(0) scale(1)' } },
        'slide-in-left': { from: { transform: 'translateX(-100%)' }, to: { transform: 'translateX(0)' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        'fade-in': 'fade-in 140ms ease-out',
        'scale-in': 'scale-in 160ms cubic-bezier(0.16,1,0.3,1)',
        'slide-in-left': 'slide-in-left 200ms cubic-bezier(0.16,1,0.3,1)',
      },
    },
  },
  plugins: [],
};
