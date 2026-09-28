import { Head, Link, router } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    ArrowUpDown,
    Bike,
    CalendarDays,
    CarFront,
    Cog,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Star,
    Users,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    AvailabilityBadge,
    VehicleImage,
} from '@/components/customer/vehicle-image';
import { useReveal } from '@/hooks/use-reveal';
import { formatRangeID, rupiah } from '@/lib/format';
import type { VehicleDTO } from '@/types/catalog';

type Category = 'Semua' | 'motor' | 'mobil';
type SortKey = 'rekomendasi' | 'termurah' | 'termahal' | 'rating' | 'nama';

const sortOptions: Array<[SortKey, string]> = [
    ['rekomendasi', 'Rekomendasi'],
    ['termurah', 'Harga terendah'],
    ['termahal', 'Harga tertinggi'],
    ['rating', 'Rating tertinggi'],
    ['nama', 'Nama A–Z'],
];

const PRICE_MIN = 50000;
const PRICE_MAX = 1000000;

function fmtTrips(n: number): string {
    if (n >= 1000) {
        return `${(n / 1000).toLocaleString('id-ID', { maximumFractionDigits: 1 })} rb trip`;
    }
    return `${n} trip`;
}

function FilterGroups({
    category,
    setCategory,
    maxPrice,
    setMaxPrice,
    transmissions,
    toggleTransmission,
    seatOptions,
    seats,
    toggleSeat,
    onlyAvailable,
    setOnlyAvailable,
    reset,
}: {
    category: Category;
    setCategory: (c: Category) => void;
    maxPrice: number;
    setMaxPrice: (n: number) => void;
    transmissions: string[];
    toggleTransmission: (t: string) => void;
    seatOptions: number[];
    seats: number[];
    toggleSeat: (s: number) => void;
    onlyAvailable: boolean;
    setOnlyAvailable: (v: boolean) => void;
    reset: () => void;
}) {
    return (
        <div className="space-y-7">
            <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">
                    Kategori
                </p>
                <div className="mt-3 flex flex-wrap gap-2">
                    {(
                        [
                            ['Semua', null],
                            ['motor', Bike],
                            ['mobil', CarFront],
                        ] as Array<[Category, typeof Bike | null]>
                    ).map(([c, Icon]) => (
                        <button
                            key={c}
                            onClick={() => setCategory(c)}
                            aria-pressed={category === c}
                            className={`pressable flex items-center gap-1.5 rounded-full px-4 py-2 text-[13px] font-semibold transition-[background-color,color,border-color] duration-200 ease-out ${
                                category === c
                                    ? 'bg-[#FF9137] text-[#241203]'
                                    : 'border border-[#241203]/15 bg-white text-stone-600'
                            }`}
                        >
                            {Icon && <Icon size={14} />}
                            {c === 'Semua'
                                ? 'Semua'
                                : c === 'motor'
                                  ? 'Motor'
                                  : 'Mobil'}
                        </button>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">
                    Harga per hari
                </p>
                <p className="mt-3 text-sm font-bold tabular-nums">
                    s/d {rupiah(maxPrice)}
                </p>
                <input
                    type="range"
                    min={PRICE_MIN}
                    max={PRICE_MAX}
                    step={25000}
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(Number(e.target.value))}
                    aria-label="Batas harga maksimum per hari"
                    className="mt-2 w-full accent-[#FF9137]"
                />
                <div className="flex justify-between text-[11px] text-stone-400 tabular-nums">
                    <span>{rupiah(PRICE_MIN)}</span>
                    <span>{rupiah(PRICE_MAX)}</span>
                </div>
            </div>

            <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">
                    Transmisi
                </p>
                <div className="mt-3 space-y-2.5">
                    {['automatic', 'manual'].map((t) => (
                        <label
                            key={t}
                            className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-stone-700"
                        >
                            <input
                                type="checkbox"
                                checked={transmissions.includes(t)}
                                onChange={() => toggleTransmission(t)}
                                className="h-4 w-4 rounded accent-[#FF9137]"
                            />
                            {t === 'automatic' ? 'Automatic' : 'Manual'}
                        </label>
                    ))}
                </div>
            </div>

            <div>
                <p className="text-[11px] font-bold tracking-[0.14em] text-stone-500 uppercase">
                    Kapasitas
                </p>
                <div className="mt-3 space-y-2.5">
                    {seatOptions.map((s) => (
                        <label
                            key={s}
                            className="flex cursor-pointer items-center gap-2.5 text-sm font-medium text-stone-700"
                        >
                            <input
                                type="checkbox"
                                checked={seats.includes(s)}
                                onChange={() => toggleSeat(s)}
                                className="h-4 w-4 rounded accent-[#FF9137]"
                            />
                            {s} Orang
                        </label>
                    ))}
                </div>
            </div>

            <label className="flex cursor-pointer items-start gap-2.5 rounded-2xl border border-[#241203]/10 bg-white p-4">
                <input
                    type="checkbox"
                    checked={onlyAvailable}
                    onChange={(e) => setOnlyAvailable(e.target.checked)}
                    className="mt-0.5 h-4 w-4 rounded accent-[#FF9137]"
                />
                <span className="text-sm font-medium text-stone-700">
                    Hanya tampilkan kendaraan tersedia
                </span>
            </label>

            <button
                onClick={reset}
                className="pressable flex w-full items-center justify-center gap-2 rounded-full border border-[#241203]/15 bg-white py-2.5 text-[13px] font-semibold"
            >
                <RotateCcw size={14} />
                Reset filter
            </button>
        </div>
    );
}

export type CatalogFilters = {
    category: string | null;
    start_date: string | null;
    end_date: string | null;
};

export default function Vehicles({ vehicles, filters }: { vehicles: VehicleDTO[]; filters?: CatalogFilters }) {
    useReveal();
    const [search, setSearch] = useState('');
    const [category, setCategory] = useState<Category>(() =>
        filters?.category === 'mobil' ? 'mobil' : filters?.category === 'motor' ? 'motor' : 'Semua',
    );
    // Periode dari landing page: server sudah menghitung period_available
    // per kendaraan, katalog hanya menampilkan yang tersedia.
    const [period, setPeriod] = useState<{ start: string; end: string } | null>(() =>
        filters?.start_date && filters?.end_date ? { start: filters.start_date, end: filters.end_date } : null,
    );
    const [periodStart, setPeriodStart] = useState(filters?.start_date ?? '');
    const [periodEnd, setPeriodEnd] = useState(filters?.end_date ?? '');
    const [maxPrice, setMaxPrice] = useState(PRICE_MAX);
    const [transmissions, setTransmissions] = useState<string[]>([
        'automatic',
        'manual',
    ]);
    const seatOptions = useMemo(
        () =>
            Array.from(new Set(vehicles.map((v) => v.seats))).sort(
                (a, b) => a - b,
            ),
        [vehicles],
    );
    const [seats, setSeats] = useState<number[]>(seatOptions);
    const [onlyAvailable, setOnlyAvailable] = useState(false);
    const [sort, setSort] = useState<SortKey>('rekomendasi');
    const [sheetOpen, setSheetOpen] = useState(false);
    const [sheetShown, setSheetShown] = useState(false);

    // Sinkron saat server mengembalikan filter baru (ganti tanggal di banner).
    useEffect(() => {
        setPeriod(
            filters?.start_date && filters?.end_date
                ? { start: filters.start_date, end: filters.end_date }
                : null,
        );
        setPeriodStart(filters?.start_date ?? '');
        setPeriodEnd(filters?.end_date ?? '');
        if (filters?.category === 'motor' || filters?.category === 'mobil') {
            setCategory(filters.category);
        }
    }, [filters?.category, filters?.start_date, filters?.end_date]);

    useEffect(() => {
        setSeats(seatOptions);
    }, [seatOptions]);

    useEffect(() => {
        if (!sheetOpen) return;
        const t = window.setTimeout(() => setSheetShown(true), 20);
        document.body.style.overflow = 'hidden';
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setSheetOpen(false);
        };
        window.addEventListener('keydown', onKey);
        return () => {
            window.clearTimeout(t);
            setSheetShown(false);
            document.body.style.overflow = '';
            window.removeEventListener('keydown', onKey);
        };
    }, [sheetOpen]);

    const toggleTransmission = (t: string) =>
        setTransmissions((prev) =>
            prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
        );
    const toggleSeat = (s: number) =>
        setSeats((prev) =>
            prev.includes(s) ? prev.filter((x) => x !== s) : [...prev, s],
        );
    const reset = () => {
        setCategory('Semua');
        setMaxPrice(PRICE_MAX);
        setTransmissions(['automatic', 'manual']);
        setSeats(seatOptions);
        setOnlyAvailable(false);
        setSearch('');
        setSort('rekomendasi');
        if (period) {
            router.get('/vehicles', {}, { preserveState: false });
        }
    };

    const applyPeriod = () => {
        if (!periodStart || !periodEnd || periodEnd < periodStart) return;
        router.get(
            '/vehicles',
            {
                ...(category !== 'Semua' ? { category } : {}),
                start_date: periodStart,
                end_date: periodEnd,
            },
            { preserveScroll: true },
        );
    };

    const clearPeriod = () => {
        router.get(
            '/vehicles',
            { ...(category !== 'Semua' ? { category } : {}) },
            { preserveScroll: true },
        );
    };

    const filtered = useMemo(() => {
        const q = search.trim().toLowerCase();
        const list = vehicles.filter(
            (v) =>
                (category === 'Semua' || v.category === category) &&
                v.price_per_day <= maxPrice &&
                transmissions.includes(v.transmission) &&
                seats.includes(v.seats) &&
                (!onlyAvailable || v.availability !== 'unavailable') &&
                // Periode dari landing: hanya yang tersedia pada tanggal itu.
                (!period || (v.period_available ?? 0) > 0) &&
                (q === '' || v.name.toLowerCase().includes(q)),
        );
        const sorted = [...list];
        switch (sort) {
            case 'termurah':
                sorted.sort((a, b) => a.price_per_day - b.price_per_day);
                break;
            case 'termahal':
                sorted.sort((a, b) => b.price_per_day - a.price_per_day);
                break;
            case 'rating':
                sorted.sort((a, b) => b.rating - a.rating);
                break;
            case 'nama':
                sorted.sort((a, b) => a.name.localeCompare(b.name, 'id'));
                break;
            default:
                break;
        }
        return sorted;
    }, [
        vehicles,
        search,
        category,
        maxPrice,
        transmissions,
        seats,
        onlyAvailable,
        period,
        sort,
    ]);

    const filterProps = {
        category,
        setCategory,
        maxPrice,
        setMaxPrice,
        transmissions,
        toggleTransmission,
        seatOptions,
        seats,
        toggleSeat,
        onlyAvailable,
        setOnlyAvailable,
        reset,
    };

    return (
        <>
            <Head title="Katalog Kendaraan — Rental Motor & Mobil Solo" />
            <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                >
                    <ArrowLeft size={16} /> Kembali ke Beranda
                </Link>

                <div className="mt-6 flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
                    <div>
                        <p className="text-[11px] font-bold tracking-[0.18em] text-stone-500 uppercase">
                            Katalog Kendaraan
                        </p>
                        <h1 className="mt-2 max-w-md text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">
                            Temukan kendaraan untuk perjalananmu
                        </h1>
                        <p className="mt-2 text-[15px] text-stone-500">
                            Pilih kendaraan terawat dengan harga transparan di
                            Solo.
                        </p>
                    </div>
                    <div className="relative w-full md:w-72">
                        <Search
                            size={17}
                            className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-stone-400"
                        />
                        <input
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                            placeholder="Cari kendaraan..."
                            aria-label="Cari kendaraan"
                            className="h-12 w-full rounded-full border border-[#241203]/15 bg-white pr-4 pl-10 text-sm font-medium outline-none placeholder:text-stone-400 focus:border-[#FF9137]"
                        />
                    </div>
                </div>

                {period && (
                    <div className="mt-6 flex flex-col gap-3 rounded-3xl border border-[#0B6B4F]/20 bg-emerald-50/70 p-4 sm:flex-row sm:items-center">
                        <div className="flex items-center gap-2.5">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-[#0B6B4F] text-white">
                                <CalendarDays size={16} />
                            </span>
                            <div>
                                <p className="text-sm font-bold">
                                    Tersedia {formatRangeID(period.start, period.end)}
                                </p>
                                <p className="text-xs text-stone-500">
                                    {filtered.length} kendaraan · {category === 'Semua' ? 'semua kategori' : category} · hanya yang tersedia
                                </p>
                            </div>
                        </div>
                        <div className="flex flex-1 flex-wrap items-center gap-2 sm:justify-end">
                            <input
                                type="date"
                                value={periodStart}
                                onChange={(e) => setPeriodStart(e.target.value)}
                                aria-label="Ubah tanggal mulai"
                                className="h-10 rounded-xl border border-[#241203]/15 bg-white px-3 text-[13px] font-semibold outline-none focus:border-[#0B6B4F]"
                            />
                            <span className="text-sm text-stone-400">–</span>
                            <input
                                type="date"
                                value={periodEnd}
                                min={periodStart}
                                onChange={(e) => setPeriodEnd(e.target.value)}
                                aria-label="Ubah tanggal selesai"
                                className="h-10 rounded-xl border border-[#241203]/15 bg-white px-3 text-[13px] font-semibold outline-none focus:border-[#0B6B4F]"
                            />
                            <button
                                onClick={applyPeriod}
                                className="pressable h-10 rounded-xl bg-[#241203] px-4 text-[13px] font-semibold text-white"
                            >
                                Terapkan
                            </button>
                            <button
                                onClick={clearPeriod}
                                className="pressable h-10 rounded-xl border border-[#241203]/15 bg-white px-4 text-[13px] font-semibold"
                            >
                                Hapus
                            </button>
                        </div>
                    </div>
                )}

                <div className="sticky top-16 z-30 -mx-5 mt-6 flex gap-2.5 border-y border-[#241203]/10 bg-[#F7F2EB]/90 px-5 py-3 backdrop-blur-md sm:top-[72px] lg:hidden">
                    <button
                        onClick={() => setSheetOpen(true)}
                        className="pressable flex flex-1 items-center justify-center gap-2 rounded-full border border-[#241203]/15 bg-white py-2.5 text-[13px] font-semibold"
                    >
                        <SlidersHorizontal size={15} />
                        Filter
                    </button>
                    <label className="flex flex-1 items-center justify-center gap-2 rounded-full bg-[#241203] py-2.5 text-[13px] font-semibold text-white">
                        <ArrowUpDown size={15} />
                        <select
                            value={sort}
                            onChange={(e) => setSort(e.target.value as SortKey)}
                            aria-label="Urutkan kendaraan"
                            className="bg-transparent outline-none [&>option]:text-black"
                        >
                            {sortOptions.map(([k, label]) => (
                                <option key={k} value={k}>
                                    {label}
                                </option>
                            ))}
                        </select>
                    </label>
                </div>

                <div className="mt-8 grid gap-8 lg:grid-cols-[250px_1fr]">
                    <aside className="hidden lg:block">
                        <div className="sticky top-24 rounded-3xl border border-[#241203]/10 bg-white p-6">
                            <FilterGroups {...filterProps} />
                        </div>
                    </aside>

                    <div>
                        <div className="hidden items-center justify-between lg:flex">
                            <p className="text-sm text-stone-500">
                                <strong className="text-[#241203]">
                                    {filtered.length}
                                </strong>{' '}
                                kendaraan ditemukan
                            </p>
                            <label className="flex items-center gap-2 text-sm font-medium text-stone-600">
                                <ArrowUpDown size={15} />
                                <select
                                    value={sort}
                                    onChange={(e) =>
                                        setSort(e.target.value as SortKey)
                                    }
                                    aria-label="Urutkan kendaraan"
                                    className="rounded-full border border-[#241203]/15 bg-white px-4 py-2 text-[13px] font-semibold outline-none focus:border-[#FF9137]"
                                >
                                    {sortOptions.map(([k, label]) => (
                                        <option key={k} value={k}>
                                            {label}
                                        </option>
                                    ))}
                                </select>
                            </label>
                        </div>

                        {filtered.length === 0 ? (
                            <div className="mt-6 rounded-3xl border border-dashed border-[#241203]/20 bg-white p-14 text-center">
                                <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#F7F2EB]">
                                    <Search
                                        size={24}
                                        className="text-stone-400"
                                    />
                                </span>
                                <h2 className="mt-5 text-lg font-bold">
                                    {period ? 'Tidak ada yang tersedia di tanggal itu' : 'Tidak ada kendaraan yang sesuai'}
                                </h2>
                                <p className="mx-auto mt-2 max-w-xs text-sm leading-6 text-stone-500">
                                    {period
                                        ? 'Coba ubah tanggal atau kategori kendaraan.'
                                        : 'Coba ubah filter atau tanggal rental.'}
                                </p>
                                <button
                                    onClick={reset}
                                    className="pressable mt-6 inline-flex items-center gap-2 rounded-full bg-[#FF9137] px-6 py-3 text-sm font-semibold text-[#241203]"
                                >
                                    <RotateCcw size={15} />
                                    Reset Filter
                                </button>
                            </div>
                        ) : (
                            <div
                                key={`${category}-${sort}-${onlyAvailable}-${period?.start ?? ''}-${period?.end ?? ''}`}
                                className="mt-6 grid gap-5 sm:grid-cols-2 xl:grid-cols-3"
                            >
                                {filtered.map((v, i) => {
                                    // Saat filter tanggal aktif, badge mengikuti
                                    // ketersediaan periode tersebut.
                                    const status = period
                                        ? (v.period_available ?? 0) > 1
                                            ? 'available'
                                            : (v.period_available ?? 0) === 1
                                              ? 'limited'
                                              : 'unavailable'
                                        : v.availability;
                                    const dead = status === 'unavailable';
                                    const rentalHref = period
                                        ? `/booking/${v.slug}?start_date=${period.start}&end_date=${period.end}`
                                        : `/booking/${v.slug}`;
                                    return (
                                        <article
                                            key={v.slug}
                                            style={{
                                                animationDelay: `${Math.min(i, 8) * 60}ms`,
                                            }}
                                            className="animate-fade-up lift img-zoom group flex flex-col overflow-hidden rounded-3xl border border-[#241203]/10 bg-white"
                                        >
                                            <div className="relative">
                                                <VehicleImage
                                                    src={v.image_url}
                                                    alt={v.name}
                                                    category={v.category}
                                                    className="h-52 w-full"
                                                />
                                                <div className="absolute top-3.5 left-3.5">
                                                    <AvailabilityBadge
                                                        status={status}
                                                    />
                                                </div>
                                                <span className="absolute top-3.5 right-3.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                                                    {v.category === 'motor'
                                                        ? 'Motor'
                                                        : 'Mobil'}
                                                </span>
                                            </div>
                                            <div
                                                className={`flex flex-1 flex-col p-5 ${dead ? 'opacity-70' : ''}`}
                                            >
                                                <div className="flex items-start justify-between gap-3">
                                                    <div>
                                                        <h2 className="text-[16px] font-bold tracking-tight">
                                                            {v.name}
                                                        </h2>
                                                        <p className="mt-0.5 text-xs text-stone-400 tabular-nums">
                                                            {fmtTrips(
                                                                v.trips_count,
                                                            )}
                                                        </p>
                                                    </div>
                                                    <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#F7F2EB] px-2.5 py-1 text-xs font-bold">
                                                        <Star
                                                            size={12}
                                                            className="fill-[#FF9137] text-[#FF9137]"
                                                        />
                                                        {v.rating.toFixed(1)}
                                                    </span>
                                                </div>
                                                <div className="mt-3.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-dashed border-stone-200 pt-3.5 text-xs text-stone-500">
                                                    <span className="flex items-center gap-1.5">
                                                        <Cog size={14} />
                                                        {v.transmission ===
                                                        'automatic'
                                                            ? 'Automatic'
                                                            : 'Manual'}
                                                    </span>
                                                    <span className="flex items-center gap-1.5">
                                                        <Users size={14} />
                                                        {v.seats} Orang
                                                    </span>
                                                    {v.engine && (
                                                        <span className="flex items-center gap-1.5">
                                                            {v.category ===
                                                            'motor' ? (
                                                                <Bike
                                                                    size={14}
                                                                />
                                                            ) : (
                                                                <CarFront
                                                                    size={14}
                                                                />
                                                            )}
                                                            {v.engine}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="mt-4">
                                                    <span className="block text-[11px] font-medium text-stone-400">
                                                        Mulai dari
                                                    </span>
                                                    <p>
                                                        <strong className="text-xl font-bold tracking-tight tabular-nums">
                                                            {rupiah(
                                                                v.price_per_day,
                                                            )}
                                                        </strong>
                                                        <span className="text-[13px] text-stone-500">
                                                            /hari
                                                        </span>
                                                    </p>
                                                </div>
                                                <div className="mt-4 grid grid-cols-2 gap-2">
                                                    <Link
                                                        href={`/vehicles/${v.slug}`}
                                                        className="pressable flex items-center justify-center gap-1 rounded-full border border-[#241203]/15 py-2.5 text-[13px] font-semibold"
                                                    >
                                                        Lihat Detail
                                                    </Link>
                                                    {dead ? (
                                                        <span
                                                            aria-disabled="true"
                                                            className="flex cursor-not-allowed items-center justify-center gap-1 rounded-full bg-stone-200 py-2.5 text-[13px] font-semibold text-stone-400"
                                                        >
                                                            Penuh
                                                        </span>
                                                    ) : (
                                                        <Link
                                                            href={rentalHref}
                                                            className="pressable flex items-center justify-center gap-1 rounded-full bg-[#FF9137] py-2.5 text-[13px] font-semibold text-[#241203]"
                                                        >
                                                            Rental
                                                            <ArrowRight
                                                                size={14}
                                                            />
                                                        </Link>
                                                    )}
                                                </div>
                                            </div>
                                        </article>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {sheetOpen && (
                <div
                    className="fixed inset-0 z-50 lg:hidden"
                    role="dialog"
                    aria-modal="true"
                    aria-label="Filter kendaraan"
                >
                    <div
                        onClick={() => setSheetOpen(false)}
                        className={`absolute inset-0 bg-black/45 transition-[opacity] duration-250 ease-out ${
                            sheetShown ? 'opacity-100' : 'opacity-0'
                        }`}
                    />
                    <div
                        className={`absolute inset-x-0 bottom-0 max-h-[85vh] overflow-y-auto rounded-t-3xl bg-[#F7F2EB] p-6 pb-8 transition-[transform] duration-300 ease-out ${
                            sheetShown ? 'translate-y-0' : 'translate-y-full'
                        }`}
                    >
                        <div className="mb-5 flex items-center justify-between">
                            <h2 className="text-lg font-bold tracking-tight">
                                Filter Kendaraan
                            </h2>
                            <button
                                onClick={() => setSheetOpen(false)}
                                aria-label="Tutup filter"
                                className="pressable rounded-full border border-[#241203]/15 bg-white p-2"
                            >
                                <X size={17} />
                            </button>
                        </div>
                        <FilterGroups {...filterProps} />
                        <button
                            onClick={() => setSheetOpen(false)}
                            className="pressable mt-6 w-full rounded-full bg-[#FF9137] py-3.5 text-sm font-bold text-[#241203]"
                        >
                            Lihat {filtered.length} kendaraan
                        </button>
                    </div>
                </div>
            )}
        </>
    );
}
