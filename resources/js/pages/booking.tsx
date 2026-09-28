import { Head, Link, useForm } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    CircleAlert,
    Clock3,
    LoaderCircle,
    Navigation,
    Star,
    Store,
    Truck,
    UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import {
    AvailabilityBadge,
    VehicleImage,
} from '@/components/customer/vehicle-image';
import { useReveal } from '@/hooks/use-reveal';
import { durationDays, formatRangeID, rupiah, todayISO } from '@/lib/format';
import type {
    DeliveryArea,
    OutletInfo,
    PickupMethod,
    VehicleDTO,
} from '@/types/catalog';

const steps = ['Jadwal', 'Pengambilan', 'Data', 'Konfirmasi'];

function Field({
    label,
    error,
    children,
    optional,
}: {
    label: string;
    error?: string;
    children: React.ReactNode;
    optional?: boolean;
}) {
    return (
        <label className="block">
            <span className="text-[13px] font-semibold">
                {label}{' '}
                {optional ? (
                    <span className="font-normal text-stone-400">
                        (opsional)
                    </span>
                ) : (
                    <span className="text-[#C2570B]">*</span>
                )}
            </span>
            <div className="mt-1.5">{children}</div>
            {error && (
                <span className="mt-1.5 block text-xs font-medium text-red-600">
                    {error}
                </span>
            )}
        </label>
    );
}

const inputCls =
    'h-12 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm font-medium outline-none placeholder:font-normal placeholder:text-stone-400 focus:border-[#FF9137]';

type AvailState =
    | { state: 'idle' }
    | { state: 'checking' }
    | { state: 'ok'; unitsLeft: number }
    | { state: 'fail' };

