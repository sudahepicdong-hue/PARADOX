import React, { useEffect, useState } from 'react';
import { CalendarClock, Trash2, Plus } from 'lucide-react';
import { fetchUpcomingSchedules, addSchedule, deleteSchedule, LiveSchedule } from '../lib/db';

const errorText = (e: unknown) => (e instanceof Error ? e.message : String((e as any)?.message ?? e));

export const scheduleFormat = new Intl.DateTimeFormat('id-ID', {
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit'
});

// Nilai awal input: besok jam 20:00 (waktu lokal)
const defaultInput = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(20, 0, 0, 0);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
};

// Talent / admin mengatur jadwal live yang tampil di katalog.
export const LiveScheduleManager: React.FC<{ talentId: string }> = ({ talentId }) => {
  const [items, setItems] = useState<LiveSchedule[]>([]);
  const [when, setWhen] = useState(defaultInput);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchUpcomingSchedules(talentId).then(setItems).catch((e) => setError(errorText(e)));
  }, [talentId]);

  const add = async (e: React.FormEvent) => {
    e.preventDefault();
    const date = new Date(when);
    if (Number.isNaN(date.getTime())) return;
    setBusy(true);
    setError('');
    try {
      const created = await addSchedule(talentId, date, note);
      setItems((prev) => [...prev, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)));
      setNote('');
    } catch (err) {
      setError(errorText(err));
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteSchedule(id);
      setItems((prev) => prev.filter((s) => s.id !== id));
    } catch (err) {
      setError(errorText(err));
    }
  };

  const inputClass =
    'px-3 py-2 rounded-lg bg-black/60 border border-white/10 text-xs text-white focus:outline-none focus:border-red-500';

  return (
    <div className="p-4 rounded-xl bg-black/40 border border-white/10 space-y-3">
      <div>
        <h5 className="text-sm font-bold text-white flex items-center gap-2">
          <CalendarClock className="w-4 h-4 text-red-400" /> Jadwal Live
        </h5>
        <p className="text-[11px] text-slate-400">Tampil di katalog & profil supaya pengunjung tahu kapan Anda live.</p>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-slate-500">Belum ada jadwal.</p>
      ) : (
        <div className="space-y-1.5">
          {items.map((s) => (
            <div key={s.id} className="flex items-center gap-3 p-2 rounded-lg bg-white/[0.03] border border-white/5 text-xs">
              <div className="flex-1">
                <div className="text-white font-semibold">{scheduleFormat.format(new Date(s.startsAt))}</div>
                {s.note && <div className="text-slate-400">{s.note}</div>}
              </div>
              <button onClick={() => remove(s.id)} className="p-1.5 rounded hover:bg-rose-500/20 text-rose-400 cursor-pointer" title="Hapus jadwal">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      <form onSubmit={add} className="flex flex-col sm:flex-row gap-2">
        <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} required className={inputClass} />
        <input
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={120}
          placeholder="Catatan (opsional), misal: Ngobrol santai"
          className={`${inputClass} flex-1`}
        />
        <button
          type="submit"
          disabled={busy}
          className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-600 hover:bg-red-500 text-white flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-3.5 h-3.5" /> Tambah
        </button>
      </form>

      {error && <p className="text-xs text-rose-300">{error}</p>}
    </div>
  );
};
