import { Component, ErrorInfo, ReactNode } from 'react'

type State = { error: Error | null }

// If any screen crashes, show a message and a restart button instead of a blank window.
export class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[screen crashed]', error, info.componentStack)
  }

  render(): ReactNode {
    if (!this.state.error) return this.props.children
    return (
      <div className="center-msg">
        Something went wrong
        <p>{this.state.error.message}</p>
        <button className="btn primary" style={{ marginTop: 24 }} onClick={() => window.location.reload()}>
          Restart the booth screen
        </button>
      </div>
    )
  }
}