import { redirect } from 'next/navigation';
import { getCurrentProfile } from '@/lib/auth/get-profile';
import { getCurrentUserEmail } from '@/lib/auth/get-current-user-email';
import { getRewardsPageData } from '@/lib/rewards/queries';
import { CrmShell } from '@/components/crm/crm-shell';
import { RewardAdmin } from '@/components/rewards/reward-admin';

export default async function RewardsPage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect('/login');
  if (!profile.company_id) redirect('/setup');
  const email = await getCurrentUserEmail();
  const data = await getRewardsPageData();
  const xp = data.progress?.xp_total ?? 0;
  const level = data.progress?.level ?? 1;
  const nextLevelXp = Math.pow(level, 2) * 100;
  const currentLevelBase = Math.pow(Math.max(level - 1, 0), 2) * 100;
  const progress = Math.min(100, Math.max(0, ((xp - currentLevelBase) / Math.max(1, nextLevelXp - currentLevelBase)) * 100));
  return <CrmShell email={email} name={profile.full_name ?? 'User'} role={profile.role} avatarUrl={profile.avatar_url} employeeCode={profile.employee_code}><main className="mx-auto max-w-[1300px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
    <header><p className="text-xs font-semibold uppercase tracking-[.16em] text-teal-700">AURA Quest</p><h1 className="mt-1 text-2xl font-bold tracking-tight text-slate-950">Work that feels like progress</h1><p className="mt-1 max-w-2xl text-sm text-slate-500">Complete meaningful work, earn XP, maintain your streak and unlock company-approved rewards. No fake points and no rewards for unsafe speed.</p></header>
    <section className="mt-6 grid gap-4 lg:grid-cols-[1.4fr_1fr_1fr]">
      <div className="rounded-2xl bg-[var(--navy)] p-5 text-white"><div className="flex items-end justify-between gap-4"><div><p className="text-[10px] uppercase tracking-wider text-slate-400">Current level</p><p className="mt-1 text-3xl font-black">Level {level}</p></div><p className="text-right text-sm font-bold">{xp} XP</p></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-white/10"><div className="h-full rounded-full bg-[var(--teal)]" style={{ width: `${progress}%` }}/></div><p className="mt-2 text-[10px] text-slate-400">{Math.max(0, nextLevelXp - xp)} XP to next level</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] uppercase tracking-wider text-slate-400">Streak</p><p className="mt-2 text-3xl font-black text-slate-950">🔥 {data.progress?.current_streak ?? 0}</p><p className="mt-1 text-xs text-slate-500">Best: {data.progress?.best_streak ?? 0} days</p></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><p className="text-[10px] uppercase tracking-wider text-slate-400">Unlocked rewards</p><p className="mt-2 text-3xl font-black text-slate-950">{data.claims.filter((c: any) => c.status === 'UNLOCKED').length}</p><p className="mt-1 text-xs text-slate-500">Use the redemption code with your company process.</p></div>
    </section>
    <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold text-slate-950">Unlocked rewards</h2><p className="mt-1 text-xs text-slate-500">Rewards are company-configured and budget-controlled.</p><div className="mt-4 space-y-3">{data.claims.map((claim: any) => <div key={claim.id} className="flex items-center justify-between gap-4 rounded-xl border border-slate-100 p-4"><div><p className="text-xs font-bold text-slate-900">{claim.reward?.name ?? 'Reward'}</p><p className="mt-1 text-[10px] text-slate-500">{claim.reward?.description}</p><p className="mt-2 text-[10px] font-semibold text-slate-400">Unlocked {new Date(claim.unlocked_at).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</p></div><div className="text-right"><p className="font-mono text-xs font-black text-teal-700">{claim.redemption_code}</p><span className="mt-1 inline-block rounded-full bg-slate-100 px-2 py-1 text-[9px] font-bold text-slate-500">{claim.status}</span></div></div>)}{!data.claims.length && <div className="rounded-xl bg-slate-50 p-8 text-center text-xs text-slate-500">Complete a qualifying mission to unlock your first reward.</div>}</div></div>
      <div className="rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold text-slate-950">How rewards work</h2><div className="mt-4 space-y-3">{data.rules.slice(0, 6).map((rule: any) => <div key={rule.id} className="rounded-xl bg-slate-50 p-3"><p className="text-xs font-bold text-slate-800">{rule.name}</p><p className="mt-1 text-[10px] text-slate-500">{rule.trigger_type.replaceAll('_',' ')}{rule.task_type ? ` · ${rule.task_type.replaceAll('_',' ')}` : ''} · +{rule.xp_amount} XP</p>{rule.reward?.name && <p className="mt-2 text-[10px] font-semibold text-teal-700">🎁 {rule.reward.name}</p>}</div>)}</div></div>
    </section>
    {['SUPER_ADMIN','COMPANY_ADMIN','SALES_MANAGER','HR_ACCOUNTS'].includes(profile.role) ? <RewardAdmin catalog={data.catalog}/> : null}
    <section className="mt-5 rounded-2xl border border-slate-200 bg-white p-5"><h2 className="text-sm font-bold text-slate-950">Reward catalog</h2><div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{data.catalog.map((reward: any) => <div key={reward.id} className="rounded-xl border border-slate-100 p-4"><p className="text-xs font-bold">{reward.name}</p><p className="mt-1 text-[10px] leading-5 text-slate-500">{reward.description}</p><p className="mt-2 text-[10px] font-bold text-slate-700">Budget value ₹{Number(reward.cost_inr).toLocaleString('en-IN')}</p></div>)}</div></section>
  </main></CrmShell>;
}
