'use client';

import { useEffect, useMemo, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import type { Notification } from '@/lib/notifications/types';
import { Icon } from '@/components/icon';
import { markNotificationRead } from '@/app/actions/notifications';

function relativeTime(value: string) {
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<Notification[]>([]);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const unread = useMemo(() => items.filter((item) => !item.read_at).length, [items]);

  useEffect(() => {
    let mounted = true;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;

    async function connect() {
      const response = await fetch('/api/notifications', { cache: 'no-store' });
      if (response.ok) {
        const payload = await response.json();
        if (mounted) setItems(payload.notifications ?? []);
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !mounted) return;

      channel = supabase
        .channel(`notifications:${user.id}`)
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${user.id}`,
        }, (payload) => {
          if (!mounted) return;
          const next = payload.new as Notification;
          setItems((current) => [next, ...current.filter((item) => item.id !== next.id)].slice(0, 30));
        })
        .subscribe();
    }

    void connect();
    return () => {
      mounted = false;
      if (channel) void supabase.removeChannel(channel);
    };
  }, []);

  function openNotification(item: Notification) {
    if (!item.read_at) {
      const form = new FormData();
      form.set('notification_id', item.id);
      startTransition(async () => {
        const result = await markNotificationRead(form);
        if (result.success) setItems((current) => current.map((n) => n.id === item.id ? { ...n, read_at: new Date().toISOString() } : n));
      });
    }
    setOpen(false);
    if (item.href) router.push(item.href);
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((value) => !value)} className="relative rounded-xl p-2.5 text-slate-500 hover:bg-slate-100" aria-label="Notifications" aria-expanded={open}>
        <Icon name="bell" size={18} />
        {unread > 0 && <span className="absolute right-1.5 top-1.5 min-w-4 rounded-full bg-[var(--teal)] px-1 text-center text-[8px] font-black leading-4 text-[var(--navy)]">{unread > 9 ? '9+' : unread}</span>}
      </button>
      {open && <div className="absolute right-0 top-12 z-50 w-[min(390px,calc(100vw-24px))] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div><p className="text-sm font-bold text-slate-900">Notifications</p><p className="text-[10px] text-slate-400">Live updates from your work</p></div>
          <Link href="/notifications" onClick={() => setOpen(false)} className="text-[10px] font-bold text-teal-700">View all</Link>
        </div>
        <div className="max-h-[390px] overflow-y-auto">
          {items.length ? items.slice(0, 8).map((item) => <button key={item.id} onClick={() => openNotification(item)} className={`flex w-full gap-3 border-b border-slate-100 px-4 py-3 text-left transition hover:bg-slate-50 ${item.read_at ? '' : 'bg-teal-50/40'}`}>
            <span className={`mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl ${item.read_at ? 'bg-slate-100 text-slate-500' : 'bg-teal-100 text-teal-700'}`}><Icon name={item.type === 'TASK_ASSIGNED' ? 'check-square' : item.type === 'VISIT_PLANNED' ? 'map-pin' : item.type === 'EXPENSE_REVIEWED' ? 'receipt' : item.type === 'COMMISSION_CREATED' ? 'percent' : 'bell'} size={15} /></span>
            <span className="min-w-0 flex-1"><span className="flex items-start justify-between gap-3"><span className="text-xs font-bold text-slate-800">{item.title}</span><span className="shrink-0 text-[9px] text-slate-400">{relativeTime(item.created_at)}</span></span><span className="mt-1 block text-[10px] leading-4 text-slate-500">{item.body}</span></span>
          </button>) : <div className="px-6 py-10 text-center"><div className="mx-auto grid h-10 w-10 place-items-center rounded-xl bg-slate-100 text-slate-400"><Icon name="bell-off" size={18} /></div><p className="mt-3 text-xs font-semibold text-slate-700">You're all caught up</p><p className="mt-1 text-[10px] text-slate-400">New assignments and updates will appear here.</p></div>}
        </div>
        {isPending && <div className="border-t border-slate-100 px-4 py-2 text-[9px] text-slate-400">Updating…</div>}
      </div>}
    </div>
  );
}
