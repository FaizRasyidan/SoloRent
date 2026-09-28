import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    BadgeCheck,
    Bike,
    Briefcase,
    CarFront,
    Check,
    Cog,
    ShieldCheck,
    Star,
    Users,
} from 'lucide-react';
import { useState } from 'react';
import {
    AvailabilityBadge,
    VehicleImage,
} from '@/components/customer/vehicle-image';
import { useReveal } from '@/hooks/use-reveal';
import { rupiah } from '@/lib/format';
import type { VehicleDetailDTO } from '@/types/catalog';

function Spec({
    icon,
    label,
    value,
}: {
    icon: React.ReactNode;
    label: string;
    value: string;
}) {
    return (
        <div className="rounded-2xl border border-[#241203]/10 bg-[#F7F2EB] p-4">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-[#241203]">
                {icon}
            </span>
            <p className="mt-3 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                {label}
            </p>
            <p className="mt-0.5 text-[15px] font-bold">{value}</p>
        </div>
    );
}

export default function VehicleShow({
    vehicle,
}: {
    vehicle: VehicleDetailDTO;
}) {
    useReveal();
    const gallery =
        vehicle.gallery.length > 0
            ? vehicle.gallery
            : vehicle.image_url
              ? [vehicle.image_url]
              : [];
    const [active, setActive] = useState(0);
    const dead = vehicle.availability === 'unavailable';
    const categoryLabel = vehicle.category === 'motor' ? 'Motor' : 'Mobil';

    return (
        <>
            <Head
                title={`${vehicle.name} — Rental ${categoryLabel} Solo | SoloRent`}
            />
            <div className="mx-auto max-w-6xl px-5 py-8 pb-28 lg:px-8 lg:py-12 lg:pb-12">
                <div className="flex items-center justify-between">
                    <Link
                        href="/vehicles"
                        className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                    >
                        <ArrowLeft size={16} /> Semua kendaraan
                    </Link>
                    <span className="rounded-full border border-[#241203]/15 bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                        {categoryLabel}
                    </span>
                </div>

                <div className="mt-6 grid gap-8 lg:grid-cols-[1.1fr_0.9fr] lg:gap-12">
                    <div data-reveal="left">
                        {gallery.length > 0 ? (
                            <>
                                <div className="img-zoom overflow-hidden rounded-3xl border border-[#241203]/10 bg-white">
                                    <VehicleImage
                                        key={gallery[active]}
                                        src={gallery[active]}
                                        alt={vehicle.name}
                                        category={vehicle.category}
                                        className="animate-fade-up aspect-[4/3] w-full"
                                    />
                                </div>
                                {gallery.length > 1 && (
                                    <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1">
                                        {gallery.map((src, i) => (
                                            <button
                                                key={src + i}
                                                onClick={() => setActive(i)}
                                                aria-label={`Lihat foto ${i + 1}`}
                                                aria-pressed={active === i}
                                                className={`pressable h-18 w-24 shrink-0 overflow-hidden rounded-xl border-2 transition-[border-color] duration-200 ease-out ${
                                                    active === i
                                                        ? 'border-[#FF9137]'
                                                        : 'border-transparent opacity-70'
                                                }`}
                                            >
                                                <VehicleImage
                                                    src={src}
                                                    alt=""
                                                    category={vehicle.category}
                                                    className="h-full w-full"
                                                />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        ) : (
                            <VehicleImage
                                src={null}
                                alt={vehicle.name}
                                category={vehicle.category}
                                className="aspect-[4/3] w-full rounded-3xl border border-[#241203]/10"
                            />
                        )}
                    </div>

                    <div data-reveal="right">
                        <div className="flex flex-wrap items-center gap-2">
                            <AvailabilityBadge status={vehicle.availability} />
                            <span className="flex items-center gap-1 rounded-full bg-[#F7F2EB] px-2.5 py-1.5 text-xs font-bold">
                                <Star
                                    size={12}
                                    className="fill-[#FF9137] text-[#FF9137]"
                                />
                                {vehicle.rating.toFixed(1)}
                            </span>
                        </div>
                        <h1 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">
                            {vehicle.name}
                        </h1>
                        <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-stone-500">
                            <span className="flex items-center gap-1.5">
                                <Cog size={14} />
                                {vehicle.transmission === 'automatic'
                                    ? 'Automatic'
                                    : 'Manual'}
                            </span>
                            <span className="flex items-center gap-1.5">
                                <Users size={14} />
                                {vehicle.seats} Orang
                            </span>
                            {vehicle.engine && (
                                <span className="flex items-center gap-1.5">
                                    {vehicle.category === 'motor' ? (
                                        <Bike size={14} />
                                    ) : (
                                        <CarFront size={14} />
                                    )}
                                    {vehicle.engine}
                                </span>
                            )}
                        </p>

                        <div className="mt-6 rounded-3xl border border-[#241203]/10 bg-white p-6">
                            <p className="text-[11px] font-semibold tracking-wide text-stone-400 uppercase">
                                Tarif sewa
                            </p>
                            <p className="mt-1">
                                <strong className="text-3xl font-bold tracking-tight tabular-nums">
                                    {rupiah(vehicle.price_per_day)}
                                </strong>
                                <span className="text-sm text-stone-500">
                                    /hari
                                </span>
                            </p>
                            <p className="mt-2 text-xs leading-5 text-stone-500">
                                Dihitung per 24 jam · skema full-to-full · tanpa
                                biaya siluman.
                            </p>
                            {dead ? (
                                <div className="mt-5 rounded-2xl bg-stone-100 p-4 text-center text-sm font-semibold text-stone-500">
                                    Unit sedang penuh. Coba tanggal lain atau
                                    pilih kendaraan sejenis.
                                </div>
                            ) : (
                                <Link
                                    href={`/booking/${vehicle.slug}`}
                                    className="pressable mt-5 flex items-center justify-center gap-2 rounded-full bg-[#FF9137] py-4 text-sm font-bold text-[#241203]"
                                >
                                    Rental Sekarang
                                    <ArrowRight size={16} />
                                </Link>
                            )}
                            <div className="mt-4 flex items-center gap-4 text-xs text-stone-500">
                                <span className="flex items-center gap-1.5">
                                    <ShieldCheck size={14} />
                                    STNK lengkap
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <BadgeCheck size={14} />
                                    Checklist 21 titik
                                </span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 grid gap-4 lg:grid-cols-2">
                    <div
                        className="rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                        data-reveal
                    >
                        <h2 className="text-lg font-bold tracking-tight">
                            Spesifikasi
                        </h2>
                        <div className="mt-5 grid grid-cols-2 gap-3">
                            <Spec
                                icon={
                                    vehicle.category === 'motor' ? (
                                        <Bike size={18} />
                                    ) : (
                                        <CarFront size={18} />
                                    )
                                }
                                label="Mesin"
                                value={vehicle.engine ?? '-'}
                            />
                            <Spec
                                icon={<Cog size={18} />}
                                label="Transmisi"
                                value={
                                    vehicle.transmission === 'automatic'
                                        ? 'Automatic'
                                        : 'Manual'
                                }
                            />
                            <Spec
                                icon={<Users size={18} />}
                                label="Kapasitas"
                                value={`${vehicle.seats} Orang`}
                            />
                            <Spec
                                icon={<Briefcase size={18} />}
                                label="Bagasi"
                                value={vehicle.baggage ?? '-'}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col gap-4">
                        <div
                            className="rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                            data-reveal
                        >
                            <h2 className="text-lg font-bold tracking-tight">
                                Yang kamu dapatkan
                            </h2>
                            <ul className="mt-4 grid gap-2.5 sm:grid-cols-2">
                                {vehicle.benefits.map((b) => (
                                    <li
                                        key={b}
                                        className="flex items-center gap-2.5 text-sm font-medium text-stone-700"
                                    >
                                        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#70FFD2]/40">
                                            <Check
                                                size={12}
                                                className="text-[#0B6B4F]"
                                            />
                                        </span>
                                        {b}
                                    </li>
                                ))}
                            </ul>
                        </div>
                        {vehicle.description && (
                            <div
                                className="rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                                data-reveal
                            >
                                <h2 className="text-lg font-bold tracking-tight">
                                    Tentang kendaraan
                                </h2>
                                <p className="mt-3 text-[14.5px] leading-7 text-stone-600">
                                    {vehicle.description}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[#241203]/10 bg-white/95 px-5 py-3 backdrop-blur-md lg:hidden">
                <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
                    <p>
                        <span className="block text-[11px] text-stone-400">
                            Mulai dari
                        </span>
                        <strong className="text-lg font-bold tabular-nums">
                            {rupiah(vehicle.price_per_day)}
                        </strong>
                        <span className="text-xs text-stone-500">/hari</span>
                    </p>
                    {dead ? (
                        <span className="rounded-full bg-stone-200 px-6 py-3 text-sm font-semibold text-stone-400">
                            Penuh
                        </span>
                    ) : (
                        <Link
                            href={`/booking/${vehicle.slug}`}
                            className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-6 py-3 text-sm font-bold text-[#241203]"
                        >
                            Rental Sekarang
                            <ArrowRight size={15} />
                        </Link>
                    )}
                </div>
            </div>
        </>
    );
}
