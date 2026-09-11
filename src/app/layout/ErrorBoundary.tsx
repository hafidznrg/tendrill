import { Component, type ErrorInfo, type ReactNode } from 'react';

/**
 * Satu ErrorBoundary di level rute (dok. 06 §7). Tombolnya memuat ulang
 * TAMPILAN, bukan menghapus data pengguna — kesalahan render di /stats
 * tidak boleh menjatuhkan layar sesi.
 */
interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class RouteErrorBoundary extends Component<Props, State> {
  override state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[tendrill] render gagal', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.error) return this.props.children;
    return (
      <div className="rounded border border-line bg-surface p-6">
        <h2 className="font-mono text-[19px] font-bold tracking-[-0.02em]">
          Tampilan ini gagal dimuat.
        </h2>
        <p className="mt-2 text-fg-dim">Progresmu aman — tidak ada data yang dihapus.</p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="mt-4 rounded bg-accent px-4 py-2 font-mono text-[13px] font-bold text-bg"
        >
          Muat ulang tampilan
        </button>
      </div>
    );
  }
}
