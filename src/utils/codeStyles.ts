export function getCodeCellClasses(code: string): string {
  switch (code) {
    case 'H':
      return 'bg-emerald-100/90 text-emerald-900 border border-emerald-300/70 font-semibold';
    case 'B':
      return 'bg-sky-100/90 text-sky-900 border border-sky-300/70 font-semibold';
    case 'H+B':
      return 'bg-blue-900 text-white border border-blue-700 font-semibold shadow-sm';
    case 'I':
      return 'bg-amber-100/90 text-amber-900 border border-amber-300/70 font-semibold';
    case 'S':
      return 'bg-orange-100/90 text-orange-900 border border-orange-300/70 font-semibold';
    case 'A':
      return 'bg-rose-100/90 text-rose-900 border border-rose-300/70 font-semibold';
    case 'L':
      return 'bg-slate-200/85 text-slate-700 border border-slate-300/80 font-medium';
    default:
      return 'text-slate-400';
  }
}

export const CODE_LEGEND = [
  { code: 'H', label: 'Hadir (1 poin)', cls: 'bg-emerald-100 text-emerald-900 border border-emerald-300' },
  { code: 'B', label: 'Badal (1 poin)', cls: 'bg-sky-100 text-sky-900 border border-sky-300' },
  { code: 'H+B', label: 'Hadir + Badal (2 poin)', cls: 'bg-blue-900 text-white border border-blue-700' },
  { code: 'I', label: 'Izin (0 poin)', cls: 'bg-amber-100 text-amber-900 border border-amber-300' },
  { code: 'S', label: 'Sakit (0 poin)', cls: 'bg-orange-100 text-orange-900 border border-orange-300' },
  { code: 'A', label: 'Alpa (0 poin)', cls: 'bg-rose-100 text-rose-900 border border-rose-300' },
  { code: 'L', label: 'Libur (0 poin)', cls: 'bg-slate-200 text-slate-700 border border-slate-300' },
];
