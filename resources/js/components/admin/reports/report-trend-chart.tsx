import { useId, useMemo, useState } from 'react';
import { rupiahCompact } from '@/lib/format';
import { cn } from '@/lib/utils';

export type TrendExtra = {
    label: string;
    value: number;
    format: (n: number) => string;
};

export type TrendDatum = {
    key: string;
    label: string;
    value: number;
    extra?: TrendExtra[];
};

const W = 720;
const H = 250;
const PAD = { top: 30, right: 12, bottom: 32, left: 48 };

function niceCeiling(v: number): number {
    if (v <= 0) return 1;
    const pow = Math.pow(10, Math.floor(Math.log10(v)));
    const n = v / pow;
    const m = n <= 1 ? 1.25 : n <= 2 ? 2.5 : n <= 2.5 ? 3 : n <= 5 ? 6 : 12;
    return m * pow;
}

function formatTick(v: number, money: boolean): string {
    if (money) return rupiahCompact(Math.round(v));
    if (Number.isInteger(v)) return String(v);
    return String(Math.round(v * 10) / 10);
}

/**
 * Line chart satu seri: segmen lurus (bukan spline) agar selisih
 * antarhari terbaca; label sumbu X dijarangkan; tooltip berupa
 * overlay HTML yang di-clamp di dalam kotak chart.
 */
