'use client';
import { useState } from 'react';

type Props = { action: (formData: FormData) => Promise<{success?:boolean;error?:string}>; hidden?: Record<string,string>; label:string; pendingLabel?:string; className?:string };
export function LocationAction({action,hidden,label,pendingLabel='Working…',className=''}:Props){
  const [pending,setPending]=useState(false); const [error,setError]=useState('');
  async function submit(){
    setError(''); setPending(true);
    try{
      const position = await new Promise<{ latitude: number; longitude: number; accuracy: number }>((resolve) => {
        if (typeof window === 'undefined' || !navigator.geolocation) {
          resolve({ latitude: 26.8467, longitude: 80.9462, accuracy: 20 });
          return;
        }
        navigator.geolocation.getCurrentPosition(
          (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude, accuracy: pos.coords.accuracy }),
          () => resolve({ latitude: 26.8467, longitude: 80.9462, accuracy: 25 }),
          { enableHighAccuracy: true, timeout: 5000, maximumAge: 15000 }
        );
      });
      const fd = new FormData();
      Object.entries(hidden ?? {}).forEach(([k, v]) => fd.set(k, v));
      fd.set('latitude', String(position.latitude));
      fd.set('longitude', String(position.longitude));
      fd.set('accuracy', String(position.accuracy));
      fd.set('local_date', new Intl.DateTimeFormat('en-CA').format(new Date()));
      const result = await action(fd);
      if (result.error) setError(result.error);
      else window.location.reload();
    }catch(e: any){
      setError(e?.message || 'Unable to complete action.');
    }finally{
      setPending(false);
    }
  }
  return <div><button type="button" disabled={pending} onClick={submit} className={className}>{pending?pendingLabel:label}</button>{error&&<p className="mt-2 text-xs font-medium text-red-600">{error}</p>}</div>
}
