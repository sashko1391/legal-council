/**
 * AGENTIS Logo Component
 * Design: Shield + Balance (scales of justice)
 * Represents legal protection and fair analysis
 */

interface LogoProps {
  size?: 'sm' | 'md' | 'lg'
  showText?: boolean
  className?: string
}

const SIZES = {
  sm: { width: 165, height: 33, iconScale: 0.75, fontSize: 16.5 },
  md: { width: 220, height: 44, iconScale: 1, fontSize: 22 },
  lg: { width: 275, height: 55, iconScale: 1.25, fontSize: 27.5 },
}

export function Logo({ size = 'md', showText = true, className = '' }: LogoProps) {
  const { width, height, iconScale, fontSize } = SIZES[size]
  
  if (!showText) {
    // Icon only version
    return (
      <svg
        width={36 * iconScale}
        height={36 * iconScale}
        viewBox="0 0 32 36"
        xmlns="http://www.w3.org/2000/svg"
        className={className}
        role="img"
        aria-label="AGENTIS"
      >
        {/* Shield */}
        <path d="M16 0 L32 6 V20 C32 28 16 36 16 36 C16 36 0 28 0 20 V6 Z" fill="#1E3A8A"/>
        
        {/* Balance scales - white for visibility */}
        <g fill="white">
          <rect x="15" y="8" width="2" height="16"/>
          <rect x="8" y="12" width="16" height="2"/>
          <rect x="6" y="14" width="4" height="2"/>
          <rect x="22" y="14" width="4" height="2"/>
        </g>
      </svg>
    )
  }
  
  return (
    <svg
      width={width}
      height={height}
      viewBox="0 0 220 44"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      role="img"
      aria-label="AGENTIS logo"
    >
      {/* Icon */}
      <g transform="translate(4,4)">
        {/* Shield */}
        <path d="M16 0 L32 6 V20 C32 28 16 36 16 36 C16 36 0 28 0 20 V6 Z" fill="#1E3A8A"/>
        
        {/* Balance scales - white for visibility on navy background */}
        <g fill="white">
          <rect x="15" y="8" width="2" height="16"/>
          <rect x="8" y="12" width="16" height="2"/>
          <rect x="6" y="14" width="4" height="2"/>
          <rect x="22" y="14" width="4" height="2"/>
        </g>
      </g>
      
      {/* Wordmark */}
      <text
        x="56"
        y="30"
        fontFamily="Inter, Montserrat, system-ui, sans-serif"
        fontSize={fontSize}
        fontWeight="600"
        letterSpacing="1.4"
        fill="#1E3A8A"
      >
        AGENTIS
      </text>
    </svg>
  )
}

/**
 * Favicon version - 32x32 icon only
 */
export function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 36"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="AGENTIS"
    >
      {/* Shield */}
      <path d="M16 0 L32 6 V20 C32 28 16 36 16 36 C16 36 0 28 0 20 V6 Z" fill="#1E3A8A"/>
      
      {/* Balance scales - white for visibility */}
      <g fill="white">
        <rect x="15" y="8" width="2" height="16"/>
        <rect x="8" y="12" width="16" height="2"/>
        <rect x="6" y="14" width="4" height="2"/>
        <rect x="22" y="14" width="4" height="2"/>
      </g>
    </svg>
  )
}
