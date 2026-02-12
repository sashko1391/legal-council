import type { Config } from 'tailwindcss'

/**
 * Legal Council - Final Design System
 * Based on consensus from 3 AI design experts:
 * - DeepSeek: Professional, restrained, trust-focused
 * - ChatGPT GPT-5.2: "Walk the tightrope" between expensive and serious
 * - Grok 4: Balance tradition and innovation
 * 
 * Consensus: Legal Tech Hybrid style
 * Philosophy: Trust > Wow, Clarity > Beauty, Speed > Animation
 */

const config: Config = {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    './src/shared/**/*.{js,ts,jsx,tsx,mdx}',
    './src/modules/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // ═══════════════════════════════════════════
        // BRAND COLORS (Unanimous: Deep Navy Blue)
        // ═══════════════════════════════════════════
        brand: {
          // Primary: #1E3A8A (DeepSeek + Grok consensus)
          primary: '#1E3A8A',
          'primary-dark': '#0F172A', // ChatGPT alternative
          
          // Secondary: Teal for secondary actions
          secondary: '#0F766E',
          
          // Accent
          accent: '#2563EB',
        },
        
        // ═══════════════════════════════════════════
        // RISK SEVERITY COLORS
        // Consensus: KEEP but reduce saturation 10-15%
        // ═══════════════════════════════════════════
        risk: {
          // Critical: Deep Crimson (ChatGPT recommendation)
          critical: '#BE123C',     // Was #DC2626
          criticalBg: '#FEF2F2',   // Light red background
          
          // High: Reduced saturation orange
          high: '#D97706',         // Was #EA580C
          highBg: '#FFF7ED',
          
          // Medium: Darker yellow
          medium: '#B8860B',       // Was #CA8A04
          mediumBg: '#FEFCE8',
          
          // Low: Keep as is (green works)
          low: '#15803D',          // No change
          lowBg: '#F0FDF4',
          
          // Safe: Keep as is
          safe: '#15803D',         // No change
          safeBg: '#ECFDF5',
        },
        
        // ═══════════════════════════════════════════
        // SEMANTIC COLORS
        // ═══════════════════════════════════════════
        success: '#15803D',
        warning: '#CA8A04',
        info: '#2563EB',
        error: '#DC2626',
        
        // ═══════════════════════════════════════════
        // BACKGROUNDS (All 3 agreed: off-white)
        // ═══════════════════════════════════════════
        background: {
          DEFAULT: '#FFFFFF',
          subtle: '#FAFAFA',       // DeepSeek + ChatGPT
          card: '#FFFFFF',
          // Dark mode (ChatGPT: "2 AM litigation prep")
          dark: '#020617',
          'dark-subtle': '#0F172A',
        },
        
        // ═══════════════════════════════════════════
        // TEXT COLORS
        // ═══════════════════════════════════════════
        text: {
          primary: '#0F172A',      // Slate 900
          secondary: '#6B7280',    // Cool Gray
          muted: '#9CA3AF',
          inverse: '#FFFFFF',
        },
        
        // ═══════════════════════════════════════════
        // BORDERS (Sharp 1px - no bubbles!)
        // ═══════════════════════════════════════════
        border: {
          DEFAULT: '#E5E7EB',      // Light gray
          strong: '#D1D5DB',       // Darker
          focus: '#2563EB',
        },
        
        // ═══════════════════════════════════════════
        // AGENT COLORS (for 4 AI agents)
        // ═══════════════════════════════════════════
        agent: {
          expert: '#2563EB',       // Blue
          provocateur: '#DC2626',  // Red
          validator: '#15803D',    // Green
          synthesizer: '#7C3AED',  // Purple
        },
      },
      
      // ═══════════════════════════════════════════
      // TYPOGRAPHY (Unanimous: Inter + IBM Plex Serif)
      // ═══════════════════════════════════════════
      fontFamily: {
        // UI elements (all 3 chose Inter)
        sans: ['Inter', 'PT Sans', 'system-ui', 'sans-serif'],
        
        // Contract display (DeepSeek: IBM Plex Serif)
        serif: ['IBM Plex Serif', 'PT Serif', 'Georgia', 'serif'],
        
        // Headings
        heading: ['Montserrat', 'Inter', 'sans-serif'],
        
        // Code/Technical
        mono: ['JetBrains Mono', 'Consolas', 'monospace'],
      },
      
      fontSize: {
        // Contract text (DeepSeek: 16-17px, Grok: min 14px)
        'contract': ['16px', { lineHeight: '1.75' }],
        
        // Standard sizes
        'xs': ['12px', { lineHeight: '1.5' }],
        'sm': ['14px', { lineHeight: '1.5' }],
        'base': ['16px', { lineHeight: '1.6' }],
        'lg': ['18px', { lineHeight: '1.6' }],
        'xl': ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.3' }],
        '3xl': ['32px', { lineHeight: '1.2' }],
        
        // Headings
        'heading-sm': ['20px', { lineHeight: '1.4', fontWeight: '600' }],
        'heading-md': ['24px', { lineHeight: '1.3', fontWeight: '600' }],
        'heading-lg': ['32px', { lineHeight: '1.2', fontWeight: '700' }],
      },
      
      // ═══════════════════════════════════════════
      // SPACING (ChatGPT: 24px around, 16px between)
      // ═══════════════════════════════════════════
      spacing: {
        'xs': '4px',
        'sm': '8px',
        'md': '16px',
        'lg': '24px',
        'xl': '32px',
        '2xl': '48px',
        '3xl': '64px',
      },
      
      // ═══════════════════════════════════════════
      // BORDER RADIUS (ChatGPT: 4-6px max, NO bubbles!)
      // ═══════════════════════════════════════════
      borderRadius: {
        'none': '0',
        'sm': '4px',      // Small elements
        'DEFAULT': '6px', // Default
        'md': '6px',      // Cards, inputs
        'lg': '8px',      // Large cards (only if needed)
        'full': '9999px', // Pills, badges only
      },
      
      // ═══════════════════════════════════════════
      // SHADOWS (Subtle, professional)
      // ═══════════════════════════════════════════
      boxShadow: {
        'sm': '0 1px 2px 0 rgb(0 0 0 / 0.05)',
        'DEFAULT': '0 1px 3px 0 rgb(0 0 0 / 0.1)',
        'md': '0 4px 6px -1px rgb(0 0 0 / 0.1)',
        'lg': '0 10px 15px -3px rgb(0 0 0 / 0.1)',
        'card': '0 2px 8px rgba(0, 0, 0, 0.08)',
        'none': 'none',
        
        // Focus states
        'focus': '0 0 0 3px rgba(37, 99, 235, 0.2)',
      },
      
      // ═══════════════════════════════════════════
      // ANIMATIONS (ChatGPT: Ease-out 150ms, NO bounce!)
      // ═══════════════════════════════════════════
      animation: {
        // Subtle animations only
        'fade-in': 'fadeIn 150ms ease-out',
        'slide-up': 'slideUp 150ms ease-out',
        'pulse-subtle': 'pulseSubtle 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        
        // Agent "thinking" animation
        'spin-slow': 'spin 3s linear infinite',
      },
      
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(10px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pulseSubtle: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.8' },
        },
      },
      
      // ═══════════════════════════════════════════
      // TRANSITIONS (All smooth, professional)
      // ═══════════════════════════════════════════
      transitionDuration: {
        'fast': '150ms',
        'normal': '200ms',
        'slow': '300ms',
      },
      
      transitionTimingFunction: {
        'ease-out': 'cubic-bezier(0, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    require('tailwindcss-animate'),
  ],
}

export default config
