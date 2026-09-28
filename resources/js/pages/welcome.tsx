import { Head, Link } from '@inertiajs/react';
import {
    ArrowRight,
    ArrowUpRight,
    BadgeCheck,
    Bike,
    CalendarDays,
    CarFront,
    Check,
    ChevronDown,
    Clock3,
    Cog,
    Fuel,
    Headset,
    MapPin,
    Menu,
    Minus,
    Phone,
    Plus,
    Search,
    ShieldCheck,
    Star,
    Users,
    Wrench,
    X,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/* ---------------------------------- data ---------------------------------- */

type Fleet = {
    slug: string;
    name: string;
    type: 'Motor' | 'Mobil';
    spec: string;
    seats: string;
    transmission: string;
    fuel: string;
    price: number;
    rating: string;
    trips: string;
    tag?: string;
    image: string;
};

const fleet: Fleet[] = [
    {
        slug: 'honda-vario-160',
        name: 'Honda Vario 160',
        type: 'Motor',
        spec: '160cc · Bagasi luas',
        seats: '2 orang',
        transmission: 'Matic',
        fuel: 'Full to full',
        price: 85000,
        rating: '4.9',
        trips: '2,1 rb trip',
        tag: 'Paling laris',
        image: 'https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=900&q=80',
    },
    {
        slug: 'yamaha-nmax',
        name: 'Yamaha NMAX',
        type: 'Motor',
        spec: '155cc · Nyaman jauh',
        seats: '2 orang',
        transmission: 'Matic',
        fuel: 'Full to full',
        price: 110000,
        rating: '4.9',
        trips: '1,8 rb trip',
        image: 'https://images.unsplash.com/photo-1568772585407-9361f9bf3a87?auto=format&fit=crop&w=900&q=80',
    },
    {
        slug: 'honda-scoopy',
        name: 'Honda Scoopy',
        type: 'Motor',
        spec: '110cc · Irit kota',
        seats: '2 orang',
        transmission: 'Matic',
        fuel: 'Full to full',
        price: 75000,
        rating: '4.8',
        trips: '1,4 rb trip',
        image: 'https://images.unsplash.com/photo-1525160354320-d8e92641c563?auto=format&fit=crop&w=900&q=80',
    },
    {
        slug: 'toyota-avanza',
        name: 'Toyota Avanza',
        type: 'Mobil',
        spec: '1.5L · Keluarga',
        seats: '7 orang',
        transmission: 'Matic',
        fuel: 'Full to full',
        price: 350000,
        rating: '4.8',
        trips: '980 trip',
        tag: 'Favorit keluarga',
        image: 'https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=900&q=80',
    },
    {
        slug: 'honda-brio',
        name: 'Honda Brio',
        type: 'Mobil',
        spec: '1.2L · Lincah kota',
        seats: '5 orang',
        transmission: 'Matic',
        fuel: 'Full to full',
        price: 300000,
        rating: '4.9',
        trips: '760 trip',
        image: 'https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=900&q=80',
    },
    {
        slug: 'toyota-innova-reborn',
        name: 'Innova Reborn',
        type: 'Mobil',
        spec: '2.0L · + Driver opsional',
        seats: '7 orang',
        transmission: 'Matic',
        fuel: 'Full to full',
        price: 550000,
        rating: '4.9',
        trips: '640 trip',
        image: 'https://images.unsplash.com/photo-1551830820-330a71b99659?auto=format&fit=crop&w=900&q=80',
    },
];

const testimonials = [
    {
        quote: 'Landing di Adi Soemarmo jam 6 pagi, unit Avanza sudah standby di parkiran. Difotoin kondisi bensin dan bodi sebelum jalan — rapi banget.',
        name: 'Ratih Prameswari',
        meta: 'Jakarta · Avanza 3 hari',
    },
    {
        quote: 'Sewa NMAX buat keliling ke Karanganyar. Rem, ban, oli dicek bareng mekaniknya. Nggak ada drama “biaya tambahan” di akhir.',
        name: 'Daniel Hutapea',
        meta: 'Medan · NMAX 2 hari',
    },
    {
        quote: 'Booking buat rombongan kantor 3 Innova + driver. Invoice jelas, drivernya hafal jalan Solo–Jogja. Finance kami sampai minta langganan.',
        name: 'Bagas Wicaksono',
        meta: 'Surabaya · Korporat',
    },
    {
        quote: 'Motor diantar ke hotel di Slamet Riyadi, pas kembali dijemput lagi. CS fast respon di WhatsApp, bahkan jam 11 malam.',
        name: 'Sarah Lim',
        meta: 'Kuala Lumpur · Vario 4 hari',
    },
];

const faqs: Array<[string, string]> = [
    [
        'Dokumen apa yang perlu disiapkan?',
        'KTP + SIM yang masih berlaku (SIM C untuk motor, SIM A untuk mobil). Untuk WNA: paspor + SIM internasional. Dokumen difoto saat serah terima, data tidak disimpan melebihi masa sewa.',
    ],
    [
        'Apakah bisa tanpa datang ke outlet?',
        'Bisa. Pilih “Antar ke lokasi” saat booking — kami antar ke hotel, Stasiun Solo Balapan, Terminal Tirtonadi, atau Bandara Adi Soemarmo. Biaya antar Rp25–50rb tergantung jarak, gratis untuk sewa ≥3 hari di area kota.',
    ],
    [
        'Bagaimana skema bensin dan overtime?',
        'Semua unit diserahkan full tank dan dikembalikan full tank. Keterlambatan dihitung Rp25rb/jam (motor) dan Rp50rb/jam (mobil), maksimal 3 jam — selebihnya dihitung 1 hari. Semua tertulis di invoice sebelum bayar.',
    ],
    [
        'Apakah ada jaminan / deposit?',
        'Motor: tanpa deposit, cukup KTP + SIM fisik. Mobil lepas kunci: deposit Rp500rb (kembali penuh saat unit dicek). Dengan driver: tanpa deposit.',
    ],
    [
        'Bagaimana jika unit mogok di jalan?',
        'Telepon operasional 24/7. Di area Solo Raya kami kirim unit pengganti maksimal 90 menit. Di luar area, biaya derek/bengkel resmi kami tanggung selama bukan kelalaian pemakaian.',
    ],
    [
        'Apakah tersedia sewa bulanan / korporat?',
        'Ya. Skema bulanan lebih hemat 25–40% termasuk servis berkala. Untuk korporat kami sediakan invoice, PKS, dan laporan kilometer. Hubungi operasional untuk penawaran.',
    ],
];

const outlets = [
    {
        name: 'Outlet Slamet Riyadi',
        address: 'Jl. Slamet Riyadi No. 452, Laweyan, Solo',
        hours: 'Setiap hari · 07.00–21.00',
        note: 'Pusat — semua unit & mekanik standby',
    },
    {
        name: 'Counter Stasiun Balapan',
        address: 'Area parkir timur Stasiun Solo Balapan',
        hours: 'Setiap hari · 06.00–22.00',
        note: 'Ambil langsung turun kereta',
    },
    {
        name: 'Bandara Adi Soemarmo',
        address: 'Meeting point kedatangan, Boyolali',
        hours: 'Menyesuaikan jadwal penerbangan',
        note: 'Unit standby sesuai jam landing',
    },
];

const timeline = [
    [
        '2019',
        'Mulai dari 8 motor di kontrakan Laweyan. Fokus ke mahasiswa UNS & wisatawan backpacker.',
    ],
    [
        '2021',
        'Tambah lini mobil + buka outlet Slamet Riyadi. Mulai sistem checklist 21 titik.',
    ],
    [
        '2023',
        'Layanan antar Stasiun & Bandara. 60+ unit, tim mekanik dan driver tetap.',
    ],
    [
        '2026',
        '120+ unit, booking online, serah terima difoto + invoice digital.',
    ],
] as Array<[string, string]>;

/* ---------------------------------- hooks --------------------------------- */

function useScrolled(threshold = 12) {
    const [scrolled, setScrolled] = useState(false);
    useEffect(() => {
        const onScroll = () => setScrolled(window.scrollY > threshold);
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });
        return () => window.removeEventListener('scroll', onScroll);
    }, [threshold]);
    return scrolled;
}

function useReveal(dep: unknown = null) {
    useEffect(() => {
        const els = Array.from(
            document.querySelectorAll<HTMLElement>(
                '[data-reveal]:not(.is-visible)',
            ),
        );
        if (!('IntersectionObserver' in window)) {
            els.forEach((el) => el.classList.add('is-visible'));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        entry.target.classList.add('is-visible');
                        io.unobserve(entry.target);
                    }
                });
            },
            { threshold: 0.12, rootMargin: '0px 0px -40px 0px' },
        );
        els.forEach((el) => io.observe(el));
        return () => io.disconnect();
    }, [dep]);
}

