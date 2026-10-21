import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { failed: boolean }

/** A recoverable fallback for unexpected rendering errors, with no telemetry. */
export class AppErrorBoundary extends Component<Props, State> {
  state: State = { failed: false }

  static getDerivedStateFromError(): State {
    return { failed: true }
  }

  componentDidCatch(error: Error) {
    console.error('RepoVerity display error:', error)
  }

  render() {
    if (this.state.failed) return <main className="fatal-error" role="alert">
      <div className="fatal-error-inner">
        <span className="fatal-brand">REPOVERITY / APPLICATION ERROR</span>
        <h1>The workspace could not be displayed.</h1>
        <p>Try reloading the workspace. Your locally stored tracking data is not deleted by a display error. If the problem continues, report the steps to reproduce it without sharing personal data or backup files.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload RepoVerity</button>
        <a href="https://github.com/kobrymoataz/repoverity/issues/new/choose" target="_blank" rel="noreferrer">Report an issue</a>
      </div>
    </main>
    return this.props.children
  }
}
