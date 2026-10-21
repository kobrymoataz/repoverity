import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { gsap } from 'gsap'
import { MOTION_TIMING } from '../lib/motionPreferences'

/** One controlled GSAP sequence. No parallax, loops, or ScrollTrigger dependencies. */
export function OverviewReveal({ children, reduced }: { children: ReactNode; reduced: boolean }) {
  const scope = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    if (reduced || !scope.current) return
    const context = gsap.context(() => {
      gsap.fromTo(
        '.rv-profile-card, .rv-metrics, .rv-insights-grid, .rv-table-panel',
        { opacity: 0, y: 8 },
        {
          opacity: 1, y: 0, duration: MOTION_TIMING.intro,
          ease: 'power2.out', stagger: 0.065,
          clearProps: 'opacity,transform', overwrite: 'auto',
        },
      )
    }, scope)
    return () => context.revert()
  }, [reduced])

  return <div ref={scope} className="rv-overview-reveal">{children}</div>
}