function CountUp({
    to,
    decimals = 0,
    suffix = '',
    duration = 1200,
}: {
    to: number;
    decimals?: number;
    suffix?: string;
    duration?: number;
}) {
    const ref = useRef<HTMLSpanElement>(null);
    const [value, setValue] = useState(0);
    const started = useRef(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;
        const reduce = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        if (reduce) {
            setValue(to);
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                if (entries[0].isIntersecting && !started.current) {
                    started.current = true;
                    const t0 = performance.now();
                    const tick = (t: number) => {
                        const p = Math.min(1, (t - t0) / duration);
                        const eased = 1 - Math.pow(1 - p, 3);
                        setValue(to * eased);
                        if (p < 1) requestAnimationFrame(tick);
                    };
                    requestAnimationFrame(tick);
                    io.disconnect();
                }
            },
            { threshold: 0.4 },
        );
        io.observe(el);
        return () => io.disconnect();
    }, [to, duration]);

    return (
        <span ref={ref} className="tabular-nums">
            {value.toFixed(decimals).replace('.', ',')}
            {suffix}
        </span>
    );
}

const rupiah = (n: number) =>
    'Rp' + n.toLocaleString('id-ID').replace(/,/g, '.');

/* --------------------------------- pieces --------------------------------- */

function Eyebrow({ children }: { children: React.ReactNode }) {
    return (
        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-stone-500 uppercase">
            <span className="h-px w-6 bg-[#FF9137]" aria-hidden />
            {children}
        </p>
    );
}

function Stars() {
    return (
        <span
            className="flex items-center gap-0.5"
            aria-label="Rating 4.9 dari 5"
        >
            {Array.from({ length: 5 }).map((_, i) => (
                <Star
                    key={i}
                    size={13}
                    className="fill-[#FF9137] text-[#FF9137]"
                />
            ))}
        </span>
    );
}

/* ----------------------------------- page ---------------------------------- */

const toISODate = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDaysISO = (iso: string, n: number) => {
    const d = new Date(`${iso}T00:00:00`);
    d.setDate(d.getDate() + n);
    return toISODate(d);
};

const diffDays = (start: string, end: string) =>
    Math.max(1, Math.round((new Date(`${end}T00:00:00`).getTime() - new Date(`${start}T00:00:00`).getTime()) / 86400000));

