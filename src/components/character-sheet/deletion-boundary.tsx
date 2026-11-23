'use client';
import { Component, type ReactNode } from 'react';

// The sheet's own subscription fails as soon as its Character is deleted,
// before the deletion's reply arrives. While a deletion is in flight that
// failure is the expected outcome and shows the fallback; any other failure
// goes on to the route's error boundary, where a missing Character and an
// inaccessible one read the same.
export class DeletionBoundary extends Component<
  { isDeleting: boolean; fallback: ReactNode; children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error === null) return this.props.children;
    if (this.props.isDeleting) return this.props.fallback;
    throw this.state.error;
  }
}