/** Baca tanggal valid (YYYY-MM-DD, tidak mundur) dari query URL. */
function queryDate(key: string): string | null {
    try {
        const v = new URLSearchParams(window.location.search).get(key);
        if (!v || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
        if (Number.isNaN(new Date(`${v}T00:00:00`).getTime())) return null;
        if (v < todayISO(0)) return null;
        return v;
    } catch {
        return null;
    }
}

export default function Booking({
    vehicle,
    vehicles,
    areas,
    outlet,
}: {
    vehicle: VehicleDTO | null;
    vehicles: VehicleDTO[];
    areas: DeliveryArea[];
    outlet: OutletInfo;
}) {
    useReveal();
    const [step, setStep] = useState(0);
    const [vehicleId, setVehicleId] = useState<number | null>(
        vehicle?.id ?? null,
    );
    // Prefill tanggal dari katalog (landing → katalog → booking).
    const [start, setStart] = useState(() => queryDate('start_date') ?? todayISO(1));
    const [end, setEnd] = useState(() => {
        const q = queryDate('end_date');
        const s = queryDate('start_date') ?? todayISO(1);
        return q && q >= s ? q : todayISO(4);
    });
    const [pickup, setPickup] = useState<PickupMethod>('outlet');
    const [area, setArea] = useState(areas[0]?.name ?? '');
    const [dName, setDName] = useState('');
    const [dAddress, setDAddress] = useState('');
    const [dDistrict, setDDistrict] = useState('');
    const [dNote, setDNote] = useState('');
    const [withDriver, setWithDriver] = useState(false);
    const [returnMethod, setReturnMethod] = useState<'outlet' | 'pickup'>('outlet');
    const [returnAddress, setReturnAddress] = useState('');
    const [returnNote, setReturnNote] = useState('');
    const [name, setName] = useState('');
    const [phone, setPhone] = useState('');
    const [email, setEmail] = useState('');
    const [identity, setIdentity] = useState('');
    const [notes, setNotes] = useState('');
    const [terms, setTerms] = useState(false);
    const [avail, setAvail] = useState<AvailState>({ state: 'idle' });

    const current = vehicles.find((v) => v.id === vehicleId) ?? vehicle ?? null;

    const days = useMemo(() => {
        if (!start || !end || end < start) return 0;
        return durationDays(start, end);
    }, [start, end]);

    const areaFee = useMemo(
        () => areas.find((a) => a.name === area)?.fee ?? 0,
        [areas, area],
    );
    const subtotal = (current?.price_per_day ?? 0) * days;
    const deliveryFee = pickup === 'delivery' ? areaFee : 0;
    const total = subtotal + deliveryFee;

    useEffect(() => {
        if (!current || !start || !end || end < start) {
            setAvail({ state: 'idle' });
            return;
        }
        setAvail({ state: 'checking' });
        const ctrl = new AbortController();
        const t = window.setTimeout(() => {
            fetch(
                `/booking/availability?vehicle_id=${current.id}&start_date=${start}&end_date=${end}`,
                { signal: ctrl.signal },
            )
                .then((r) => (r.ok ? r.json() : Promise.reject()))
                .then((j) =>
                    setAvail(
                        j.available
                            ? { state: 'ok', unitsLeft: j.units_left }
                            : { state: 'fail' },
                    ),
                )
                .catch(() => {
                    if (!ctrl.signal.aborted) setAvail({ state: 'idle' });
                });
        }, 400);
        return () => {
            window.clearTimeout(t);
            ctrl.abort();
        };
    }, [current, start, end]);

    const form = useForm({
        vehicle_id: 0,
        start_date: '',
        end_date: '',
        pickup_method: 'outlet' as PickupMethod,
        delivery_area: '',
        delivery_name: '',
        delivery_address: '',
        delivery_district: '',
        delivery_note: '',
        with_driver: false,
        return_method: 'outlet',
        return_address: '',
        return_note: '',
        customer_name: '',
        customer_phone: '',
        customer_email: '',
        identity_number: '',
        notes: '',
        terms: false,
    });

    const phoneOk = /^[0-9+\-\s]{9,20}$/.test(phone.trim());
    const emailOk =
        email.trim() === '' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

    const stepError = (s: number): string | null => {
        if (s === 0) {
            if (!current) return 'Pilih kendaraan terlebih dahulu.';
            if (!start || !end || end < start)
                return 'Pilih tanggal mulai dan selesai yang valid.';
            if (avail.state === 'checking') return 'Memeriksa ketersediaan…';
            if (avail.state === 'fail')
                return 'Kendaraan tidak tersedia untuk tanggal tersebut.';
            return null;
        }
        if (s === 1) {
            if (pickup === 'delivery') {
                if (!area) return 'Pilih area pengantaran.';
                if (!dName.trim()) return 'Isi nama lokasi pengantaran.';
                if (!dAddress.trim()) return 'Isi alamat lengkap.';
            }
            // Dengan driver, pengembalian dikunci ke outlet.
            if (!withDriver && returnMethod === 'pickup' && !returnAddress.trim())
                return 'Isi alamat penjemputan kembali.';
            return null;
        }
        if (s === 2) {
            if (!name.trim()) return 'Nama lengkap wajib diisi.';
            if (!phoneOk) return 'Nomor WhatsApp tidak valid.';
            if (!emailOk) return 'Format email tidak valid.';
            return null;
        }
        return null;
    };

    const next = () => {
        if (stepError(step)) return;
        setStep((s) => Math.min(3, s + 1));
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const submit = () => {
        if (!current || !terms) return;
        // Dengan driver, pengembalian selalu ke outlet (opsi dikunci di UI).
        const effectiveReturn = withDriver ? 'outlet' : returnMethod;
        form.transform(() => ({
            vehicle_id: current.id,
            start_date: start,
            end_date: end,
            pickup_method: pickup,
            delivery_area: pickup === 'delivery' ? area : '',
            delivery_name: dName,
            delivery_address: dAddress,
            delivery_district: dDistrict,
            delivery_note: dNote,
            with_driver: withDriver,
            return_method: effectiveReturn,
            return_address: effectiveReturn === 'pickup' ? returnAddress.trim() : '',
            return_note: returnNote.trim(),
            customer_name: name.trim(),
            customer_phone: phone.trim(),
            customer_email: email.trim(),
            identity_number: identity.trim(),
            notes: notes.trim(),
            terms,
        }));
        form.post('/booking');
    };

    const errs = form.errors as Record<string, string | undefined>;
    const serverError =
        errs.availability ?? errs.vehicle_id ?? Object.values(errs)[0];

    return (
        <>
            <Head title="Booking Rental — SoloRent" />
            <div className="mx-auto max-w-6xl px-5 py-8 pb-32 lg:px-8 lg:py-12 lg:pb-12">
                <Link
                    href={current ? `/vehicles/${current.slug}` : '/vehicles'}
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                >
                    <ArrowLeft size={16} />{' '}
                    {current ? 'Kembali ke detail' : 'Kembali ke katalog'}
                </Link>

                <h1 className="mt-5 text-3xl font-bold tracking-[-0.02em] sm:text-4xl">
                    Booking rental
                </h1>
                <p className="mt-2 text-[15px] text-stone-500">
                    Tanpa akun. Cukup 4 langkah cepat sampai dapat kode booking.
                </p>

                <ol
                    className="mt-8 flex items-center"
                    aria-label="Langkah booking"
                >
                    {steps.map((label, i) => (
                        <li
                            key={label}
                            className={`flex items-center ${i < steps.length - 1 ? 'flex-1' : ''}`}
                        >
                            <div className="flex items-center gap-2.5">
                                <span
                                    className={`flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-bold transition-[background-color,color] duration-200 ease-out ${
                                        i < step
                                            ? 'bg-[#0B6B4F] text-white'
                                            : i === step
                                              ? 'bg-[#FF9137] text-[#241203]'
                                              : 'bg-stone-200 text-stone-500'
                                    }`}
                                >
                                    {i < step ? (
                                        <Check size={15} />
                                    ) : (
                                        `0${i + 1}`
                                    )}
                                </span>
                                <span
                                    className={`hidden text-[13px] font-semibold sm:block ${
                                        i === step
                                            ? 'text-[#241203]'
                                            : 'text-stone-400'
                                    }`}
                                >
                                    {label}
                                </span>
                            </div>
                            {i < steps.length - 1 && (
                                <span
                                    className={`mx-3 h-0.5 flex-1 rounded-full ${
                                        i < step
                                            ? 'bg-[#0B6B4F]'
                                            : 'bg-stone-200'
                                    }`}
                                />
                            )}
                        </li>
                    ))}
                </ol>

                <div className="mt-8 grid items-start gap-6 lg:grid-cols-[1fr_360px]">
                    <div
                        key={step}
                        className="animate-fade-up rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                    >
                        {step === 0 && (
                            <section aria-label="Langkah 1 — Jadwal">
                                <h2 className="text-lg font-bold tracking-tight">
                                    01 · Pilih kendaraan & jadwal
                                </h2>
                                <div className="mt-5">
                                    <Field label="Kendaraan">
                                        <select
                                            value={vehicleId ?? ''}
                                            onChange={(e) =>
                                                setVehicleId(
                                                    e.target.value
                                                        ? Number(e.target.value)
                                                        : null,
                                                )
                                            }
                                            className={inputCls}
                                        >
                                            <option value="">
                                                — Pilih kendaraan —
                                            </option>
                                            {vehicles.map((v) => (
                                                <option key={v.id} value={v.id}>
                                                    {v.name} ·{' '}
                                                    {v.category === 'motor'
                                                        ? 'Motor'
                                                        : 'Mobil'}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                </div>

                                {current && (
                                    <div className="mt-4 flex items-center gap-4 rounded-2xl bg-[#F7F2EB] p-4">
                                        <VehicleImage
                                            src={current.image_url}
                                            alt={current.name}
                                            category={current.category}
                                            className="h-18 w-24 shrink-0 rounded-xl"
                                        />
                                        <div className="min-w-0">
                                            <p className="truncate text-[15px] font-bold">
                                                {current.name}
                                            </p>
                                            <p className="mt-0.5 text-[13px] text-stone-500 tabular-nums">
                                                {rupiah(current.price_per_day)}{' '}
                                                / hari
                                            </p>
                                            <div className="mt-1.5">
                                                <AvailabilityBadge
                                                    status={
                                                        current.availability
                                                    }
                                                />
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Tanggal mulai"
                                        error={form.errors.start_date}
                                    >
                                        <input
                                            type="date"
                                            value={start}
                                            min={todayISO(0)}
                                            onChange={(e) =>
                                                setStart(e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field
                                        label="Tanggal selesai"
                                        error={form.errors.end_date}
                                    >
                                        <input
                                            type="date"
                                            value={end}
                                            min={start || todayISO(0)}
                                            onChange={(e) =>
                                                setEnd(e.target.value)
                                            }
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>

                                <div className="mt-4 rounded-2xl border border-dashed border-[#241203]/20 p-4">
                                    {days > 0 && current ? (
                                        <div className="flex flex-wrap items-center justify-between gap-3">
                                            <p className="flex items-center gap-2 text-sm text-stone-600">
                                                <Clock3 size={15} />
                                                Durasi{' '}
                                                <strong className="text-[#241203]">
                                                    {days} hari
                                                </strong>
                                                <span className="text-stone-400">
                                                    {formatRangeID(start, end)}
                                                </span>
                                            </p>
                                            <p className="text-sm font-bold tabular-nums">
                                                {rupiah(current.price_per_day)}{' '}
                                                × {days} = {rupiah(subtotal)}
                                            </p>
                                        </div>
                                    ) : (
                                        <p className="text-sm text-stone-500">
                                            Pilih tanggal untuk melihat durasi
                                            dan estimasi harga.
                                        </p>
                                    )}
                                    {avail.state === 'checking' && (
                                        <p className="mt-3 flex items-center gap-2 text-[13px] text-stone-500">
                                            <LoaderCircle
                                                size={15}
                                                className="animate-spin"
                                            />
                                            Memeriksa ketersediaan unit…
                                        </p>
                                    )}
                                    {avail.state === 'ok' && (
                                        <p className="mt-3 flex items-center gap-2 text-[13px] font-semibold text-[#0B6B4F]">
                                            <Check size={15} />
                                            Tersedia — tersisa {
                                                avail.unitsLeft
                                            }{' '}
                                            unit untuk tanggal ini.
                                        </p>
                                    )}
                                    {avail.state === 'fail' && (
                                        <p className="mt-3 flex items-start gap-2 text-[13px] font-semibold text-red-600">
                                            <CircleAlert
                                                size={15}
                                                className="mt-0.5 shrink-0"
                                            />
                                            Kendaraan tidak tersedia untuk
                                            tanggal tersebut. Pilih tanggal
                                            lain.
                                        </p>
                                    )}
                                </div>
                            </section>
                        )}

                        {step === 1 && (
                            <section aria-label="Langkah 2 — Pengambilan">
                                <h2 className="text-lg font-bold tracking-tight">
                                    02 · Cara pengambilan unit
                                </h2>
                                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                                    {(
                                        [
                                            [
                                                'outlet',
                                                Store,
                                                'Ambil di Outlet',
                                                'Gratis',
                                                `${outlet.name} · ${outlet.hours}`,
                                            ],
                                            [
                                                'delivery',
                                                Truck,
                                                'Antar ke Lokasi',
                                                'Biaya sesuai area',
                                                'Hotel, kos, stasiun, bandara',
                                            ],
                                        ] as Array<
                                            [
                                                'outlet' | 'delivery',
                                                typeof Store,
                                                string,
                                                string,
                                                string,
                                            ]
                                        >
                                    ).map(
                                        ([method, Icon, title, fee, desc]) => {
                                            const active = pickup === method;
                                            return (
                                                <button
                                                    key={method}
                                                    onClick={() =>
                                                        setPickup(method)
                                                    }
                                                    aria-pressed={active}
                                                    className={`pressable rounded-3xl border-2 p-5 text-left transition-[border-color,background-color] duration-200 ease-out ${
                                                        active
                                                            ? 'border-[#FF9137] bg-[#FF9137]/8'
                                                            : 'border-[#241203]/10 bg-white'
                                                    }`}
                                                >
                                                    <span
                                                        className={`flex h-11 w-11 items-center justify-center rounded-2xl ${
                                                            active
                                                                ? 'bg-[#FF9137] text-[#241203]'
                                                                : 'bg-[#F7F2EB] text-[#241203]'
                                                        }`}
                                                    >
                                                        <Icon size={20} />
                                                    </span>
                                                    <span className="mt-4 flex items-center justify-between">
                                                        <strong className="text-[15px]">
                                                            {title}
                                                        </strong>
                                                        <span
                                                            className={`flex h-5 w-5 items-center justify-center rounded-full border-2 ${
                                                                active
                                                                    ? 'border-[#FF9137] bg-[#FF9137] text-[#241203]'
                                                                    : 'border-stone-300 text-transparent'
                                                            }`}
                                                        >
                                                            <Check size={12} />
                                                        </span>
                                                    </span>
                                                    <span className="mt-1 block text-[13px] font-semibold text-[#C2570B]">
                                                        {fee}
                                                    </span>
                                                    <span className="mt-1 block text-[13px] text-stone-500">
                                                        {desc}
                                                    </span>
                                                </button>
                                            );
                                        },
                                    )}
                                </div>

                                {pickup === 'outlet' ? (
                                    <div className="mt-4 rounded-2xl bg-[#F7F2EB] p-5 text-sm leading-6 text-stone-600">
                                        <p className="font-bold text-[#241203]">
                                            {outlet.name}
                                        </p>
                                        <p>
                                            {outlet.address} · {outlet.city}
                                        </p>
                                        <p className="mt-1 flex items-center gap-1.5">
                                            <Clock3 size={14} />
                                            Jam operasional {outlet.hours}
                                        </p>
                                    </div>
                                ) : (
                                    <div className="mt-4 grid gap-4">
                                        <Field
                                            label="Area pengantaran"
                                            error={form.errors.delivery_area}
                                        >
                                            <select
                                                value={area}
                                                onChange={(e) =>
                                                    setArea(e.target.value)
                                                }
                                                className={inputCls}
                                            >
                                                {areas.map((a) => (
                                                    <option
                                                        key={a.name}
                                                        value={a.name}
                                                    >
                                                        {a.name} ·{' '}
                                                        {rupiah(a.fee)}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                        <div className="grid gap-4 sm:grid-cols-2">
                                            <Field
                                                label="Nama lokasi"
                                                error={
                                                    form.errors.delivery_name
                                                }
                                            >
                                                <input
                                                    value={dName}
                                                    onChange={(e) =>
                                                        setDName(e.target.value)
                                                    }
                                                    placeholder="Hotel / rumah / kos"
                                                    className={inputCls}
                                                />
                                            </Field>
                                            <Field label="Kecamatan" optional>
                                                <input
                                                    value={dDistrict}
                                                    onChange={(e) =>
                                                        setDDistrict(
                                                            e.target.value,
                                                        )
                                                    }
                                                    placeholder="Contoh: Laweyan"
                                                    className={inputCls}
                                                />
                                            </Field>
                                        </div>
                                        <Field
                                            label="Alamat lengkap"
                                            error={form.errors.delivery_address}
                                        >
                                            <textarea
                                                value={dAddress}
                                                onChange={(e) =>
                                                    setDAddress(e.target.value)
                                                }
                                                placeholder="Jalan, nomor, patokan"
                                                rows={2}
                                                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium outline-none placeholder:font-normal placeholder:text-stone-400 focus:border-[#FF9137]"
                                            />
                                        </Field>
                                        <Field
                                            label="Catatan pengantaran"
                                            optional
                                        >
                                            <input
                                                value={dNote}
                                                onChange={(e) =>
                                                    setDNote(e.target.value)
                                                }
                                                placeholder="Contoh: titip di resepsionis"
                                                className={inputCls}
                                            />
                                        </Field>
                                        <div className="rounded-2xl border border-dashed border-[#241203]/20 p-4 text-sm tabular-nums">
                                            <div className="flex justify-between text-stone-600">
                                                <span>Rental</span>
                                                <span>{rupiah(subtotal)}</span>
                                            </div>
                                            <div className="mt-1.5 flex justify-between text-stone-600">
                                                <span>Delivery</span>
                                                <span>
                                                    {rupiah(deliveryFee)}
                                                </span>
                                            </div>
                                            <div className="mt-2 flex justify-between border-t border-[#241203]/10 pt-2 font-bold">
                                                <span>Total</span>
                                                <span>{rupiah(total)}</span>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                {/* Driver option */}
                                <h3 className="mt-8 text-[15px] font-bold tracking-tight">
                                    Butuh driver?
                                </h3>
                                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    {(
                                        [
                                            [false, UserRound, 'Tanpa Driver', 'Kemudikan sendiri'],
                                            [true, Navigation, 'Dengan Driver', 'Termasuk jasa driver, tanpa biaya tambahan'],
                                        ] as Array<[boolean, typeof UserRound, string, string]>
                                    ).map(([value, Icon, title, desc]) => {
                                        const active = withDriver === value;
                                        return (
                                            <button
                                                key={title}
                                                onClick={() => {
                                                    setWithDriver(value);
                                                    // Dengan driver, unit dikembalikan ke toko — kunci opsi pengembalian.
                                                    if (value) setReturnMethod('outlet');
                                                }}
                                                aria-pressed={active}
                                                className={`pressable flex items-center gap-3.5 rounded-3xl border-2 p-4 text-left transition-[border-color,background-color] duration-200 ease-out ${
                                                    active
                                                        ? 'border-[#FF9137] bg-[#FF9137]/8'
                                                        : 'border-[#241203]/10 bg-white'
                                                }`}
                                            >
                                                <span
                                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                                        active
                                                            ? 'bg-[#FF9137] text-[#241203]'
                                                            : 'bg-[#F7F2EB] text-[#241203]'
                                                    }`}
                                                >
                                                    <Icon size={18} />
                                                </span>
                                                <span>
                                                    <span className="block text-[14px] font-bold">{title}</span>
                                                    <span className="block text-xs text-stone-500">{desc}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>

                                {/* Return method — dikunci ke outlet saat dengan driver */}
                                <h3 className="mt-8 text-[15px] font-bold tracking-tight">
                                    Cara pengembalian unit
                                </h3>
                                {withDriver && (
                                    <p className="mt-1.5 rounded-2xl bg-[#F7F2EB] px-4 py-3 text-[13px] leading-6 text-stone-600">
                                        Dengan driver, unit dikembalikan ke toko. Opsi pengembalian terkunci.
                                    </p>
                                )}
                                <div className={`mt-3 grid gap-3 sm:grid-cols-2 ${withDriver ? 'pointer-events-none opacity-50' : ''}`} aria-disabled={withDriver}>
                                    {(
                                        [
                                            ['outlet', Store, 'Kembalikan ke Toko', 'Gratis'],
                                            ['pickup', Truck, 'Jemput di Lokasi', 'Petugas menjemput unit'],
                                        ] as Array<['outlet' | 'pickup', typeof Store, string, string]>
                                    ).map(([method, Icon, title, desc]) => {
                                        const active = (withDriver ? 'outlet' : returnMethod) === method;
                                        return (
                                            <button
                                                key={method}
                                                onClick={() => setReturnMethod(method)}
                                                disabled={withDriver}
                                                aria-pressed={active}
                                                className={`pressable flex items-center gap-3.5 rounded-3xl border-2 p-4 text-left transition-[border-color,background-color] duration-200 ease-out ${
                                                    active
                                                        ? 'border-[#FF9137] bg-[#FF9137]/8'
                                                        : 'border-[#241203]/10 bg-white'
                                                }`}
                                            >
                                                <span
                                                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                                        active
                                                            ? 'bg-[#FF9137] text-[#241203]'
                                                            : 'bg-[#F7F2EB] text-[#241203]'
                                                    }`}
                                                >
                                                    <Icon size={18} />
                                                </span>
                                                <span>
                                                    <span className="block text-[14px] font-bold">{title}</span>
                                                    <span className="block text-xs text-stone-500">{desc}</span>
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {returnMethod === 'pickup' && (
                                    <div className="mt-4 grid gap-4">
                                        <Field
                                            label="Alamat penjemputan"
                                            error={form.errors.return_address}
                                        >
                                            <textarea
                                                value={returnAddress}
                                                onChange={(e) =>
                                                    setReturnAddress(e.target.value)
                                                }
                                                placeholder="Jalan, nomor, patokan"
                                                rows={2}
                                                className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium outline-none placeholder:font-normal placeholder:text-stone-400 focus:border-[#FF9137]"
                                            />
                                        </Field>
                                        <Field label="Catatan penjemputan" optional>
                                            <input
                                                value={returnNote}
                                                onChange={(e) =>
                                                    setReturnNote(e.target.value)
                                                }
                                                placeholder="Contoh: hubungi saat tiba"
                                                className={inputCls}
                                            />
                                        </Field>
                                    </div>
                                )}
                            </section>
                        )}

                        {step === 2 && (
                            <section aria-label="Langkah 3 — Data pemesan">
                                <h2 className="text-lg font-bold tracking-tight">
                                    03 · Data pemesan
                                </h2>
                                <p className="mt-1.5 text-sm text-stone-500">
                                    Tanpa akun. Data hanya dipakai untuk proses
                                    rental ini.
                                </p>
                                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                                    <Field
                                        label="Nama lengkap"
                                        error={form.errors.customer_name}
                                    >
                                        <input
                                            value={name}
                                            onChange={(e) =>
                                                setName(e.target.value)
                                            }
                                            placeholder="Sesuai KTP"
                                            autoComplete="name"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field
                                        label="Nomor WhatsApp"
                                        error={form.errors.customer_phone}
                                    >
                                        <input
                                            value={phone}
                                            onChange={(e) =>
                                                setPhone(e.target.value)
                                            }
                                            placeholder="08xxxxxxxxxx"
                                            inputMode="tel"
                                            autoComplete="tel"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field
                                        label="Email"
                                        optional
                                        error={form.errors.customer_email}
                                    >
                                        <input
                                            value={email}
                                            onChange={(e) =>
                                                setEmail(e.target.value)
                                            }
                                            placeholder="nama@email.com"
                                            inputMode="email"
                                            autoComplete="email"
                                            className={inputCls}
                                        />
                                    </Field>
                                    <Field
                                        label="Nomor identitas"
                                        optional
                                        error={form.errors.identity_number}
                                    >
                                        <input
                                            value={identity}
                                            onChange={(e) =>
                                                setIdentity(e.target.value)
                                            }
                                            placeholder="KTP / SIM / Paspor"
                                            className={inputCls}
                                        />
                                    </Field>
                                </div>
                                <div className="mt-4">
                                    <Field label="Catatan" optional>
                                        <textarea
                                            value={notes}
                                            onChange={(e) =>
                                                setNotes(e.target.value)
                                            }
                                            placeholder="Contoh: butuh helm ukuran besar"
                                            rows={2}
                                            className="w-full rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm font-medium outline-none placeholder:font-normal placeholder:text-stone-400 focus:border-[#FF9137]"
                                        />
                                    </Field>
                                </div>
                            </section>
                        )}

                        {step === 3 && (
                            <section aria-label="Langkah 4 — Konfirmasi">
                                <h2 className="text-lg font-bold tracking-tight">
                                    04 · Periksa pesananmu
                                </h2>
                                <dl className="mt-5 divide-y divide-[#241203]/8 rounded-2xl bg-[#F7F2EB] px-5 text-sm">
                                    {[
                                        ['Kendaraan', current?.name ?? '-'],
                                        [
                                            'Tanggal',
                                            days > 0
                                                ? formatRangeID(start, end)
                                                : '-',
                                        ],
                                        ['Durasi', `${days} hari`],
                                        [
                                            'Pengambilan',
                                            pickup === 'outlet'
                                                ? 'Ambil di Outlet'
                                                : `Diantar — ${dName || area}`,
                                        ],
                                        [
                                            'Driver',
                                            withDriver ? 'Dengan Driver' : 'Tanpa Driver',
                                        ],
                                        [
                                            'Pengembalian',
                                            withDriver || returnMethod === 'outlet'
                                                ? 'Kembali ke Toko'
                                                : `Dijemput — ${returnAddress || 'lokasi customer'}`,
                                        ],
                                        ['Pemesan', name || '-'],
                                        ['WhatsApp', phone || '-'],
                                    ].map(([k, v]) => (
                                        <div
                                            key={k}
                                            className="flex items-center justify-between gap-4 py-3"
                                        >
                                            <dt className="text-stone-500">
                                                {k}
                                            </dt>
                                            <dd className="text-right font-semibold">
                                                {v}
                                            </dd>
                                        </div>
                                    ))}
                                    <div className="flex items-center justify-between gap-4 py-3">
                                        <dt className="text-stone-500">
                                            Total
                                        </dt>
                                        <dd className="text-lg font-bold tabular-nums">
                                            {rupiah(total)}
                                        </dd>
                                    </div>
                                </dl>

                                {serverError && (
                                    <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-4 text-sm leading-6 text-red-700">
                                        <p className="font-bold">
                                            Booking belum berhasil dibuat.
                                        </p>
                                        <p>{serverError}</p>
                                        {errs.availability && (
                                            <button
                                                onClick={() => setStep(0)}
                                                className="pressable mt-2 rounded-full bg-red-600 px-4 py-2 text-xs font-bold text-white"
                                            >
                                                Pilih tanggal lain
                                            </button>
                                        )}
                                    </div>
                                )}

                                <label className="mt-5 flex cursor-pointer items-start gap-3 rounded-2xl border border-[#241203]/10 p-4">
                                    <input
                                        type="checkbox"
                                        checked={terms}
                                        onChange={(e) =>
                                            setTerms(e.target.checked)
                                        }
                                        className="mt-1 h-4 w-4 accent-[#FF9137]"
                                    />
                                    <span className="text-sm leading-6 text-stone-600">
                                        Saya menyetujui syarat dan ketentuan
                                        rental: usia min. 18 thn (motor) / 20
                                        thn (mobil), KTP + SIM aktif, bensin
                                        full-to-full, dan denda tilang/e-tol
                                        ditanggung penyewa.
                                    </span>
                                </label>
                                {form.errors.terms && (
                                    <p className="mt-1.5 text-xs font-medium text-red-600">
                                        {form.errors.terms}
                                    </p>
                                )}
                            </section>
                        )}

                        {stepError(step) && step !== 3 && (
                            <p className="mt-4 flex items-center gap-2 text-[13px] font-medium text-stone-500">
                                <CircleAlert size={15} />
                                {stepError(step)}
                            </p>
                        )}

                        <div className="mt-7 hidden gap-3 sm:flex">
                            {step > 0 && (
                                <button
                                    onClick={() => setStep((s) => s - 1)}
                                    className="pressable rounded-full border border-[#241203]/15 px-6 py-3 text-sm font-semibold"
                                >
                                    Kembali
                                </button>
                            )}
                            {step < 3 ? (
                                <button
                                    onClick={next}
                                    disabled={stepError(step) !== null}
                                    className="pressable flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3 text-sm font-bold text-[#241203] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    Lanjutkan
                                    <ArrowRight size={16} />
                                </button>
                            ) : (
                                <button
                                    onClick={submit}
                                    disabled={!terms || form.processing}
                                    className="pressable flex flex-1 items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3 text-sm font-bold text-[#241203] disabled:cursor-not-allowed disabled:opacity-40"
                                >
                                    {form.processing ? (
                                        <>
                                            <LoaderCircle
                                                size={16}
                                                className="animate-spin"
                                            />
                                            Memproses…
                                        </>
                                    ) : (
                                        'Konfirmasi Booking'
                                    )}
                                </button>
                            )}
                        </div>
                    </div>

                    <aside className="hidden lg:block" data-reveal="right">
                        <div className="sticky top-24 rounded-3xl border border-[#241203]/10 bg-white p-6">
                            <h2 className="text-[15px] font-bold tracking-tight">
                                Ringkasan Rental
                            </h2>
                            {current ? (
                                <div className="mt-4 flex items-center gap-3">
                                    <VehicleImage
                                        src={current.image_url}
                                        alt={current.name}
                                        category={current.category}
                                        className="h-14 w-18 shrink-0 rounded-xl"
                                    />
                                    <div>
                                        <p className="text-sm font-bold">
                                            {current.name}
                                        </p>
                                        <p className="flex items-center gap-1 text-xs text-stone-500">
                                            <Star
                                                size={11}
                                                className="fill-[#FF9137] text-[#FF9137]"
                                            />
                                            {current.rating.toFixed(1)} ·{' '}
                                            {current.category === 'motor'
                                                ? 'Motor'
                                                : 'Mobil'}
                                        </p>
                                    </div>
                                </div>
                            ) : (
                                <p className="mt-4 text-sm text-stone-500">
                                    Belum ada kendaraan dipilih.
                                </p>
                            )}
                            <dl className="mt-4 space-y-2.5 border-t border-dashed border-stone-200 pt-4 text-sm">
                                <div className="flex items-center gap-2 text-stone-600">
                                    <CalendarDays size={15} />
                                    {days > 0
                                        ? `${formatRangeID(start, end)} · ${days} hari`
                                        : 'Tanggal belum dipilih'}
                                </div>
                                <div className="flex items-center gap-2 text-stone-600">
                                    {pickup === 'outlet' ? (
                                        <Store size={15} />
                                    ) : (
                                        <Truck size={15} />
                                    )}
                                    {pickup === 'outlet'
                                        ? 'Ambil di Outlet'
                                        : `Diantar · ${area}`}
                                </div>
                            </dl>
                            <dl className="mt-4 space-y-1.5 border-t border-dashed border-stone-200 pt-4 text-sm tabular-nums">
                                <div className="flex justify-between text-stone-600">
                                    <dt>Harga rental</dt>
                                    <dd>{rupiah(subtotal)}</dd>
                                </div>
                                <div className="flex justify-between text-stone-600">
                                    <dt>Delivery</dt>
                                    <dd>{rupiah(deliveryFee)}</dd>
                                </div>
                                <div className="flex justify-between border-t border-[#241203]/10 pt-2.5 text-base font-bold">
                                    <dt>Total</dt>
                                    <dd>{rupiah(total)}</dd>
                                </div>
                            </dl>
                        </div>
                    </aside>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#241203]/10 bg-white/95 px-5 py-3 backdrop-blur-md lg:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                    <p>
                        <span className="block text-[11px] text-stone-400">
                            {step === 3 ? 'Total bayar' : 'Estimasi total'}
                        </span>
                        <strong className="text-lg font-bold tabular-nums">
                            {rupiah(total)}
                        </strong>
                    </p>
                    <div className="flex gap-2">
                        {step > 0 && (
                            <button
                                onClick={() => setStep((s) => s - 1)}
                                aria-label="Kembali ke langkah sebelumnya"
                                className="pressable rounded-full border border-[#241203]/15 px-5 py-3 text-sm font-semibold"
                            >
                                <ArrowLeft size={16} />
                            </button>
                        )}
                        {step < 3 ? (
                            <button
                                onClick={next}
                                disabled={stepError(step) !== null}
                                className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-6 py-3 text-sm font-bold text-[#241203] disabled:opacity-40"
                            >
                                Lanjutkan
                                <ArrowRight size={15} />
                            </button>
                        ) : (
                            <button
                                onClick={submit}
                                disabled={!terms || form.processing}
                                className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-6 py-3 text-sm font-bold text-[#241203] disabled:opacity-40"
                            >
                                {form.processing ? (
                                    <LoaderCircle
                                        size={16}
                                        className="animate-spin"
                                    />
                                ) : (
                                    'Konfirmasi'
                                )}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
