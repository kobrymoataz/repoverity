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
        <span className="fatal-brand">REPOVERITY / STABLE RELEASE</span>
        <h1>The dashboard could not be displayed.</h1>
        <p>Your data is still stored locally in this browser. Try reloading the page; if the problem continues, open an issue with the reproduction steps. Do not post exported personal tracking backups publicly.</p>
        <button type="button" onClick={() => window.location.reload()}>Reload RepoVerity</button>
        <a href="https://github.com/kobrymoataz/repoverity/issues/new/choose" target="_blank" rel="noreferrer">Report an issue</a>
      </div>
    </main>
    return this.props.children
  }
}
