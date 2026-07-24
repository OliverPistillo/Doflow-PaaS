import { commercialMoney } from "./commercial-utils";
import { CommercialSectionCard } from "./commercial-ui";

export function CommercialForecast({
  forecast,
  acquired,
}: {
  forecast: number;
  acquired: number;
}) {
  return (
    <CommercialSectionCard title="Previsioni del mese">
      <div className="flex h-[150px] items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50/70 px-6 text-center">
        <div>
          <p className="text-sm font-medium text-slate-700">Storico mensile non disponibile</p>
          <p className="mt-1 text-xs leading-5 text-slate-500">
            Il grafico apparirà quando il backend renderà disponibile una serie temporale reale.
          </p>
        </div>
      </div>
      <div className="mt-5 grid grid-cols-3 gap-3 border-t border-slate-100 pt-4">
        <div>
          <p className="text-xs text-slate-500">Obiettivo</p>
          <p className="mt-1 font-semibold text-slate-900">-</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Previsto</p>
          <p className="mt-1 font-semibold text-indigo-600">{commercialMoney(forecast)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-500">Acquisito</p>
          <p className="mt-1 font-semibold text-emerald-600">{commercialMoney(acquired)}</p>
        </div>
      </div>
    </CommercialSectionCard>
  );
}