export function ReportTrendChart({
    data,
    formatValue,
    money = false,
    color = '#E8730C',
    fillOpacity = 0.1,
    ariaLabel,
    emptyText = 'Belum ada data pada periode ini.',
    height = H,
}: {
    data: TrendDatum[];
    formatValue: (n: number) => string;
    money?: boolean;
    color?: string;
    fillOpacity?: number;
    ariaLabel: string;
    emptyText?: string;
    /** Tinggi viewBox SVG — dashboard memakai nilai compact agar rapat. */
    height?: number;
}) {
    const uid = useId().replace(/[^a-zA-Z0-9]/g, '');
    const [hover, setHover] = useState<number | null>(null);

    const geom = useMemo(() => {
        if (data.length === 0) return null;
        const innerW = W - PAD.left - PAD.right;
        const innerH = height - PAD.top - PAD.bottom;
        const max = Math.max(0, ...data.map((d) => d.value));
        const ceiling = niceCeiling(max);
        const x = (i: number) =>
            PAD.left + (innerW * i) / Math.max(1, data.length - 1);
        const y = (v: number) => PAD.top + innerH - (innerH * v) / ceiling;
        const ticks = [0, ceiling / 3, (ceiling * 2) / 3, ceiling];
        // Jarangkan label X: maksimal ~8, label terakhir selalu tampil.
        const step = Math.max(1, Math.ceil(data.length / 8));
        const showLabel = (i: number) =>
            i % step === 0 || i === data.length - 1;
        const peakIdx = data.reduce(
            (best, d, i) => (d.value > data[best].value ? i : best),
            0,
        );
        return {
            innerW,
            innerH,
            max,
            ceiling,
            x,
            y,
            ticks,
            showLabel,
            peakIdx,
            base: PAD.top + innerH,
        };
    }, [data, height]);

    if (data.length === 0 || !geom) {
        return (
            <p className="py-10 text-center text-sm text-slate-500">
                {emptyText}
            </p>
        );
    }

    const points = data.map((d, i) => ({ x: geom.x(i), y: geom.y(d.value) }));
    const line = points
        .map(
            (p, i) =>
                `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)},${p.y.toFixed(1)}`,
        )
        .join(' ');
    const area = `${line} L ${points[points.length - 1].x.toFixed(1)},${geom.base} L ${points[0].x.toFixed(1)},${geom.base} Z`;
    const total = data.reduce((s, d) => s + d.value, 0);
    const active = hover !== null ? data[hover] : null;
    const activePct = hover !== null ? (geom.x(hover) / W) * 100 : 0;
    const clampedPct = Math.min(88, Math.max(12, activePct));

    return (
        <div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 font-semibold text-slate-700 tabular-nums">
                    Total periode · {formatValue(total)}
                </span>
                {data.length > 0 && geom.max > 0 && (
                    <span className="ml-auto text-slate-400 tabular-nums">
                        Tertinggi {data[geom.peakIdx].label} ·{' '}
                        {formatValue(data[geom.peakIdx].value)}
                    </span>
                )}
            </div>

            <div className="relative mt-2" onMouseLeave={() => setHover(null)}>
                <svg
                    viewBox={`0 0 ${W} ${height}`}
                    role="img"
                    aria-label={ariaLabel}
                    className="w-full"
                    onMouseMove={(e) => {
                        const rect = (
                            e.currentTarget as SVGSVGElement
                        ).getBoundingClientRect();
                        const px = e.clientX - rect.left;
                        const frac = (px / rect.width) * W;
                        let best = 0;
                        let bestDist = Infinity;
                        points.forEach((p, i) => {
                            const dist = Math.abs(p.x - frac);
                            if (dist < bestDist) {
                                bestDist = dist;
                                best = i;
                            }
                        });
                        setHover(best);
                    }}
                >
                    {geom.ticks.map((t, i) => (
                        <g key={i}>
                            <line
                                x1={PAD.left}
                                x2={W - PAD.right}
                                y1={geom.y(t)}
                                y2={geom.y(t)}
                                stroke="#E2E8F0"
                                strokeWidth={1}
                                strokeDasharray={t === 0 ? undefined : '4 4'}
                            />
                            <text
                                x={PAD.left - 8}
                                y={geom.y(t) + 4}
                                textAnchor="end"
                                fontSize={11}
                                fill="#94A3B8"
                                fontWeight={500}
                            >
                                {formatTick(t, money)}
                            </text>
                        </g>
                    ))}

                    <path d={area} fill={color} fillOpacity={fillOpacity} />
                    <path
                        d={line}
                        fill="none"
                        stroke={color}
                        strokeWidth={2.5}
                        strokeLinecap="round"
                        strokeLinejoin="round"
                    />

                    {points.map((p, i) => (
                        <g key={data[i].key}>
                            <title>{`${data[i].label}: ${formatValue(data[i].value)}`}</title>
                            <circle
                                cx={p.x}
                                cy={p.y}
                                r={
                                    i === hover
                                        ? 5.5
                                        : i === geom.peakIdx
                                          ? 5
                                          : 3.5
                                }
                                fill="#fff"
                                stroke={color}
                                strokeWidth={2.5}
                                tabIndex={0}
                                role="img"
                                aria-label={`${data[i].label}: ${formatValue(data[i].value)}`}
                                onFocus={() => setHover(i)}
                                className="cursor-pointer outline-none focus:stroke-slate-900"
                            />
                            {i === geom.peakIdx &&
                                data[i].value > 0 &&
                                p.y - 16 >= 10 && (
                                    <text
                                        x={Math.min(Math.max(p.x, 70), W - 70)}
                                        y={p.y - 14}
                                        textAnchor="middle"
                                        fontSize={11}
                                        fontWeight={700}
                                        fill="#0F172A"
                                    >
                                        {formatValue(data[i].value)}
                                    </text>
                                )}
                            {geom.showLabel(i) && (
                                <text
                                    x={p.x}
                                    y={height - 10}
                                    textAnchor="middle"
                                    fontSize={11}
                                    fill={
                                        i === data.length - 1
                                            ? '#0F172A'
                                            : '#94A3B8'
                                    }
                                    fontWeight={
                                        i === data.length - 1 ? 700 : 500
                                    }
                                >
                                    {data[i].label}
                                </text>
                            )}
                        </g>
                    ))}

                    {hover !== null && (
                        <line
                            x1={points[hover].x}
                            x2={points[hover].x}
                            y1={PAD.top - 6}
                            y2={geom.base}
                            stroke={color}
                            strokeWidth={1}
                            strokeDasharray="3 3"
                            opacity={0.6}
                        />
                    )}
                </svg>

                {active && hover !== null && (
                    <div
                        role="status"
                        className={cn(
                            'pointer-events-none absolute top-0 z-10 w-48 -translate-x-1/2 rounded-xl border border-slate-200 bg-white px-3.5 py-3 shadow-lg',
                        )}
                        style={{ left: `${clampedPct}%` }}
                        aria-live="polite"
                    >
                        <p className="text-[11px] font-semibold tracking-wide text-slate-400 uppercase">
                            {active.label}
                        </p>
                        <p className="mt-1 text-lg font-bold tracking-tight text-slate-900 tabular-nums">
                            {formatValue(active.value)}
                        </p>
                        {active.extra && active.extra.length > 0 && (
                            <dl className="mt-2 space-y-1 border-t border-slate-100 pt-2 text-xs">
                                {active.extra.map((e) => (
                                    <div
                                        key={e.label}
                                        className="flex items-center justify-between gap-2"
                                    >
                                        <dt className="text-slate-500">
                                            {e.label}
                                        </dt>
                                        <dd className="font-semibold text-slate-800 tabular-nums">
                                            {e.format(e.value)}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        )}
                    </div>
                )}
            </div>

            <table className="sr-only">
                <caption>{ariaLabel}</caption>
                <tbody>
                    {data.map((d) => (
                        <tr key={`${uid}-${d.key}`}>
                            <th scope="row">{d.label}</th>
                            <td>{formatValue(d.value)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
