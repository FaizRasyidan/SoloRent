import { Calculator, TrendingUp } from 'lucide-react';
import { ReportBarChart } from '@/components/admin/reports/report-bar-chart';
import { SectionCard } from '@/components/admin/reports/report-shell';
import { KpiTile } from '@/components/admin/reports/report-kpi-tile';
import { ReportEmpty } from '@/components/admin/reports/report-states';
import { rupiah } from '@/lib/format';
import type { ForecastSection, ReportFilters } from '@/types/reports';

export function ForecastSectionView({
    section,
    filters: _filters,
}: {
    section: ForecastSection;
    filters: ReportFilters;
}) {
    void _filters;
    const { forecast } = section;

    if (!forecast.sufficient) {
        return (
            <div className="space-y-4">
                <ReportEmpty
                    title="Belum tersedia cukup data"
                    hint={`Forecast membutuhkan ${forecast.months_used} bulan kalender penuh riwayat booking. Data saat ini belum mencukupi.`}
                />
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <KpiTile
                    index={0}
                    icon={Calculator}
                    label="Rata-rata 3 Bulan"
                    value={rupiah(forecast.average_net ?? 0)}
                    hint={`Net booking revenue per bulan (${forecast.months_used} bulan penuh)`}
                />
                <KpiTile
                    index={1}
                    icon={TrendingUp}
                    tone="info"
                    label={forecast.forecast_label ?? 'Estimasi bulan depan'}
                    value={rupiah(forecast.forecast_next ?? 0)}
                    hint="Estimasi — bukan angka yang dijamin"
                />
            </div>

            <SectionCard
                index={2}
                title="Riwayat net revenue bulanan"
                subtitle="Moving average dari bulan kalender penuh (bulan berjalan dikecualikan)"
            >
                <ReportBarChart
                    items={forecast.history.map((h) => ({
                        label: h.label,
                        value: h.net,
                    }))}
                    formatValue={(n) => rupiah(Math.round(n))}
                    ariaLabel="Riwayat net revenue bulanan"
                />
                <p className="mt-3 text-[11px] text-slate-400">
                    Estimasi = rata-rata net (
                    {forecast.history.map((h) => rupiah(h.net)).join(' + ')}) ÷{' '}
                    {forecast.months_used}. Metode: moving average sederhana.
                </p>
            </SectionCard>
        </div>
    );
}
