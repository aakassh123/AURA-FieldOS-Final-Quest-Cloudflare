'use client';
import { useState } from 'react';
import { completeTask } from '@/app/actions/organization';

type Task = { id: string; title: string; task_type: string; due_at: string | null; priority: string; status: string; customer?: { name?: string } | null; lead?: { title?: string } | null };

function Mission({ task, position }: { task: Task; position: number }) {
  const [result, setResult] = useState<any>(null);
  const [completed, setCompleted] = useState(task.status === 'DONE');
  const done = completed;
  return <article className={`rounded-2xl border p-4 transition ${done ? 'border-emerald-200 bg-emerald-50/60' : 'border-slate-200 bg-white hover:border-teal-200 hover:shadow-sm'}`}>
    <div className="flex gap-4">
      <div className={`mt-1 grid h-9 w-9 shrink-0 place-items-center rounded-xl text-xs font-black ${done ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>{done ? '✓' : position}</div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div><p className="text-sm font-bold text-slate-900">{task.title}</p><p className="mt-1 text-[11px] text-slate-500">{task.customer?.name || task.lead?.title || 'General work'} · {task.task_type.replaceAll('_', ' ')}</p></div>
          <span className="rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{task.priority}</span>
        </div>
        <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
          <p className="text-[11px] text-slate-400">{task.due_at ? new Date(task.due_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : 'No due time'}</p>
          {done ? <span className="text-[11px] font-bold text-emerald-700">Completed</span> : <form action={async (fd) => { const next = await completeTask(fd); setResult(next); if (next.success) setCompleted(true); }}><input type="hidden" name="id" value={task.id}/><button className="rounded-xl bg-[var(--navy)] px-3.5 py-2 text-[11px] font-bold text-white hover:bg-[var(--navy-2)]">Complete mission →</button></form>}
        </div>
        {result?.error && <p className="mt-3 text-[11px] font-semibold text-red-600">{result.error}</p>}
        {result?.success && <div className="mt-3 rounded-xl bg-teal-50 p-3 text-teal-950"><p className="text-xs font-bold">Mission complete · +{result.xp_earned ?? 0} XP</p><p className="mt-1 text-[10px]">Level {result.level ?? 1} · {result.streak ?? 1} day streak</p>{result.reward_name ? <p className="mt-2 text-[11px] font-bold">🎁 Unlocked: {result.reward_name}{result.redemption_code ? ` · ${result.redemption_code}` : ''}</p> : <p className="mt-2 text-[10px]">No physical reward on this mission. Keep going toward the next unlock.</p>}</div>}
      </div>
    </div>
  </article>;
}

export function QuestBoard({ tasks }: { tasks: Task[] }) {
  const open = tasks.filter((t) => t.status !== 'DONE' && t.status !== 'CANCELLED');
  const done = tasks.filter((t) => t.status === 'DONE').length;
  return <div>
    <div className="mb-5 grid grid-cols-3 gap-3"><div className="rounded-2xl bg-slate-950 p-4 text-white"><p className="text-[10px] uppercase tracking-wider text-slate-400">Open missions</p><p className="mt-1 text-2xl font-black">{open.length}</p></div><div className="rounded-2xl bg-teal-50 p-4 text-teal-950"><p className="text-[10px] uppercase tracking-wider text-teal-700">Completed</p><p className="mt-1 text-2xl font-black">{done}</p></div><div className="rounded-2xl bg-amber-50 p-4 text-amber-950"><p className="text-[10px] uppercase tracking-wider text-amber-700">Next unlock</p><p className="mt-1 text-sm font-black">Keep completing</p></div></div>
    <div className="space-y-3">{tasks.map((task, index) => <Mission key={task.id} task={task} position={index + 1}/>)}</div>
    {tasks.length === 0 && <div className="rounded-2xl border border-dashed border-slate-300 p-12 text-center text-sm text-slate-500">No missions assigned yet.</div>}
  </div>;
}
