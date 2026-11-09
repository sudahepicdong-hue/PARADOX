import React from 'react';
import { CalendarClock } from 'lucide-react';
import { Talent } from '../types/talent';
import { LiveSchedule } from '../lib/db';
import { scheduleFormat } from './LiveScheduleManager';

interface UpcomingLivesProps {
  talents: Talent[]; // hanya talent yang tampil di publik
  schedules: LiveSchedule[];
  onOpenDetail: (talent: Talent) => void;
}

// Strip "Jadwal Live Berikutnya" di atas katalog
export const UpcomingLives: React.FC<UpcomingLivesProps> = ({ talents, schedules, onOpenDetail }) => {
  const items = schedules
    .map((s) => ({ s, t: talents.find((t) => t.id === s.talentId) }))
    .filter((x): x is { s: LiveSchedule; t: Talent } => Boolean(x.t) && !x.t!.isLive)
    .slice(0, 10);

  if (items.length === 0) return null;

  return (
    <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10">
      <h2 className="text-sm font-bold text-white flex items-center gap-2 mb-3">
        <CalendarClock className="w-4 h-4 text-red-400" /> Jadwal Live Berikutnya
      </h2>
      <div className="flex gap-3 overflow-x-auto pb-2">
        {items.map(({ s, t }) => (
          <button
            key={s.id}
            onClick={() => onOpenDetail(t)}
            className="shrink-0 w-56 flex items-center gap-3 p-3 rounded-xl bg-white/[0.03] hover:bg-white/[0.06] border border-white/10 text-left cursor-pointer"
          >
            <img
              src={t.media.find((m) => m.type === 'image')?.url}
              alt={t.name}
              className="w-11 h-11 rounded-full object-cover border border-red-500/40 shrink-0"
            />
            <div className="min-w-0">
              <div className="text-xs font-semibold text-white truncate">{t.name}</div>
              <div className="text-[11px] text-red-300">{scheduleFormat.format(new Date(s.startsAt))}</div>
              {s.note && <div className="text-[11px] text-slate-400 truncate">{s.note}</div>}
            </div>
          </button>
        ))}
      </div>
    </section>
  );
};
