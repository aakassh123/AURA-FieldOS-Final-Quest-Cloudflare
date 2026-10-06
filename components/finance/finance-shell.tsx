'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createDeal, submitExpense, reviewExpense } from '@/app/actions/finance';
import type { Expense } from '@/lib/finance/types';
function Button({children}:{children:React.ReactNode}){return <button className="rounded-xl bg-[var(--navy)] px-4 py-2.5 text-sm font-semibold text-white hover:opacity-90">{children}</button>}
export function ExpenseForm({ redirectTo }: { redirectTo?: string } = {}) {
  const router = useRouter();
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);

  const handleSubmit = async (fd: FormData) => {
    setPending(true);
    const r = await submitExpense(fd);
    setPending(false);
    if (r.error) {
      setMessage(r.error);
    } else {
      setMessage('Expense submitted successfully.');
      if (redirectTo) {
        router.push(redirectTo);
        router.refresh();
      }
    }
  };

  return (
    <form action={handleSubmit} className="grid gap-4 md:grid-cols-2">
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Category</label>
        <select name="category" defaultValue="TRAVEL" className="input">
          <option>TRAVEL</option>
          <option>FUEL</option>
          <option>MEALS</option>
          <option>LODGING</option>
          <option>PHONE</option>
          <option>OFFICE</option>
          <option>OTHER</option>
        </select>
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Date</label>
        <input className="input" type="date" name="expense_date" defaultValue={new Date().toISOString().slice(0, 10)} />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Amount (₹)</label>
        <input required className="input" name="amount" type="number" min="1" step="0.01" placeholder="1240" />
      </div>
      <div>
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Merchant / Vendor</label>
        <input className="input" name="merchant" placeholder="Fuel station / hotel / restaurant" />
      </div>
      <div className="md:col-span-2">
        <label className="mb-1.5 block text-xs font-semibold text-slate-700">Description</label>
        <input required className="input" name="description" placeholder="Fuel for client meeting at Gomti Nagar" />
      </div>
      <div className="md:col-span-2 flex items-center justify-between gap-3 pt-2">
        <p className="text-xs text-slate-500">Receipt and reimbursement records are audited under company finance policy.</p>
        <button disabled={pending} className="rounded-xl bg-[var(--navy)] px-5 py-2.5 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50">
          {pending ? 'Submitting…' : 'Submit expense'}
        </button>
      </div>
      {message && <p className="md:col-span-2 text-xs font-semibold text-teal-700">{message}</p>}
    </form>
  );
}
export function ExpenseReview({expense}:{expense:Expense}){const [busy,setBusy]=useState(false);const review=async(status:'APPROVED'|'REJECTED')=>{setBusy(true);const fd=new FormData();fd.set('expense_id',expense.id);fd.set('status',status);fd.set('approved_amount',String(expense.amount));const r=await reviewExpense(fd);setBusy(false);if(r.error)alert(r.error);else location.reload();};return <div className="flex gap-2"><button disabled={busy} onClick={()=>review('APPROVED')} className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-semibold text-emerald-700">Approve</button><button disabled={busy} onClick={()=>review('REJECTED')} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700">Reject</button></div>}
export function DealForm({employees}:{employees:{id:string;full_name:string}[]}){const [message,setMessage]=useState('');return <form action={async fd=>{const r=await createDeal(fd);setMessage(r.error??'Deal recorded.');}} className="grid gap-4 md:grid-cols-4"><div className="md:col-span-2"><label>Deal / sale</label><input className="input" name="title" placeholder="Hotel Sunrise annual software deal"/></div><div><label>Revenue</label><input className="input" name="revenue_amount" type="number" min="0" step="0.01" placeholder="240000"/></div><div><label>Owner</label><select className="input" name="owner_employee_id">{employees.map(e=><option key={e.id} value={e.id}>{e.full_name}</option>)}</select></div><div><label>Status</label><select className="input" name="status"><option>WON</option><option>OPEN</option><option>LOST</option></select></div><div className="md:col-span-3 flex items-end"><p className="text-xs text-slate-500">Won deals snapshot the active commission rate.</p></div><div className="flex justify-end"><Button>Record deal</Button></div>{message&&<p className="md:col-span-4 text-sm text-slate-600">{message}</p>}</form>}
