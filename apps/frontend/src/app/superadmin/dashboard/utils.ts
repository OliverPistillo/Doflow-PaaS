export const STAGE_CONFIG: Record<string, { label: string; color: string; badgeClass: string }> = {
  'Lead qualificato': { 
    label: 'Lead qualificato', 
    color: '#3b82f6', // blue-500
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200' 
  },
  'Preventivo inviato': { 
    label: 'Preventivo inviato', 
    color: '#eab308', // yellow-500
    badgeClass: 'bg-yellow-50 text-yellow-700 border-yellow-200' 
  },
  'Negoziazione': { 
    label: 'Negoziazione', 
    color: '#06b6d4', // cyan-500
    badgeClass: 'bg-cyan-50 text-cyan-700 border-cyan-200' 
  },
  'Chiuso vinto': { 
    label: 'Chiuso vinto', 
    color: '#10b981', // emerald-500
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200' 
  },
  'Chiuso perso': { 
    label: 'Chiuso perso', 
    color: '#ef4444', // red-500
    badgeClass: 'bg-red-50 text-red-700 border-red-200' 
  },
};

export const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('it-IT', { style: 'currency', currency: 'EUR' }).format(value);
};