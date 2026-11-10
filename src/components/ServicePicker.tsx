import React from 'react';
import { Check } from 'lucide-react';
import { SERVICE_OPTIONS } from '../lib/services';

// Pilihan centang layanan talent
export const ServicePicker: React.FC<{ value: string[]; onChange: (v: string[]) => void }> = ({ value, onChange }) => {
  const toggle = (label: string) =>
    onChange(value.includes(label) ? value.filter((v) => v !== label) : [...value, label]);

  return (
    <div className="flex flex-wrap gap-2">
      {SERVICE_OPTIONS.map((s) => {
        const on = value.includes(s.label);
        return (
          <button
            key={s.label}
            type="button"
            onClick={() => toggle(s.label)}
            className={`px-3 py-2 rounded-lg text-xs font-semibold border flex items-center gap-1.5 cursor-pointer transition-colors ${
              on ? 'bg-amber-400/20 border-amber-400/50 text-amber-200' : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
            }`}
          >
            <span
              className={`w-4 h-4 rounded border flex items-center justify-center ${
                on ? 'bg-amber-400 border-amber-400' : 'border-white/30'
              }`}
            >
              {on && <Check className="w-3 h-3 text-black" />}
            </span>
            {s.label}
          </button>
        );
      })}
    </div>
  );
};
