import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { RouteErrorBoundary } from '../layout/ErrorBoundary';

/** dok. 02 §9: halaman yang gagal tidak boleh ikut menjatuhkan rute berikutnya. */
function Boom(): never {
  throw new Error('render gagal');
}

describe('RouteErrorBoundary (dok. 02 §9)', () => {
  it('pindah rute membersihkan error; rerender di rute yang sama tidak', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { rerender } = render(
      <RouteErrorBoundary resetKey="/stats">
        <Boom />
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('Tampilan ini gagal dimuat.')).toBeInTheDocument();
    expect(screen.getByText(/tidak ada data yang dihapus/)).toBeInTheDocument();

    rerender(
      <RouteErrorBoundary resetKey="/stats">
        <p>sehat</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('Tampilan ini gagal dimuat.')).toBeInTheDocument();

    rerender(
      <RouteErrorBoundary resetKey="/practice">
        <p>sehat</p>
      </RouteErrorBoundary>,
    );
    expect(screen.getByText('sehat')).toBeInTheDocument();
    vi.restoreAllMocks();
  });
});
