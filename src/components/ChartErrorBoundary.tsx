import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
}

/** Keeps a chart throw from unmounting the surrounding detail page (M-42). */
export class ChartErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(_error: Error, _info: ErrorInfo): void {
    // Intentionally quiet — UI fallback is enough for the desk.
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            fontSize: 11,
            color: "#3a3a5a",
            fontFamily: "monospace",
            textAlign: "center",
            padding: 24,
          }}
        >
          {this.props.fallbackLabel ?? "CHART UNAVAILABLE"}
        </div>
      );
    }
    return this.props.children;
  }
}
