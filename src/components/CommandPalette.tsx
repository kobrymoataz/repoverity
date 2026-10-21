import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowRight, Search, X } from 'lucide-react'
import { searchCommands } from '../lib/commandSearch'
import { MOTION_TIMING } from '../lib/motionPreferences'
import type { WorkspaceId } from '../lib/navigation'

interface CommandPaletteProps {
  open: boolean
  close: () => void
  navigate: (id: WorkspaceId) => void
  reduced: boolean
}

export function CommandPalette({ open, close, navigate, reduced }: CommandPaletteProps) {
  const [query, setQuery] = useState('')
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  const returnFocus = useRef<HTMLElement | null>(null)
  const choices = useMemo(() => searchCommands(query), [query])

  useEffect(() => {
    if (!open) return
    returnFocus.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setQuery('')
    setSelected(0)
    const frame = window.requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      window.cancelAnimationFrame(frame)
      returnFocus.current?.focus()
    }
  }, [open])

  function keyboard(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Escape') { event.preventDefault(); close(); return }
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setSelected(value => choices.length ? (value + 1) % choices.length : 0)
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setSelected(value => choices.length ? (value - 1 + choices.length) % choices.length : 0)
    }
    if (event.key === 'Enter' && choices[selected]) {
      event.preventDefault()
      navigate(choices[selected].id)
    }
    if (event.key === 'Tab') {
      const nodes = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>('input:not([disabled]),button:not([disabled])') ?? [])
      const first = nodes[0], last = nodes.at(-1)
      if (!first || !last) return
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
  }

  return <AnimatePresence initial={false}>
    {open && <motion.div key="quick-switch-overlay" className="rv-command-overlay" role="presentation"
      initial={reduced ? false : { opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: reduced ? 0 : MOTION_TIMING.exit }}
      onMouseDown={event => { if (event.target === event.currentTarget) close() }}>
      <motion.div ref={dialogRef} className="rv-command-dialog" role="dialog" aria-modal="true" aria-labelledby="rv-command-title"
        onKeyDown={keyboard}
        initial={reduced ? false : { opacity: 0, y: -10, scale: .99 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={reduced ? { opacity: 0 } : { opacity: 0, y: -6, scale: .99 }}
        transition={{ duration: reduced ? 0 : MOTION_TIMING.navigate, ease: 'easeOut' }}>
        <div className="rv-command-title-row"><span id="rv-command-title">Quick switch</span><button type="button" aria-label="Close quick switch" onClick={close}><X size={18}/></button></div>
        <label className="rv-command-search"><Search size={19}/><input ref={inputRef} value={query}
          onChange={event => { setQuery(event.target.value); setSelected(0) }}
          aria-label="Search workspaces" role="combobox" aria-expanded="true"
          aria-controls="rv-command-options" aria-activedescendant={choices[selected] ? `rv-command-${choices[selected].id}` : undefined}
          placeholder="Search workspaces and tools..." autoComplete="off"/></label>
        <div id="rv-command-options" className="rv-command-results" role="listbox" aria-label="Workspace results">
          {choices.map((item, index) => <button type="button" role="option" id={`rv-command-${item.id}`} key={item.id}
            aria-selected={index === selected} className={selected === index ? 'rv-command-selected' : ''}
            onMouseEnter={() => setSelected(index)} onClick={() => navigate(item.id)}>
            <span><strong>{item.label}</strong><small>{item.category}</small></span><ArrowRight size={16}/>
          </button>)}
          {choices.length === 0 && <p className="rv-command-empty">No matching workspace. Try a different search.</p>}
        </div>
        <div className="rv-command-footer"><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span><span><kbd>Enter</kbd> Open</span><span><kbd>Esc</kbd> Close</span></div>
      </motion.div>
    </motion.div>}
  </AnimatePresence>
}
