import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class TrackerErrorBoundary extends Component<Props, State> {
  override state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override componentDidCatch(error: Error, info: { componentStack: string }) {
    console.error('[TrackerErrorBoundary]', error, info.componentStack);
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '48px 24px', textAlign: 'center' }}>
          <p style={{ fontSize: 16, color: 'var(--color-text-secondary, #666)', marginBottom: 16 }}>
            Something went wrong.
          </p>
          <button
            style={{ padding: '8px 20px', borderRadius: 8, border: '1px solid #ccc', cursor: 'pointer' }}
            onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
