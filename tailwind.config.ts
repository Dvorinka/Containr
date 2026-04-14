import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        border: 'rgb(var(--border) / <alpha-value>)',
        input: 'rgb(var(--input) / <alpha-value>)',
        ring: 'rgb(var(--ring) / <alpha-value>)',
        background: 'rgb(var(--background) / <alpha-value>)',
        foreground: 'rgb(var(--foreground) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--primary) / <alpha-value>)',
          foreground: 'rgb(var(--primary-foreground) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'rgb(var(--secondary) / <alpha-value>)',
          foreground: 'rgb(var(--secondary-foreground) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'rgb(var(--destructive) / <alpha-value>)',
          foreground: 'rgb(var(--destructive-foreground) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--muted) / <alpha-value>)',
          foreground: 'rgb(var(--muted-foreground) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--accent) / <alpha-value>)',
          foreground: 'rgb(var(--accent-foreground) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'rgb(var(--popover) / <alpha-value>)',
          foreground: 'rgb(var(--popover-foreground) / <alpha-value>)',
        },
        card: {
          DEFAULT: 'rgb(var(--card) / <alpha-value>)',
          foreground: 'rgb(var(--card-foreground) / <alpha-value>)',
        },
        success: {
          DEFAULT: 'rgb(var(--success) / <alpha-value>)',
          foreground: 'rgb(var(--success-foreground) / <alpha-value>)',
        },
        warning: {
          DEFAULT: 'rgb(var(--warning) / <alpha-value>)',
          foreground: 'rgb(var(--warning-foreground) / <alpha-value>)',
        },
        info: {
          DEFAULT: 'rgb(var(--info) / <alpha-value>)',
          foreground: 'rgb(var(--info-foreground) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'Fira Code', 'Consolas', 'monospace'],
        geist: ['Geist', 'Inter', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '-0.025em' }],
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '-0.03em' }],
        '5xl': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.035em' }],
      },
      boxShadow: {
        'glow': '0 0 20px rgb(var(--primary) / 0.15)',
        'glow-lg': '0 0 40px rgb(var(--primary) / 0.2)',
        'glow-xl': '0 0 60px rgb(var(--primary) / 0.25)',
        'glow-success': '0 0 20px rgb(var(--success) / 0.15)',
        'glow-warning': '0 0 20px rgb(var(--warning) / 0.15)',
        'glow-destructive': '0 0 20px rgb(var(--destructive) / 0.15)',
        'card': '0 1px 3px 0 rgb(0 0 0 / 0.08), 0 1px 2px -1px rgb(0 0 0 / 0.08)',
        'card-hover': '0 10px 40px -10px rgb(0 0 0 / 0.2)',
        'card-elevated': '0 4px 20px -2px rgb(0 0 0 / 0.1), 0 2px 8px -2px rgb(0 0 0 / 0.05)',
        'sidebar': '0 0 40px rgb(0 0 0 / 0.08)',
        'dropdown': '0 4px 24px -4px rgb(0 0 0 / 0.15), 0 2px 8px -2px rgb(0 0 0 / 0.1)',
        'modal': '0 8px 40px -8px rgb(0 0 0 / 0.25), 0 4px 16px -4px rgb(0 0 0 / 0.15)',
        'inner-glow': 'inset 0 1px 0 0 rgb(255 255 255 / 0.05)',
        'elevated': '0 2px 8px -2px rgb(0 0 0 / 0.1), 0 4px 20px -4px rgb(0 0 0 / 0.08)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'fade-in-up': 'fadeInUp 0.4s ease-out',
        'fade-in-down': 'fadeInDown 0.4s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'slide-in-left': 'slideInLeft 0.3s ease-out',
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'slide-in-down': 'slideInDown 0.3s ease-out',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s linear infinite',
        'spin-slow': 'spin 3s linear infinite',
        'bounce-subtle': 'bounceSubtle 2s ease-in-out infinite',
        'gradient-x': 'gradientX 3s ease infinite',
        'float': 'float 6s ease-in-out infinite',
        'ping': 'ping 1s cubic-bezier(0, 0, 0.2, 1) infinite',
        'wiggle': 'wiggle 0.5s ease-in-out infinite',
        'border-glow': 'borderGlow 2s ease-in-out infinite',
        'notification': 'notificationPulse 2s ease-in-out infinite',
        'gradient-shift': 'gradientShift 3s ease infinite',
        'tooltip-in': 'tooltipFadeIn 0.15s ease-out',
        'popover-in': 'popoverFadeIn 0.15s ease-out',
        'modal-in': 'modalFadeIn 0.2s ease-out',
        'dropdown-in': 'dropdownFadeIn 0.15s ease-out',
        'command-in': 'commandPaletteIn 0.15s ease-out',
        'bounce-gentle': 'bounceGentle 1s ease-in-out infinite',
        'glow-pulse': 'glowPulse 3s ease-in-out infinite',
        'rotate-slow': 'rotateSlow 20s linear infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeInDown: {
          '0%': { opacity: '0', transform: 'translateY(-10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        scaleIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        slideInDown: {
          '0%': { transform: 'translateY(-100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 20px rgb(var(--primary) / 0.3)' },
          '50%': { boxShadow: '0 0 40px rgb(var(--primary) / 0.5)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-5px)' },
        },
        gradientX: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        wiggle: {
          '0%, 100%': { transform: 'rotate(-3deg)' },
          '50%': { transform: 'rotate(3deg)' },
        },
        borderGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgb(var(--primary) / 0.3)' },
          '50%': { boxShadow: '0 0 20px rgb(var(--primary) / 0.5)' },
        },
        notificationPulse: {
          '0%, 100%': { transform: 'scale(1)', boxShadow: '0 0 0 0 rgb(var(--destructive) / 0.4)' },
          '50%': { transform: 'scale(1.05)', boxShadow: '0 0 0 8px rgb(var(--destructive) / 0)' },
        },
        gradientShift: {
          '0%, 100%': { backgroundPosition: '0% 50%' },
          '50%': { backgroundPosition: '100% 50%' },
        },
        tooltipFadeIn: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        popoverFadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95) translateY(-4px)' },
          '100%': { opacity: '1', transform: 'scale(1) translateY(0)' },
        },
        modalFadeIn: {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        dropdownFadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        commandPaletteIn: {
          '0%': { opacity: '0', transform: 'scale(0.96)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        bounceGentle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-3px)' },
        },
        glowPulse: {
          '0%, 100%': { 
            boxShadow: '0 0 20px rgb(var(--primary) / 0.2)',
            transform: 'scale(1)'
          },
          '50%': { 
            boxShadow: '0 0 40px rgb(var(--primary) / 0.4)',
            transform: 'scale(1.02)'
          },
        },
        rotateSlow: {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-conic': 'conic-gradient(from 180deg at 50% 50%, var(--tw-gradient-stops))',
        'shimmer-gradient': 'linear-gradient(90deg, transparent, rgb(var(--muted) / 0.1), transparent)',
        'dot-pattern': 'radial-gradient(circle, rgb(var(--border) / 0.5) 1px, transparent 1px)',
        'grid-pattern': 'linear-gradient(rgb(var(--border) / 0.3) 1px, transparent 1px), linear-gradient(to right, rgb(var(--border) / 0.3) 1px, transparent 1px)',
        'glow-burst': 'radial-gradient(circle at center, rgb(var(--primary) / 0.15), transparent 70%)',
        'gradient-primary': 'linear-gradient(135deg, rgb(var(--primary)), rgb(var(--gradient-end)))',
        'gradient-card': 'linear-gradient(to bottom right, rgb(var(--card)), rgb(var(--muted) / 0.3))',
        'mesh-gradient': 'radial-gradient(at 40% 20%, rgb(var(--primary) / 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgb(var(--gradient-end) / 0.06) 0px, transparent 50%)',
      },
      backgroundSize: {
        'dot': '20px 20px',
        'grid': '40px 40px',
      },
      transitionDuration: {
        '400': '400ms',
      },
      transitionTimingFunction: {
        'bounce-in': 'cubic-bezier(0.68, -0.55, 0.265, 1.55)',
        'smooth': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'snappy': 'cubic-bezier(0.2, 0, 0, 1)',
      },
      scale: {
        '102': '1.02',
        '98': '0.98',
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
      },
      zIndex: {
        '60': '60',
        '70': '70',
        '80': '80',
        '90': '90',
        '100': '100',
      },
    },
  },
  plugins: [],
}

export default config
