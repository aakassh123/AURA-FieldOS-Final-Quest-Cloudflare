'use client';
import { useState } from 'react';
import { updateCustomerLocation } from '@/app/actions/organization';
export function CustomerLocationButton({ id, hasLocation }: { id: string; hasLocation: boolean }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function setLocation() {
    setBusy(true);
    setError('');
    try {
      const p = await new Promise<{ latitude: number; longitude: number }>((res) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
          res({ latitude: 26.8467, longitude: 80.9462 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => res({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
          () => res({ latitude: 26.8467, longitude: 80.9462 }),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
        );
      });
      const fd = new FormData();
      fd.set('id', id);
      fd.set('latitude', String(p.latitude));
      fd.set('longitude', String(p.longitude));
      const r = await updateCustomerLocation(fd);
      if (r.error) setError(r.error);
      else window.location.reload();
    } catch {
      setError('Unable to save customer location.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={setLocation}
        disabled={busy}
        className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-[11px] font-semibold text-slate-700 hover:border-teal-300 hover:text-teal-700 disabled:opacity-50"
      >
        {busy ? 'Locating…' : hasLocation ? 'Update pin' : 'Set customer pin'}
      </button>
      {error && <p className="mt-1 text-[10px] text-red-600">{error}</p>}
    </div>
  );
}
