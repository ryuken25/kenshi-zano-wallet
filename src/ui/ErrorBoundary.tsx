/**
 * React error boundary (§4). Wraps every screen so a thrown render never produces
 * a white screen — the user sees a recoverable card with a "Try again" action.
 */
import { Component, type ReactNode } from "react";
import { log } from "../core/logger";

interface Props {
  children: ReactNode;
  /** Optional label so the card can say which screen failed. */
  name?: string;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    // Logged locally + redacted; never transmitted (§5).
    log.error(`error boundary (${this.props.name ?? "screen"}):`, error.message);
  }

  private reset = () => this.setState({ error: null });

  render() {
    if (this.state.error) {
      return (
        <div className="card error-card" role="alert">
          <h3>Terjadi kesalahan</h3>
          <p className="muted">
            {this.props.name ? `Layar "${this.props.name}" ` : "Layar ini "}
            mengalami error, tapi wallet tetap aman.
          </p>
          <pre className="error-detail">{this.state.error.message}</pre>
          <button className="btn" onClick={this.reset}>
            Coba lagi
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