export default function Welcome() {
    const scrolled = useScrolled();
    const [menuOpen, setMenuOpen] = useState(false);
    const [vehicleType, setVehicleType] = useState<'Motor' | 'Mobil'>('Motor');
    const [category, setCategory] = useState<'Semua' | 'Motor' | 'Mobil'>(
        'Semua',
    );
    // Widget pencarian: tanggal terikat dua arah dengan durasi, lalu
    // diteruskan sebagai query ke katalog (/vehicles?category=&start_date=&end_date=).
    const [startDate, setStartDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        return toISODate(d);
    });
    const [endDate, setEndDate] = useState(() => {
        const d = new Date();
        d.setDate(d.getDate() + 4);
        return toISODate(d);
    });
    const [days, setDays] = useState(3);
    const [openFaq, setOpenFaq] = useState<number | null>(0);
    const [quoteIndex, setQuoteIndex] = useState(0);
    const [spotService, setSpotService] = useState<number>(1);
    const [hoverService, setHoverService] = useState<number | null>(null);
    const litService = hoverService ?? spotService;

    useReveal(category);

    const onStartChange = (v: string) => {
        if (!v) return;
        setStartDate(v);
        const end = endDate < v ? v : endDate;
        setEndDate(end);
        setDays(diffDays(v, end));
    };

    const onEndChange = (v: string) => {
        if (!v) return;
        const end = v < startDate ? startDate : v;
        setEndDate(end);
        setDays(diffDays(startDate, end));
    };

    const onDaysChange = (n: number) => {
        const d = Math.min(30, Math.max(1, n));
        setDays(d);
        setEndDate(addDaysISO(startDate, d));
    };

    const searchHref = `/vehicles?category=${vehicleType.toLowerCase()}&start_date=${startDate}&end_date=${endDate}`;

    const filtered = useMemo(
        () => fleet.filter((f) => category === 'Semua' || f.type === category),
        [category],
    );

    const nextQuote = useCallback(
        () => setQuoteIndex((i) => (i + 1) % testimonials.length),
        [],
    );
    const prevQuote = useCallback(
        () =>
            setQuoteIndex(
                (i) => (i - 1 + testimonials.length) % testimonials.length,
            ),
        [],
    );

    useEffect(() => {
        const reduce = window.matchMedia(
            '(prefers-reduced-motion: reduce)',
        ).matches;
        if (reduce) return;
        const id = window.setInterval(nextQuote, 7000);
        return () => window.clearInterval(id);
    }, [nextQuote]);

    return (
        <>
            <Head title="Sewa Motor & Mobil di Solo — SoloRent" />
            <div className="min-h-screen bg-[#F7F2EB] text-[#241203] antialiased">
                {/* ------------------------------- header ------------------------------ */}
                <header
                    className={`fixed inset-x-0 top-0 z-40 transition-[background-color,border-color,backdrop-filter] duration-200 ease-out ${
                        scrolled
                            ? 'border-b border-[#241203]/10 bg-[#F7F2EB]/85 backdrop-blur-md'
                            : 'border-b border-transparent bg-transparent'
                    }`}
                >
                    <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:h-[72px] lg:px-8">
                        <Link
                            href="/"
                            className="pressable flex items-center gap-2.5"
                            aria-label="SoloRent — beranda"
                        >
                            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF9137] text-[#241203]">
                                <Bike size={18} strokeWidth={2.2} />
                            </span>
                            <span className="text-[17px] font-bold tracking-tight">
                                SoloRent
                                <span className="ml-1.5 hidden rounded-full border border-[#241203]/15 px-2 py-0.5 align-middle text-[10px] font-semibold tracking-wide text-stone-500 xl:inline-block">
                                    SOLO · EST. 2019
                                </span>
                            </span>
                        </Link>

                        <nav
                            className="hidden items-center gap-6 text-[13.5px] font-medium text-stone-600 xl:flex"
                            aria-label="Navigasi utama"
                        >
                            {[
                                ['Profil', '#profil'],
                                ['Armada', '#armada'],
                                ['Layanan', '#layanan'],
                                ['Outlet', '#outlet'],
                                ['FAQ', '#faq'],
                            ].map(([label, href]) => (
                                <a
                                    key={href}
                                    href={href}
                                    className="link-underline hover:text-stone-950"
                                >
                                    {label}
                                </a>
                            ))}
                        </nav>

                        <div className="flex items-center gap-2.5">
                            <a
                                href="tel:+62895364727475"
                                className="pressable hidden items-center gap-2 rounded-full border border-[#241203]/15 bg-white/60 px-3.5 py-2 text-[13px] font-semibold whitespace-nowrap xl:flex"
                            >
                                <Phone size={14} />
                                0895-3647-27475
                            </a>
                            <Link
                                href="/booking/check"
                                className="pressable hidden items-center gap-1.5 rounded-full border-2 border-[#241203]/15 bg-white/60 px-4 py-2 text-[13px] font-semibold whitespace-nowrap text-[#241203] transition-[border-color] duration-200 ease-out hover:border-[#241203]/40 sm:flex"
                            >
                                <Search size={14} />
                                Cek Status
                            </Link>
                            <Link
                                href="/vehicles"
                                className="pressable hidden items-center gap-1.5 rounded-full bg-[#FF9137] px-4.5 py-2.5 text-[13.5px] font-semibold whitespace-nowrap text-[#241203] sm:flex"
                                style={{ paddingLeft: 18, paddingRight: 18 }}
                            >
                                Sewa sekarang
                                <ArrowRight size={15} />
                            </Link>
                            <button
                                onClick={() => setMenuOpen((v) => !v)}
                                aria-label={
                                    menuOpen ? 'Tutup menu' : 'Buka menu'
                                }
                                aria-expanded={menuOpen}
                                className="pressable rounded-full border border-[#241203]/15 bg-white/70 p-2.5 xl:hidden"
                            >
                                {menuOpen ? (
                                    <X size={18} />
                                ) : (
                                    <Menu size={18} />
                                )}
                            </button>
                        </div>
                    </div>

                    {menuOpen && (
                        <nav
                            className="animate-fade-up border-t border-[#241203]/10 bg-[#F7F2EB] px-5 pt-2 pb-5 xl:hidden"
                            aria-label="Navigasi seluler"
                        >
                            <a
                                href="tel:+62895364727475"
                                className="flex items-center gap-2.5 border-b border-[#241203]/8 py-3.5 text-[15px] font-semibold"
                            >
                                <Phone size={16} className="text-stone-400" />
                                0895-3647-27475
                            </a>
                            {[
                                ['Profil perusahaan', '#profil'],
                                ['Armada & harga', '#armada'],
                                ['Layanan', '#layanan'],
                                ['Outlet & area', '#outlet'],
                                ['FAQ', '#faq'],
                                ['Cek booking', '/booking/check'],
                            ].map(([label, href]) => (
                                <a
                                    key={label}
                                    href={href}
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center justify-between border-b border-[#241203]/8 py-3.5 text-[15px] font-medium"
                                >
                                    {label}
                                    <ArrowUpRight
                                        size={16}
                                        className="text-stone-400"
                                    />
                                </a>
                            ))}
                            <Link
                                href="/vehicles"
                                className="pressable mt-4 flex items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3.5 text-sm font-semibold text-[#241203]"
                            >
                                Sewa sekarang <ArrowRight size={16} />
                            </Link>
                        </nav>
                    )}
                </header>

                <main>
                    {/* -------------------------------- hero ------------------------------- */}
                    <section className="relative overflow-hidden pt-28 sm:pt-36">
                        <div
                            className="bg-grid-faint pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_55%_at_50%_0%,black,transparent)]"
                            aria-hidden
                        />
                        <div className="relative mx-auto max-w-6xl px-5 lg:px-8">
                            <div className="grid items-start gap-10 lg:grid-cols-[1.04fr_0.96fr] lg:gap-14">
                                <div data-reveal>
                                    <div className="inline-flex items-center gap-2 rounded-full border border-[#241203]/12 bg-white py-1.5 pr-3.5 pl-1.5 text-xs font-medium text-stone-700 shadow-sm">
                                        <span className="flex items-center gap-1.5 rounded-full bg-[#70FFD2]/40 px-2.5 py-1 font-semibold text-[#0B6B4F]">
                                            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-[#0B6B4F]" />
                                            18 unit siap hari ini
                                        </span>
                                        Outlet Slamet Riyadi buka s/d 21.00
                                    </div>

                                    <h1 className="mt-6 text-[40px] leading-[1.02] font-bold tracking-[-0.03em] text-balance sm:text-6xl lg:text-[68px]">
                                        Keliling Solo dengan unit yang{' '}
                                        <em className="font-editorial font-normal italic">
                                            siap jalan.
                                        </em>
                                    </h1>

                                    <p className="mt-5 max-w-xl text-[15.5px] leading-7 text-stone-600 sm:text-base">
                                        SoloRent adalah rental motor &amp; mobil
                                        lepas kunci dan dengan driver. Semua
                                        unit lolos checklist 21 titik, harga
                                        dihitung per 24 jam secara transparan,
                                        dan bisa diantar ke stasiun, bandara,
                                        atau hotel Anda.
                                    </p>

                                    <div className="mt-7 flex flex-wrap items-center gap-3">
                                        <Link
                                            href="/vehicles"
                                            className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-6 py-3.5 text-sm font-semibold text-[#241203] shadow-[0_12px_28px_-12px_rgb(255_145_55/0.6)]"
                                        >
                                            Lihat armada &amp; harga
                                            <ArrowRight size={16} />
                                        </Link>
                                        <Link
                                            href="/booking/check"
                                            className="pressable flex items-center gap-2 rounded-full border border-[#241203]/15 bg-white px-6 py-3.5 text-sm font-semibold"
                                        >
                                            <CalendarDays size={16} />
                                            Cek booking saya
                                        </Link>
                                    </div>

                                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-4">
                                        <div className="flex items-center">
                                            {['12', '32', '45', '56'].map(
                                                (img) => (
                                                    <img
                                                        key={img}
                                                        src={`https://i.pravatar.cc/64?img=${img}`}
                                                        alt=""
                                                        loading="lazy"
                                                        className="-ml-2 h-8 w-8 rounded-full border-2 border-[#F7F2EB] object-cover first:ml-0"
                                                    />
                                                ),
                                            )}
                                            <div className="ml-3">
                                                <Stars />
                                                <p className="mt-0.5 text-xs font-medium text-stone-600">
                                                    <strong className="text-[#241203]">
                                                        4.9/5
                                                    </strong>{' '}
                                                    · 2.300+ ulasan
                                                </p>
                                            </div>
                                        </div>
                                        <div className="hidden h-9 w-px bg-[#241203]/10 sm:block" />
                                        <div className="flex items-center gap-5 text-[13px] text-stone-600">
                                            <span className="flex items-center gap-1.5">
                                                <ShieldCheck
                                                    size={15}
                                                    className="text-stone-800"
                                                />
                                                NIB &amp; asuransi
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <BadgeCheck
                                                    size={15}
                                                    className="text-stone-800"
                                                />
                                                STNK lengkap
                                            </span>
                                        </div>
                                    </div>
                                </div>

                                {/* booking card */}
                                <div
                                    data-reveal="right"
                                    style={{
                                        ['--reveal-delay' as string]: '120ms',
                                    }}
                                >
                                    <div className="overflow-hidden rounded-3xl border border-[#241203]/10 bg-white shadow-[0_32px_64px_-32px_rgb(0_0_0/0.3)]">
                                        <div className="img-zoom relative h-44 overflow-hidden sm:h-52">
                                            <img
                                                src="https://images.unsplash.com/photo-1449965408869-eaa3f722e40d?auto=format&fit=crop&w=1200&q=80"
                                                alt="Berkendara di jalan Solo"
                                                className="h-full w-full object-cover"
                                            />
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
                                            <div className="absolute right-4 bottom-4 left-4 flex items-end justify-between text-white">
                                                <div>
                                                    <p className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-80">
                                                        Estimasi Anda
                                                    </p>
                                                    <p className="mt-1 text-xl font-bold tracking-tight">
                                                        {vehicleType === 'Motor'
                                                            ? rupiah(
                                                                  85000 * days,
                                                              )
                                                            : rupiah(
                                                                  350000 * days,
                                                              )}{' '}
                                                        <span className="text-xs font-medium opacity-70">
                                                            / {days} hari
                                                        </span>
                                                    </p>
                                                </div>
                                                <span className="rounded-full bg-white/15 px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md">
                                                    per 24 jam · full to full
                                                </span>
                                            </div>
                                        </div>

                                        <div className="p-5 sm:p-6">
                                            <div
                                                className="grid grid-cols-2 gap-2 rounded-2xl bg-[#F7F2EB] p-1"
                                                role="tablist"
                                                aria-label="Pilih jenis kendaraan"
                                            >
                                                {(
                                                    ['Motor', 'Mobil'] as const
                                                ).map((type) => (
                                                    <button
                                                        key={type}
                                                        role="tab"
                                                        aria-selected={
                                                            vehicleType === type
                                                        }
                                                        onClick={() =>
                                                            setVehicleType(type)
                                                        }
                                                        className={`pressable flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13.5px] font-semibold transition-[background-color,color,box-shadow] duration-200 ease-out ${
                                                            vehicleType === type
                                                                ? 'bg-white text-[#241203] shadow-sm'
                                                                : 'text-stone-500'
                                                        }`}
                                                    >
                                                        {type === 'Motor' ? (
                                                            <Bike size={16} />
                                                        ) : (
                                                            <CarFront
                                                                size={16}
                                                            />
                                                        )}
                                                        {type}
                                                        <span className="hidden text-[11px] font-medium text-stone-400 sm:inline">
                                                            {type === 'Motor'
                                                                ? '75rb+'
                                                                : '300rb+'}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>

                                            <div className="mt-4 grid grid-cols-2 gap-3">
                                                <label className="rounded-2xl border border-stone-200 bg-white p-3 transition-[border-color] duration-200 ease-out focus-within:border-[#FF9137]">
                                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                                                        <CalendarDays
                                                            size={13}
                                                        />{' '}
                                                        Mulai
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={startDate}
                                                        min={toISODate(new Date())}
                                                        onChange={(e) => onStartChange(e.target.value)}
                                                        aria-label="Tanggal mulai sewa"
                                                        className="mt-1.5 w-full bg-transparent text-[13.5px] font-semibold outline-none"
                                                    />
                                                </label>
                                                <label className="rounded-2xl border border-stone-200 bg-white p-3 transition-[border-color] duration-200 ease-out focus-within:border-[#FF9137]">
                                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                                                        <CalendarDays
                                                            size={13}
                                                        />{' '}
                                                        Selesai
                                                    </span>
                                                    <input
                                                        type="date"
                                                        value={endDate}
                                                        min={startDate}
                                                        onChange={(e) => onEndChange(e.target.value)}
                                                        aria-label="Tanggal selesai sewa"
                                                        className="mt-1.5 w-full bg-transparent text-[13.5px] font-semibold outline-none"
                                                    />
                                                </label>
                                            </div>

                                            <div className="mt-3 flex gap-3">
                                                <label className="flex-1 rounded-2xl border border-stone-200 bg-white p-3 transition-[border-color] duration-200 ease-out focus-within:border-[#FF9137]">
                                                    <span className="flex items-center gap-1.5 text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                                                        <MapPin size={13} />{' '}
                                                        Ambil di
                                                    </span>
                                                    <select
                                                        className="mt-1.5 w-full bg-transparent text-[13.5px] font-semibold outline-none"
                                                        defaultValue="Outlet Slamet Riyadi"
                                                    >
                                                        <option>
                                                            Outlet Slamet Riyadi
                                                        </option>
                                                        <option>
                                                            Stasiun Solo Balapan
                                                        </option>
                                                        <option>
                                                            Bandara Adi Soemarmo
                                                        </option>
                                                        <option>
                                                            Antar ke hotel / kos
                                                        </option>
                                                    </select>
                                                </label>
                                                <div className="flex w-[118px] flex-col justify-between rounded-2xl border border-stone-200 p-3">
                                                    <span className="text-[11px] font-semibold tracking-wide text-stone-500 uppercase">
                                                        Durasi
                                                    </span>
                                                    <div className="flex items-center justify-between">
                                                        <button
                                                            aria-label="Kurangi durasi"
                                                            onClick={() => onDaysChange(days - 1)}
                                                            className="pressable rounded-full border border-stone-200 p-1.5"
                                                        >
                                                            <Minus size={13} />
                                                        </button>
                                                        <span className="text-sm font-bold tabular-nums">
                                                            {days} hr
                                                        </span>
                                                        <button
                                                            aria-label="Tambah durasi"
                                                            onClick={() => onDaysChange(days + 1)}
                                                            className="pressable rounded-full border border-stone-200 p-1.5"
                                                        >
                                                            <Plus size={13} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>

                                            <Link
                                                href={searchHref}
                                                className="pressable mt-4 flex items-center justify-center gap-2 rounded-2xl bg-[#FF9137] py-4 text-sm font-semibold text-[#241203]"
                                            >
                                                Cari {vehicleType.toLowerCase()}{' '}
                                                yang tersedia
                                                <ArrowRight size={16} />
                                            </Link>
                                            <p className="mt-3 text-center text-xs leading-5 text-stone-500">
                                                Tanpa DP untuk motor · Bayar
                                                setelah unit dicek bersama
                                            </p>
                                        </div>
                                    </div>

                                    <div className="mt-3 grid grid-cols-3 gap-2.5 text-[12px]">
                                        {[
                                            ['Stasiun', '6 mnt'],
                                            ['Bandara', '35 mnt'],
                                            ['Hotel kota', 'Antar gratis*'],
                                        ].map(([a, b]) => (
                                            <div
                                                key={a}
                                                className="rounded-2xl border border-[#241203]/10 bg-white/70 px-3 py-2.5 text-center backdrop-blur-sm"
                                            >
                                                <p className="font-semibold text-[#241203]">
                                                    {a}
                                                </p>
                                                <p className="text-stone-500">
                                                    {b}
                                                </p>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* marquee */}
                            <div
                                className="marquee-mask mt-14 overflow-hidden border-y border-[#241203]/10 py-3.5"
                                data-reveal
                                aria-label="Area layanan antar"
                            >
                                <div className="animate-marquee flex w-max items-center gap-8 text-[12.5px] font-semibold tracking-[0.12em] text-stone-500 uppercase">
                                    {Array.from({ length: 2 }).map((_, k) => (
                                        <div
                                            key={k}
                                            className="flex items-center gap-8"
                                            aria-hidden={k === 1}
                                        >
                                            {[
                                                'Stasiun Solo Balapan',
                                                'Bandara Adi Soemarmo',
                                                'Terminal Tirtonadi',
                                                'Jl. Slamet Riyadi',
                                                'UNS & UMS',
                                                'Karanganyar',
                                                'Sukoharjo',
                                                'Klaten',
                                            ].map((place) => (
                                                <span
                                                    key={place}
                                                    className="flex items-center gap-8"
                                                >
                                                    {place}
                                                    <span className="h-1 w-1 rounded-full bg-stone-300" />
                                                </span>
                                            ))}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ------------------------------ profil ------------------------------ */}
                    <section
                        id="profil"
                        className="scroll-mt-24 bg-white py-20 sm:py-28"
                    >
                        <div className="mx-auto max-w-6xl px-5 lg:px-8">
                            <div className="grid gap-12 lg:grid-cols-[0.9fr_1.1fr] lg:gap-16">
                                <div
                                    className="lg:sticky lg:top-24 lg:self-start"
                                    data-reveal="left"
                                >
                                    <Eyebrow>Profil perusahaan</Eyebrow>
                                    <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-balance sm:text-[40px] sm:leading-[1.08]">
                                        Rental lokal Solo yang{' '}
                                        <em className="font-editorial font-normal italic">
                                            operasionalnya rapi.
                                        </em>
                                    </h2>
                                    <p className="mt-5 text-[15px] leading-7 text-stone-600">
                                        <strong className="font-semibold text-[#241203]">
                                            PT Solo Rent Mobility
                                        </strong>{' '}
                                        berdiri 2019 di Laweyan. Kami
                                        menghilangkan hal yang paling
                                        menyebalkan dari sewa kendaraan: unit
                                        yang tidak sesuai foto, harga yang
                                        berubah di akhir, dan CS yang sulit
                                        dihubungi.
                                    </p>
                                    <p className="mt-4 text-[15px] leading-7 text-stone-600">
                                        Setiap serah terima difoto bersama,
                                        bensin dicatat, dan invoice digital
                                        dikirim sebelum pembayaran. Sederhana —
                                        tapi konsisten kami jalankan 7 tahun.
                                    </p>

                                    <div className="mt-6 flex flex-wrap gap-2">
                                        {[
                                            'NIB 912010xxx',
                                            'Asuransi unit',
                                            'Mekanik tetap',
                                            'Invoice digital',
                                        ].map((chip) => (
                                            <span
                                                key={chip}
                                                className="flex items-center gap-1.5 rounded-full border border-stone-200 bg-[#F7F2EB] px-3 py-1.5 text-xs font-semibold text-stone-700"
                                            >
                                                <Check
                                                    size={13}
                                                    className="text-[#0B6B4F]"
                                                />
                                                {chip}
                                            </span>
                                        ))}
                                    </div>

                                    <div className="mt-8 flex flex-wrap gap-3">
                                        <a
                                            href="#armada"
                                            className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-5 py-3 text-[13.5px] font-semibold text-[#241203]"
                                        >
                                            Lihat armada{' '}
                                            <ArrowRight size={15} />
                                        </a>
                                        <a
                                            href="https://wa.me/62895364727475"
                                            className="pressable flex items-center gap-2 rounded-full border border-[#241203]/15 px-5 py-3 text-[13.5px] font-semibold"
                                        >
                                            <Headset size={15} />
                                            Chat operasional
                                        </a>
                                    </div>
                                </div>

                                <div>
                                    <div
                                        className="grid grid-cols-2 gap-3"
                                        data-reveal="right"
                                    >
                                        {[
                                            {
                                                v: (
                                                    <CountUp
                                                        to={7}
                                                        suffix=" thn"
                                                    />
                                                ),
                                                l: 'Beroperasi di Solo',
                                            },
                                            {
                                                v: (
                                                    <CountUp
                                                        to={120}
                                                        suffix="+"
                                                    />
                                                ),
                                                l: 'Unit motor & mobil',
                                            },
                                            {
                                                v: (
                                                    <CountUp
                                                        to={12.4}
                                                        decimals={1}
                                                        suffix=" rb"
                                                    />
                                                ),
                                                l: 'Perjalanan selesai',
                                            },
                                            {
                                                v: (
                                                    <CountUp
                                                        to={4.9}
                                                        decimals={1}
                                                        suffix="/5"
                                                    />
                                                ),
                                                l: 'Rating 2.300+ ulasan',
                                            },
                                        ].map((s) => (
                                            <div
                                                key={s.l}
                                                className="rounded-3xl border border-[#241203]/10 bg-[#F7F2EB] p-5 sm:p-6"
                                            >
                                                <p className="text-2xl font-bold tracking-tight tabular-nums sm:text-[32px]">
                                                    {s.v}
                                                </p>
                                                <p className="mt-1 text-[13px] text-stone-500">
                                                    {s.l}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    <div
                                        className="mt-6 rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-7"
                                        data-reveal
                                    >
                                        <p className="text-[11px] font-bold tracking-[0.16em] text-stone-500 uppercase">
                                            Perjalanan kami
                                        </p>
                                        <ol className="mt-5 space-y-0">
                                            {timeline.map(([year, desc], i) => (
                                                <li
                                                    key={year}
                                                    className="relative flex gap-4 pb-6 last:pb-0"
                                                >
                                                    <div className="flex flex-col items-center">
                                                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#241203] text-[10px] font-bold text-white">
                                                            {String(
                                                                i + 1,
                                                            ).padStart(2, '0')}
                                                        </span>
                                                        {i <
                                                            timeline.length -
                                                                1 && (
                                                            <span
                                                                className="mt-1 w-px flex-1 bg-[#FF9137]/40"
                                                                aria-hidden
                                                            />
                                                        )}
                                                    </div>
                                                    <div className="pb-1">
                                                        <p className="text-sm font-bold">
                                                            {year}
                                                        </p>
                                                        <p className="mt-1 text-[13.5px] leading-6 text-stone-600">
                                                            {desc}
                                                        </p>
                                                    </div>
                                                </li>
                                            ))}
                                        </ol>
                                    </div>

                                    <div
                                        className="mt-3 grid gap-3 sm:grid-cols-2"
                                        data-reveal
                                    >
                                        <div className="img-zoom overflow-hidden rounded-3xl border border-[#241203]/10">
                                            <img
                                                src="https://images.unsplash.com/photo-1558981806-ec527fa84c39?auto=format&fit=crop&w=800&q=80"
                                                alt="Teknisi memeriksa motor SoloRent"
                                                loading="lazy"
                                                className="h-52 w-full object-cover sm:h-60"
                                            />
                                        </div>
                                        <div className="flex flex-col justify-between rounded-3xl bg-[#241203] p-6 text-white sm:h-60">
                                            <Wrench
                                                size={22}
                                                className="text-white/70"
                                            />
                                            <div>
                                                <p className="font-editorial text-2xl italic">
                                                    “21 titik dicek.”
                                                </p>
                                                <p className="mt-2 text-[13px] leading-6 text-white/70">
                                                    Rem, ban, oli, lampu, STNK —
                                                    dicek bareng penyewa sebelum
                                                    kunci diserahkan.
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ------------------------------ armada ------------------------------ */}
                    <section
                        id="armada"
                        className="scroll-mt-24 py-20 sm:py-28"
                    >
                        <div className="mx-auto max-w-6xl px-5 lg:px-8">
                            <div
                                className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between"
                                data-reveal
                            >
                                <div className="max-w-xl">
                                    <Eyebrow>Armada &amp; harga</Eyebrow>
                                    <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-balance sm:text-[40px] sm:leading-[1.08]">
                                        Pilih unit yang{' '}
                                        <em className="font-editorial font-normal italic">
                                            benar-benar tersedia.
                                        </em>
                                    </h2>
                                    <p className="mt-4 text-[15px] leading-7 text-stone-600">
                                        Stok di bawah ini sinkron dengan outlet.
                                        Harga per 24 jam, sudah termasuk servis
                                        &amp; helm / P3K. Tanpa biaya siluman.
                                    </p>
                                </div>
                                <div
                                    className="flex gap-2"
                                    role="tablist"
                                    aria-label="Filter kategori"
                                >
                                    {(['Semua', 'Motor', 'Mobil'] as const).map(
                                        (c) => (
                                            <button
                                                key={c}
                                                role="tab"
                                                aria-selected={category === c}
                                                onClick={() => setCategory(c)}
                                                className={`pressable flex items-center gap-1.5 rounded-full px-4.5 py-2.5 text-[13px] font-semibold transition-[background-color,color,border-color] duration-200 ease-out ${
                                                    category === c
                                                        ? 'bg-[#FF9137] text-[#241203]'
                                                        : 'border border-[#241203]/15 bg-white text-stone-600'
                                                }`}
                                                style={{
                                                    paddingLeft: 18,
                                                    paddingRight: 18,
                                                }}
                                            >
                                                {c === 'Motor' ? (
                                                    <Bike size={14} />
                                                ) : c === 'Mobil' ? (
                                                    <CarFront size={14} />
                                                ) : null}
                                                {c}
                                            </button>
                                        ),
                                    )}
                                </div>
                            </div>

                            <div
                                key={category}
                                className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
                            >
                                {filtered.map((v, i) => (
                                    <article
                                        key={v.name}
                                        data-reveal="scale"
                                        style={{
                                            ['--reveal-delay' as string]: `${i * 70}ms`,
                                        }}
                                        className="lift group overflow-hidden rounded-3xl border border-[#241203]/10 bg-white"
                                    >
                                        <div className="img-zoom relative h-52 overflow-hidden bg-[#F7F2EB]">
                                            <img
                                                src={v.image}
                                                alt={v.name}
                                                loading="lazy"
                                                className="h-full w-full object-cover"
                                            />
                                            <span className="absolute top-3.5 left-3.5 flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#0B6B4F] shadow-sm backdrop-blur-sm">
                                                <span className="h-1.5 w-1.5 rounded-full bg-[#0B6B4F]" />
                                                Tersedia
                                            </span>
                                            <span className="absolute top-3.5 right-3.5 rounded-full bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-sm">
                                                {v.type}
                                            </span>
                                            {v.tag && (
                                                <span className="absolute bottom-3.5 left-3.5 rounded-full bg-[#FFFC8C] px-3 py-1.5 text-[11px] font-semibold text-[#241203]">
                                                    {v.tag}
                                                </span>
                                            )}
                                        </div>
                                        <div className="p-5">
                                            <div className="flex items-start justify-between gap-3">
                                                <div>
                                                    <h3 className="text-[16px] font-bold tracking-tight">
                                                        {v.name}
                                                    </h3>
                                                    <p className="mt-0.5 text-[13px] text-stone-500">
                                                        {v.spec}
                                                    </p>
                                                </div>
                                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-[#F7F2EB] px-2.5 py-1 text-xs font-bold">
                                                    <Star
                                                        size={12}
                                                        className="fill-[#FF9137] text-[#FF9137]"
                                                    />
                                                    {v.rating}
                                                </span>
                                            </div>
                                            <div className="mt-4 flex items-center gap-4 border-t border-dashed border-stone-200 pt-4 text-xs text-stone-500">
                                                <span className="flex items-center gap-1.5">
                                                    <Users size={14} />{' '}
                                                    {v.seats}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Cog size={14} />{' '}
                                                    {v.transmission}
                                                </span>
                                                <span className="flex items-center gap-1.5">
                                                    <Fuel size={14} /> {v.fuel}
                                                </span>
                                            </div>
                                            <div className="mt-4 flex items-end justify-between">
                                                <p>
                                                    <span className="block text-[11px] font-medium text-stone-400">
                                                        {v.trips}
                                                    </span>
                                                    <strong className="text-lg font-bold tracking-tight tabular-nums">
                                                        {rupiah(v.price)}
                                                    </strong>
                                                    <span className="text-[13px] text-stone-500">
                                                        /24 jam
                                                    </span>
                                                </p>
                                                <Link
                                                    href={`/vehicles/${v.slug}`}
                                                    className="pressable flex items-center gap-1 rounded-full bg-[#241203] px-4 py-2.5 text-[13px] font-semibold text-white"
                                                >
                                                    Detail
                                                    <ArrowRight size={14} />
                                                </Link>
                                            </div>
                                        </div>
                                    </article>
                                ))}
                            </div>

                            <div data-reveal className="mt-8 text-center">
                                <Link
                                    href="/vehicles"
                                    className="pressable inline-flex items-center gap-2 rounded-full border border-[#241203]/15 bg-white px-6 py-3 text-sm font-semibold"
                                >
                                    Buka katalog lengkap (120+ unit)
                                    <ArrowUpRight size={16} />
                                </Link>
                            </div>
                        </div>
                    </section>

                    {/* ---------------------------- keunggulan ---------------------------- */}
                    <section className="bg-white py-20 sm:py-28">
                        <div className="mx-auto max-w-6xl px-5 lg:px-8">
                            <div className="max-w-2xl" data-reveal>
                                <Eyebrow>Kenapa SoloRent</Eyebrow>
                                <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-balance sm:text-[40px] sm:leading-[1.08]">
                                    Hal kecil yang bikin sewa{' '}
                                    <em className="font-editorial font-normal italic">
                                        terasa gampang.
                                    </em>
                                </h2>
                            </div>

                            <div className="mt-10 grid gap-4 md:grid-cols-3">
                                <div
                                    data-reveal="left"
                                    className="rounded-3xl bg-[#241203] p-7 text-white md:row-span-2"
                                >
                                    <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                                        <Wrench size={20} />
                                    </span>
                                    <h3 className="mt-16 text-xl font-bold tracking-tight sm:mt-24">
                                        Checklist 21 titik sebelum kunci dilepas
                                    </h3>
                                    <p className="mt-3 text-sm leading-6 text-white/70">
                                        Ban, rem, oli, aki, lampu, klakson, STNK
                                        — diperiksa mekanik dan difoto bersama
                                        Anda. Kalau ada yang kurang layak, unit
                                        diganti, bukan “dipaksakan”.
                                    </p>
                                    <div className="mt-6 overflow-hidden rounded-2xl">
                                        <img
                                            src="https://images.unsplash.com/photo-1487754180451-c456f719a1fc?auto=format&fit=crop&w=800&q=80"
                                            alt="Pemeriksaan mesin kendaraan"
                                            loading="lazy"
                                            className="h-44 w-full object-cover"
                                        />
                                    </div>
                                </div>

                                {[
                                    [
                                        Clock3,
                                        'Tepat waktu atau gratis antar',
                                        'Unit terlambat >30 menit dari jadwal? Biaya antar kami hapus. Keterlambatan kami tercatat di invoice — bukan janji manis.',
                                    ],
                                    [
                                        ShieldCheck,
                                        'Harga final di muka',
                                        'Yang tertera = yang dibayar. Overtime, bensin, dan deposit tertulis sebelum Anda bayar. Tidak ada “biaya kebersihan” dadakan.',
                                    ],
                                    [
                                        Headset,
                                        'CS manusia 24/7, bukan bot',
                                        'WhatsApp dibalas tim outlet Solo — rata-rata <5 menit. Mogok di Tawangmangu jam 1 pagi? Kami kirim pengganti.',
                                    ],
                                    [
                                        MapPin,
                                        'Antar–jemput Stasiun & Bandara',
                                        'Sering landing pagi / pulang malam? Unit standby di meeting point. Tinggal tunjukkan KTP + SIM, langsung jalan.',
                                    ],
                                ].map(([Icon, title, desc], i) => {
                                    const I = Icon as typeof Clock3;
                                    return (
                                        <div
                                            key={title as string}
                                            data-reveal
                                            style={{
                                                ['--reveal-delay' as string]: `${i * 70}ms`,
                                            }}
                                            className="lift rounded-3xl border border-[#241203]/10 bg-[#F7F2EB] p-6"
                                        >
                                            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#241203]/10 bg-white">
                                                <I
                                                    size={20}
                                                    className="text-[#241203]"
                                                />
                                            </span>
                                            <h3 className="mt-5 text-[16px] font-bold tracking-tight">
                                                {title as string}
                                            </h3>
                                            <p className="mt-2 text-sm leading-6 text-stone-600">
                                                {desc as string}
                                            </p>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* ----------------------------- layanan ------------------------------ */}
                    <section
                        id="layanan"
                        className="scroll-mt-24 py-20 sm:py-28"
                    >
                        <div className="mx-auto max-w-6xl px-5 lg:px-8">
                            <div
                                className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between"
                                data-reveal
                            >
                                <div>
                                    <Eyebrow>Layanan</Eyebrow>
                                    <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] sm:text-[40px]">
                                        Tiga cara pakai,{' '}
                                        <em className="font-editorial font-normal italic">
                                            tinggal pilih.
                                        </em>
                                    </h2>
                                </div>
                                <p className="max-w-sm text-sm leading-6 text-stone-500">
                                    Semua skema bisa lepas kunci atau dengan
                                    driver. BBM full-to-full, e-tol opsional.
                                </p>
                            </div>

                            <div className="mt-10 grid gap-4 lg:grid-cols-3">
                                {[
                                    {
                                        t: 'Lepas kunci',
                                        p: 'Mulai Rp75rb/24 jam',
                                        d: 'Bebas atur rute sendiri. Serah terima 10 menit dengan foto kondisi.',
                                        f: [
                                            'KTP + SIM fisik',
                                            'Tanpa deposit (motor)',
                                            'Gratis 2 helm SNI',
                                        ],
                                    },
                                    {
                                        t: 'Dengan driver',
                                        p: 'Mulai Rp450rb/12 jam',
                                        d: 'Driver lokal hafal jalan tikus Solo, Tawangmangu, Jogja.',
                                        f: [
                                            'BBM & parkir fleksibel',
                                            'Tanpa deposit',
                                            'Bisa request itinerary',
                                        ],
                                        hot: true,
                                    },
                                    {
                                        t: 'Korporat & event',
                                        p: 'Penawaran bulanan',
                                        d: 'Untuk proyek, wedding, atau operasional kantor. Invoice & PKS rapi.',
                                        f: [
                                            'Hemat 25–40%',
                                            'Servis berkala included',
                                            'Laporan kilometer',
                                        ],
                                    },
                                ].map((s, i) => {
                                    const on =
                                        litService === i || s.hot === true;
                                    return (
                                        <div
                                            key={s.t}
                                            data-reveal
                                            style={{
                                                ['--reveal-delay' as string]: `${i * 80}ms`,
                                            }}
                                            className="h-full"
                                        >
                                            <div
                                                role="button"
                                                tabIndex={0}
                                                aria-pressed={spotService === i}
                                                aria-label={`Sorot skema ${s.t}`}
                                                onMouseEnter={() =>
                                                    setHoverService(i)
                                                }
                                                onMouseLeave={() =>
                                                    setHoverService(null)
                                                }
                                                onFocus={() =>
                                                    setHoverService(i)
                                                }
                                                onBlur={() =>
                                                    setHoverService(null)
                                                }
                                                onClick={() =>
                                                    setSpotService(i)
                                                }
                                                onKeyDown={(event) => {
                                                    if (
                                                        event.key === 'Enter' ||
                                                        event.key === ' '
                                                    ) {
                                                        event.preventDefault();
                                                        setSpotService(i);
                                                    }
                                                }}
                                                className={`lift pressable relative h-full cursor-pointer rounded-3xl border p-7 select-none ${
                                                    on
                                                        ? 'border-[#241203] bg-[#241203] text-white shadow-[0_24px_48px_-24px_rgb(0_0_0/0.5)]'
                                                        : 'border-[#241203]/10 bg-white shadow-sm'
                                                }`}
                                            >
                                                {s.hot && (
                                                    <span className="absolute -top-3 left-7 rounded-full bg-[#FFFC8C] px-3 py-1 text-[11px] font-bold text-[#241203]">
                                                        PALING DIPESAN
                                                    </span>
                                                )}
                                                <h3 className="text-lg font-bold tracking-tight">
                                                    {s.t}
                                                </h3>
                                                <p
                                                    className={`mt-1 text-[13px] font-semibold ${on ? 'text-[#FFFC8C]' : 'text-stone-500'}`}
                                                >
                                                    {s.p}
                                                </p>
                                                <p
                                                    className={`mt-4 text-sm leading-6 ${on ? 'text-white/75' : 'text-stone-600'}`}
                                                >
                                                    {s.d}
                                                </p>
                                                <ul className="mt-5 space-y-2.5">
                                                    {s.f.map((f) => (
                                                        <li
                                                            key={f}
                                                            className={`flex items-center gap-2.5 text-[13.5px] font-medium ${on ? 'text-white/90' : 'text-stone-700'}`}
                                                        >
                                                            <span
                                                                className={`flex h-5 w-5 items-center justify-center rounded-full ${on ? 'bg-white/15' : 'bg-[#70FFD2]/40'}`}
                                                            >
                                                                <Check
                                                                    size={12}
                                                                    className={
                                                                        on
                                                                            ? 'text-white'
                                                                            : 'text-[#0B6B4F]'
                                                                    }
                                                                />
                                                            </span>
                                                            {f}
                                                        </li>
                                                    ))}
                                                </ul>
                                                <Link
                                                    href="/vehicles"
                                                    className="pressable mt-7 flex items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3 text-sm font-semibold text-[#241203]"
                                                >
                                                    Pilih skema ini
                                                    <ArrowRight size={15} />
                                                </Link>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* steps */}
                            <div
                                className="mt-14 rounded-3xl border border-[#241203]/10 bg-white p-7 sm:p-10"
                                data-reveal
                            >
                                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                                    <h3 className="text-xl font-bold tracking-tight">
                                        Sewa dalam 3 langkah, ±5 menit
                                    </h3>
                                    <Link
                                        href="/vehicles"
                                        className="link-underline flex items-center gap-1 text-sm font-semibold"
                                    >
                                        Mulai dari katalog{' '}
                                        <ArrowUpRight size={15} />
                                    </Link>
                                </div>
                                <div className="mt-8 grid gap-4 md:grid-cols-3">
                                    {[
                                        [
                                            '01',
                                            'Pilih unit & jadwal',
                                            'Filter motor/mobil, tentukan tanggal. Stok real-time dari outlet.',
                                        ],
                                        [
                                            '02',
                                            'Isi data + lokasi ambil',
                                            'KTP + SIM, pilih outlet atau antar. Invoice digital langsung terbit.',
                                        ],
                                        [
                                            '03',
                                            'Cek unit & jalan',
                                            'Foto bareng kondisi unit, bayar via QRIS/transfer/tunai. Selesai.',
                                        ],
                                    ].map(([n, t, d]) => (
                                        <div
                                            key={n}
                                            className="rounded-2xl bg-[#F7F2EB] p-5 sm:p-6"
                                        >
                                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FF9137] text-[13px] font-bold text-[#241203]">
                                                {n}
                                            </span>
                                            <p className="mt-4 text-[15px] font-bold tracking-tight text-[#241203]">
                                                {t}
                                            </p>
                                            <p className="mt-1.5 text-sm leading-6 text-stone-600">
                                                {d}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ---------------------------- testimoni ----------------------------- */}
                    <section className="bg-white py-20 sm:py-28">
                        <div className="mx-auto max-w-6xl px-5 lg:px-8">
                            <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:gap-16">
                                <div data-reveal="left">
                                    <Eyebrow>Ulasan penyewa</Eyebrow>
                                    <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.08]">
                                        Kata mereka yang{' '}
                                        <em className="font-editorial font-normal italic">
                                            sudah jalan.
                                        </em>
                                    </h2>
                                    <div className="mt-6 flex items-center gap-3">
                                        <Stars />
                                        <p className="text-sm text-stone-600">
                                            <strong className="text-[#241203]">
                                                4.9/5
                                            </strong>{' '}
                                            dari 2.300+ ulasan Google
                                        </p>
                                    </div>
                                    <div className="mt-7 flex gap-2.5">
                                        <button
                                            onClick={prevQuote}
                                            aria-label="Ulasan sebelumnya"
                                            className="pressable rounded-full border border-[#241203]/15 p-3"
                                        >
                                            <ArrowRight
                                                size={17}
                                                className="rotate-180"
                                            />
                                        </button>
                                        <button
                                            onClick={nextQuote}
                                            aria-label="Ulasan berikutnya"
                                            className="pressable rounded-full bg-[#FF9137] p-3 text-[#241203]"
                                        >
                                            <ArrowRight size={17} />
                                        </button>
                                        <div className="ml-2 flex items-center gap-1.5">
                                            {testimonials.map((_, i) => (
                                                <button
                                                    key={i}
                                                    aria-label={`Ke ulasan ${i + 1}`}
                                                    onClick={() =>
                                                        setQuoteIndex(i)
                                                    }
                                                    className={`h-1.5 rounded-full transition-[width,background-color] duration-250 ease-out ${
                                                        i === quoteIndex
                                                            ? 'w-7 bg-[#FF9137]'
                                                            : 'w-1.5 bg-stone-300'
                                                    }`}
                                                />
                                            ))}
                                        </div>
                                    </div>
                                </div>

                                <div
                                    className="overflow-hidden"
                                    data-reveal="right"
                                >
                                    <div
                                        className="flex transition-[transform] duration-500 ease-out"
                                        style={{
                                            transform: `translateX(-${quoteIndex * 100}%)`,
                                        }}
                                    >
                                        {testimonials.map((t) => (
                                            <figure
                                                key={t.name}
                                                className="w-full shrink-0 pr-1"
                                            >
                                                <blockquote className="rounded-3xl border border-[#241203]/10 bg-[#F7F2EB] p-7 sm:p-9">
                                                    <Stars />
                                                    <p className="font-editorial mt-5 text-[22px] leading-[1.4] text-[#241203] italic sm:text-2xl">
                                                        “{t.quote}”
                                                    </p>
                                                    <figcaption className="mt-7 flex items-center gap-3 border-t border-[#241203]/10 pt-5">
                                                        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#241203] text-sm font-bold text-white">
                                                            {t.name
                                                                .split(' ')
                                                                .map(
                                                                    (w) => w[0],
                                                                )
                                                                .slice(0, 2)
                                                                .join('')}
                                                        </span>
                                                        <div>
                                                            <p className="text-sm font-bold">
                                                                {t.name}
                                                            </p>
                                                            <p className="text-[13px] text-stone-500">
                                                                {t.meta}
                                                            </p>
                                                        </div>
                                                        <span className="ml-auto flex items-center gap-1 rounded-full bg-[#70FFD2]/40 px-3 py-1.5 text-[11px] font-bold text-[#0B6B4F]">
                                                            <BadgeCheck
                                                                size={13}
                                                            />
                                                            Terverifikasi
                                                        </span>
                                                    </figcaption>
                                                </blockquote>
                                            </figure>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* ------------------------------ outlet ------------------------------ */}
                    <section
                        id="outlet"
                        className="scroll-mt-24 py-20 sm:py-28"
                    >
                        <div className="mx-auto max-w-6xl px-5 lg:px-8">
                            <div className="max-w-2xl" data-reveal>
                                <Eyebrow>Outlet &amp; area</Eyebrow>
                                <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-balance sm:text-[40px] sm:leading-[1.08]">
                                    Ambil di mana pun,{' '}
                                    <em className="font-editorial font-normal italic">
                                        kami yang menyesuaikan.
                                    </em>
                                </h2>
                            </div>

                            <div className="mt-10 grid gap-4 lg:grid-cols-3">
                                {outlets.map((o, i) => (
                                    <div
                                        key={o.name}
                                        data-reveal
                                        style={{
                                            ['--reveal-delay' as string]: `${i * 80}ms`,
                                        }}
                                        className="lift rounded-3xl border border-[#241203]/10 bg-white p-6"
                                    >
                                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#241203] text-white">
                                            <MapPin size={19} />
                                        </span>
                                        <h3 className="mt-5 font-bold tracking-tight">
                                            {o.name}
                                        </h3>
                                        <p className="mt-1.5 text-[13.5px] leading-6 text-stone-600">
                                            {o.address}
                                        </p>
                                        <div className="mt-4 space-y-2 border-t border-dashed border-stone-200 pt-4 text-[13px]">
                                            <p className="flex items-center gap-2 text-stone-700">
                                                <Clock3 size={14} />
                                                {o.hours}
                                            </p>
                                            <p className="flex items-center gap-2 font-medium text-[#0B6B4F]">
                                                <Check size={14} />
                                                {o.note}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div
                                className="mt-4 grid gap-4 lg:grid-cols-[1.15fr_0.85fr]"
                                data-reveal
                            >
                                <div className="rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8">
                                    <p className="text-[11px] font-bold tracking-[0.16em] text-stone-500 uppercase">
                                        Area antar–jemput
                                    </p>
                                    <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 text-[13.5px] sm:grid-cols-3">
                                        {[
                                            'Laweyan — gratis',
                                            'Serengan — gratis',
                                            'Pasar Kliwon — gratis',
                                            'Jebres / UNS — gratis',
                                            'Banjarsari — gratis',
                                            'Kartasura — Rp25rb',
                                            'Sukoharjo — Rp35rb',
                                            'Karanganyar — Rp40rb',
                                            'Bandara SMB — Rp50rb',
                                        ].map((a) => (
                                            <p
                                                key={a}
                                                className="flex items-center gap-2 text-stone-700"
                                            >
                                                <Check
                                                    size={14}
                                                    className="shrink-0 text-[#0B6B4F]"
                                                />
                                                {a}
                                            </p>
                                        ))}
                                    </div>
                                    <p className="mt-5 rounded-2xl bg-[#F7F2EB] px-4 py-3 text-xs leading-5 text-stone-500">
                                        * Antar gratis untuk sewa ≥3 hari di
                                        area kota Solo. Di luar daftar? Chat
                                        operasional — hampir selalu bisa diatur.
                                    </p>
                                </div>
                                <div className="flex flex-col justify-between rounded-3xl bg-[#241203] p-6 text-white sm:p-8">
                                    <div>
                                        <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.16em] text-white/60 uppercase">
                                            <span className="animate-pulse-dot h-1.5 w-1.5 rounded-full bg-[#70FFD2]" />
                                            Operasional hari ini
                                        </p>
                                        <p className="mt-3 text-2xl font-bold tracking-tight">
                                            Buka s/d 21.00
                                        </p>
                                        <p className="mt-2 text-sm leading-6 text-white/70">
                                            Darurat 24/7 untuk penyewa aktif via
                                            WhatsApp. Rata-rata dibalas &lt;5
                                            menit.
                                        </p>
                                    </div>
                                    <div className="mt-6 grid grid-cols-2 gap-2.5">
                                        <a
                                            href="tel:+62895364727475"
                                            className="pressable flex items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3 text-[13px] font-bold text-[#241203]"
                                        >
                                            <Phone size={14} /> Telepon
                                        </a>
                                        <a
                                            href="https://wa.me/62895364727475"
                                            className="pressable flex items-center justify-center gap-2 rounded-full border border-white/25 py-3 text-[13px] font-semibold"
                                        >
                                            WhatsApp
                                        </a>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* -------------------------------- faq ------------------------------- */}
                    <section
                        id="faq"
                        className="scroll-mt-24 bg-white py-20 sm:py-28"
                    >
                        <div className="mx-auto grid max-w-6xl gap-12 px-5 lg:grid-cols-[0.8fr_1.2fr] lg:px-8">
                            <div
                                className="lg:sticky lg:top-24 lg:self-start"
                                data-reveal="left"
                            >
                                <Eyebrow>Bantuan</Eyebrow>
                                <h2 className="mt-4 text-3xl font-bold tracking-[-0.02em] sm:text-[40px] sm:leading-[1.08]">
                                    Yang sering{' '}
                                    <em className="font-editorial font-normal italic">
                                        ditanyakan.
                                    </em>
                                </h2>
                                <p className="mt-4 text-[15px] leading-7 text-stone-600">
                                    Masih ragu? Kirim KTP + SIM via WhatsApp,
                                    tim kami bantu pilihkan unit yang cocok
                                    untuk rute Anda — gratis, tanpa komitmen.
                                </p>
                                <a
                                    href="https://wa.me/62895364727475"
                                    className="pressable mt-6 inline-flex items-center gap-2 rounded-full border border-[#241203]/15 px-5 py-3 text-sm font-semibold"
                                >
                                    <Headset size={16} />
                                    Tanya via WhatsApp
                                </a>

                                <div className="mt-8 rounded-3xl border border-[#241203]/10 bg-[#F7F2EB] p-5 text-[13px] leading-6 text-stone-600">
                                    <p className="font-bold text-[#241203]">
                                        Syarat ringkas
                                    </p>
                                    <ul className="mt-2 space-y-1.5">
                                        <li>
                                            · Min. usia 18 thn (motor) / 20 thn
                                            (mobil)
                                        </li>
                                        <li>
                                            · KTP + SIM aktif, difoto saat serah
                                            terima
                                        </li>
                                        <li>
                                            · Bensin full-to-full, overtime
                                            maks. 3 jam
                                        </li>
                                        <li>
                                            · Denda tilang / e-tol ditanggung
                                            penyewa
                                        </li>
                                    </ul>
                                </div>
                            </div>

                            <div data-reveal="right">
                                {faqs.map(([q, a], i) => {
                                    const open = openFaq === i;
                                    return (
                                        <div
                                            key={q}
                                            className={`border-b border-[#241203]/10 ${i === 0 ? 'border-t' : ''}`}
                                        >
                                            <button
                                                onClick={() =>
                                                    setOpenFaq(open ? null : i)
                                                }
                                                aria-expanded={open}
                                                className="pressable flex w-full items-center justify-between gap-4 py-5 text-left"
                                            >
                                                <span className="text-[15px] font-semibold tracking-tight">
                                                    {q}
                                                </span>
                                                <span
                                                    className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-[background-color,color,transform] duration-200 ease-out ${
                                                        open
                                                            ? 'rotate-180 border-[#FF9137] bg-[#FF9137] text-[#241203]'
                                                            : 'border-[#241203]/15 text-stone-600'
                                                    }`}
                                                >
                                                    <ChevronDown size={16} />
                                                </span>
                                            </button>
                                            <div
                                                className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                                                    open
                                                        ? '[grid-template-rows:1fr]'
                                                        : '[grid-template-rows:0fr]'
                                                }`}
                                            >
                                                <div className="overflow-hidden">
                                                    <p
                                                        className={`pb-6 text-sm leading-7 text-stone-600 transition-[opacity,transform] duration-250 ease-out ${
                                                            open
                                                                ? 'translate-y-0 opacity-100'
                                                                : '-translate-y-1 opacity-0'
                                                        }`}
                                                    >
                                                        {a}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </section>

                    {/* -------------------------------- cta ------------------------------- */}
                    <section className="px-5 py-16 sm:py-20 lg:px-8">
                        <div
                            className="relative mx-auto max-w-6xl overflow-hidden rounded-[28px] bg-[#241203] px-7 py-14 text-center text-white sm:px-12 sm:py-20"
                            data-reveal="scale"
                        >
                            <div
                                className="bg-dots pointer-events-none absolute inset-0 opacity-[0.16]"
                                aria-hidden
                            />
                            <div className="relative">
                                <p className="text-[11px] font-bold tracking-[0.2em] text-white/60 uppercase">
                                    Slot besok masih tersedia
                                </p>
                                <h2 className="mx-auto mt-4 max-w-2xl text-3xl font-bold tracking-[-0.02em] text-balance sm:text-5xl sm:leading-[1.05]">
                                    Butuh unit untuk{' '}
                                    <em className="font-editorial font-normal text-[#FFFC8C] italic">
                                        besok pagi?
                                    </em>
                                </h2>
                                <p className="mx-auto mt-4 max-w-xl text-[15px] leading-7 text-white/70">
                                    Booking malam ini sebelum 21.00, unit
                                    diantar pagi hari — sudah full bensin dan
                                    difoto kondisinya. Tanpa DP untuk motor.
                                </p>
                                <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
                                    <Link
                                        href="/vehicles"
                                        className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-7 py-3.5 text-sm font-bold text-[#241203]"
                                    >
                                        Booking sekarang
                                        <ArrowRight size={16} />
                                    </Link>
                                    <a
                                        href="tel:+62895364727475"
                                        className="pressable flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold"
                                    >
                                        <Phone size={15} />
                                        0895-3647-27475
                                    </a>
                                </div>
                                <p className="mt-6 text-xs text-white/50">
                                    Jl. Slamet Riyadi No. 452, Solo · Setiap
                                    hari 07.00–21.00 · Darurat 24/7
                                </p>
                            </div>
                        </div>
                    </section>
                </main>

                {/* ------------------------------- footer ------------------------------ */}
                <footer className="border-t border-[#241203]/10 bg-white">
                    <div className="mx-auto max-w-6xl px-5 py-14 lg:px-8">
                        <div className="grid gap-10 md:grid-cols-[1.3fr_0.7fr_0.7fr_1fr]">
                            <div>
                                <span className="flex items-center gap-2.5">
                                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#FF9137] text-[#241203]">
                                        <Bike size={18} />
                                    </span>
                                    <span className="text-[17px] font-bold tracking-tight">
                                        SoloRent
                                    </span>
                                </span>
                                <p className="mt-4 max-w-xs text-[13.5px] leading-6 text-stone-500">
                                    PT Solo Rent Mobility — rental motor &amp;
                                    mobil di Solo sejak 2019. NIB terdaftar,
                                    unit berasuransi, invoice digital.
                                </p>
                                <div className="mt-5 flex items-center gap-2 text-[13px] text-stone-500">
                                    <Clock3 size={14} />
                                    Setiap hari · 07.00–21.00
                                </div>
                            </div>
                            <nav aria-label="Jelajah">
                                <p className="text-[11px] font-bold tracking-[0.16em] text-stone-400 uppercase">
                                    Jelajah
                                </p>
                                <ul className="mt-4 space-y-2.5 text-[13.5px] font-medium text-stone-600">
                                    {[
                                        ['Profil perusahaan', '#profil'],
                                        ['Armada & harga', '#armada'],
                                        ['Layanan', '#layanan'],
                                        ['Outlet & area', '#outlet'],
                                        ['FAQ', '#faq'],
                                    ].map(([l, h]) => (
                                        <li key={h}>
                                            <a
                                                href={h}
                                                className="link-underline hover:text-stone-950"
                                            >
                                                {l}
                                            </a>
                                        </li>
                                    ))}
                                </ul>
                            </nav>
                            <nav aria-label="Sewa">
                                <p className="text-[11px] font-bold tracking-[0.16em] text-stone-400 uppercase">
                                    Sewa
                                </p>
                                <ul className="mt-4 space-y-2.5 text-[13.5px] font-medium text-stone-600">
                                    <li>
                                        <Link
                                            href="/vehicles"
                                            className="link-underline hover:text-stone-950"
                                        >
                                            Katalog kendaraan
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/vehicles"
                                            className="link-underline hover:text-stone-950"
                                        >
                                            Detail unit
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/booking/check"
                                            className="link-underline hover:text-stone-950"
                                        >
                                            Cek booking
                                        </Link>
                                    </li>
                                    <li>
                                        <Link
                                            href="/login"
                                            className="link-underline hover:text-stone-950"
                                        >
                                            Masuk akun
                                        </Link>
                                    </li>
                                </ul>
                            </nav>
                            <div>
                                <p className="text-[11px] font-bold tracking-[0.16em] text-stone-400 uppercase">
                                    Hubungi outlet
                                </p>
                                <ul className="mt-4 space-y-2.5 text-[13.5px] text-stone-600">
                                    <li>
                                        Jl. Slamet Riyadi No. 452, Laweyan, Solo
                                    </li>
                                    <li>
                                        <a
                                            href="tel:+62895364727475"
                                            className="font-semibold text-[#241203]"
                                        >
                                            0895-3647-27475
                                        </a>{' '}
                                        ·{' '}
                                        <a
                                            href="https://wa.me/62895364727475"
                                            className="font-semibold text-[#241203]"
                                        >
                                            WhatsApp
                                        </a>
                                    </li>
                                    <li>halo@solorent.id</li>
                                </ul>
                            </div>
                        </div>
                        <div className="mt-12 flex flex-col gap-3 border-t border-[#241203]/10 pt-6 text-[12.5px] text-stone-400 sm:flex-row sm:items-center sm:justify-between">
                            <p>
                                © 2026 PT Solo Rent Mobility. Sewa motor & mobil
                                terpercaya di Solo.
                            </p>
                            <p className="flex gap-5">
                                <a
                                    href="#profil"
                                    className="hover:text-stone-700"
                                >
                                    Syarat &amp; Ketentuan
                                </a>
                                <a href="#faq" className="hover:text-stone-700">
                                    Kebijakan Privasi
                                </a>
                            </p>
                        </div>
                    </div>
                </footer>
            </div>
        </>
    );
}
