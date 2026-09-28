import { Head, Link } from '@inertiajs/react';
import {
    ArrowLeft,
    ArrowRight,
    CalendarDays,
    Check,
    ClipboardCheck,
    Clock3,
    Fuel,
    Headset,
    Store,
    Truck,
    UserCheck,
    Wallet,
} from 'lucide-react';
import { useReveal } from '@/hooks/use-reveal';

const flow = [
    [
        '01',
        'Pilih kendaraan & jadwal',
        'Buka katalog, filter motor atau mobil, lalu tentukan tanggal mulai dan selesai. Harga per 24 jam langsung terlihat.',
        '/vehicles',
        'Lihat katalog',
    ],
    [
        '02',
        'Tentukan pengambilan',
        'Ambil gratis di Outlet Slamet Riyadi, atau pilih antar ke hotel, stasiun, dan bandara dengan biaya sesuai area.',
        '/vehicles',
        'Lihat area antar',
    ],
    [
        '03',
        'Isi data pemesan',
        'Tanpa akun. Cukup nama dan nomor WhatsApp — email dan nomor identitas opsional bila diperlukan.',
        '/booking',
        'Mulai booking',
    ],
    [
        '04',
        'Konfirmasi & terima kode',
        'Periksa ringkasan, setujui syarat, tekan Konfirmasi Booking. Simpan kode SR-nya untuk cek status.',
        '/booking/check',
        'Cek booking',
    ],
] as Array<[string, string, string, string, string]>;

const rules = [
    [
        Fuel,
        'Bensin full-to-full',
        'Unit diserahkan full tank dan dikembalikan full tank. Tidak ada biaya bensin tersembunyi.',
    ],
    [
        Clock3,
        'Overtime jelas',
        'Keterlambatan Rp25rb/jam (motor) dan Rp50rb/jam (mobil), maksimal 3 jam — selebihnya dihitung 1 hari.',
    ],
    [
        Wallet,
        'Deposit ringan',
        'Motor tanpa deposit. Mobil lepas kunci deposit Rp500rb, kembali penuh saat unit dicek. Dengan driver tanpa deposit.',
    ],
    [
        ClipboardCheck,
        'Denda & tilang',
        'Tilang elektronik dan biaya e-tol selama masa sewa ditanggung penyewa sesuai tagihan resmi.',
    ],
] as Array<[typeof Fuel, string, string]>;

export default function CaraRental() {
    useReveal();

    return (
        <>
            <Head title="Cara Rental — Sewa Motor & Mobil Solo" />
            <div className="mx-auto max-w-6xl px-5 py-8 lg:px-8 lg:py-12">
                <Link
                    href="/"
                    className="inline-flex items-center gap-1.5 text-sm font-semibold text-stone-500 hover:text-[#241203]"
                >
                    <ArrowLeft size={16} /> Kembali ke Beranda
                </Link>

                <div className="mt-6 max-w-2xl" data-reveal>
                    <p className="flex items-center gap-2 text-[11px] font-bold tracking-[0.18em] text-stone-500 uppercase">
                        <span className="h-px w-6 bg-[#FF9137]" aria-hidden />
                        Panduan Rental
                    </p>
                    <h1 className="mt-4 text-3xl font-bold tracking-[-0.02em] text-balance sm:text-[44px] sm:leading-[1.06]">
                        Cara rental kendaraan di{' '}
                        <em className="font-editorial font-normal italic">
                            SoloRent.
                        </em>
                    </h1>
                    <p className="mt-4 text-[15px] leading-7 text-stone-600">
                        Empat langkah, sekitar lima menit, tanpa membuat akun.
                        Berikut alur lengkap beserta syarat dan aturan biaya
                        yang transparan sejak awal.
                    </p>
                </div>

                <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {flow.map(([n, title, desc, href, cta], i) => (
                        <div
                            key={n}
                            data-reveal
                            style={{
                                ['--reveal-delay' as string]: `${i * 70}ms`,
                            }}
                            className="flex flex-col rounded-3xl border border-[#241203]/10 bg-white p-6"
                        >
                            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#FF9137] text-[13px] font-bold text-[#241203]">
                                {n}
                            </span>
                            <h2 className="mt-4 text-[15px] font-bold tracking-tight">
                                {title}
                            </h2>
                            <p className="mt-2 flex-1 text-sm leading-6 text-stone-600">
                                {desc}
                            </p>
                            <Link
                                href={href}
                                className="link-underline mt-4 inline-flex items-center gap-1 text-[13px] font-semibold text-[#241203]"
                            >
                                {cta}
                                <ArrowRight size={14} />
                            </Link>
                        </div>
                    ))}
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div
                        className="rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                        data-reveal="left"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7F2EB]">
                            <UserCheck size={20} />
                        </span>
                        <h2 className="mt-5 text-lg font-bold tracking-tight">
                            Syarat penyewa
                        </h2>
                        <ul className="mt-4 space-y-2.5">
                            {[
                                'Usia min. 18 tahun (motor) / 20 tahun (mobil)',
                                'KTP + SIM aktif: SIM C untuk motor, SIM A untuk mobil',
                                'WNA: paspor + SIM internasional',
                                'Dokumen difoto saat serah terima, tidak disimpan melebihi masa sewa',
                            ].map((s) => (
                                <li
                                    key={s}
                                    className="flex items-start gap-2.5 text-sm leading-6 text-stone-700"
                                >
                                    <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#70FFD2]/40">
                                        <Check
                                            size={12}
                                            className="text-[#0B6B4F]"
                                        />
                                    </span>
                                    {s}
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div
                        className="rounded-3xl bg-[#241203] p-6 text-white sm:p-8"
                        data-reveal="right"
                    >
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10">
                            <Store size={20} />
                        </span>
                        <h2 className="mt-5 text-lg font-bold tracking-tight">
                            Ambil atau diantar
                        </h2>
                        <div className="mt-4 space-y-3 text-sm leading-6">
                            <p className="rounded-2xl bg-white/8 p-4 text-white/85">
                                <strong className="text-white">
                                    Ambil di outlet — gratis.
                                </strong>{' '}
                                Jl. Slamet Riyadi No. 452, Solo. Setiap hari
                                08.00–21.00.
                            </p>
                            <p className="rounded-2xl bg-white/8 p-4 text-white/85">
                                <strong className="text-white">
                                    Antar ke lokasi — Rp15–50rb.
                                </strong>{' '}
                                Hotel, kos, Stasiun Solo Balapan, Terminal
                                Tirtonadi, Bandara Adi Soemarmo. Gratis untuk
                                sewa ≥3 hari di area kota.
                            </p>
                        </div>
                        <p className="mt-4 flex items-center gap-2 text-[13px] text-white/60">
                            <Truck size={15} />
                            Unit mogok? Pengganti dikirim maks. 90 menit di area
                            Solo Raya.
                        </p>
                    </div>
                </div>

                <div
                    className="mt-4 rounded-3xl border border-[#241203]/10 bg-white p-6 sm:p-8"
                    data-reveal
                >
                    <div className="flex items-center gap-3">
                        <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#F7F2EB]">
                            <Wallet size={20} />
                        </span>
                        <h2 className="text-lg font-bold tracking-tight">
                            Aturan biaya, tertulis di muka
                        </h2>
                    </div>
                    <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
                        {rules.map(([Icon, title, desc]) => (
                            <div key={title}>
                                <Icon size={19} className="text-[#C2570B]" />
                                <p className="mt-3 text-[14.5px] font-bold">
                                    {title}
                                </p>
                                <p className="mt-1.5 text-[13.5px] leading-6 text-stone-600">
                                    {desc}
                                </p>
                            </div>
                        ))}
                    </div>
                    <p className="mt-6 flex items-center gap-2 rounded-2xl bg-[#F7F2EB] px-4 py-3 text-[13px] text-stone-600">
                        <CalendarDays size={15} className="shrink-0" />
                        Semua angka di atas juga tercantum di invoice digital
                        sebelum kamu membayar.
                    </p>
                </div>

                <div
                    className="relative mt-4 overflow-hidden rounded-[28px] bg-[#241203] px-7 py-12 text-center text-white sm:py-14"
                    data-reveal="scale"
                >
                    <h2 className="mx-auto max-w-xl text-2xl font-bold tracking-[-0.02em] text-balance sm:text-4xl">
                        Siap jalan? Pilih unitmu{' '}
                        <em className="font-editorial font-normal text-[#FFFC8C] italic">
                            sekarang.
                        </em>
                    </h2>
                    <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
                        <Link
                            href="/vehicles"
                            className="pressable flex items-center gap-2 rounded-full bg-[#FF9137] px-7 py-3.5 text-sm font-bold text-[#241203]"
                        >
                            Lihat katalog
                            <ArrowRight size={16} />
                        </Link>
                        <a
                            href="https://wa.me/62895364727475"
                            target="_blank"
                            rel="noreferrer"
                            className="pressable flex items-center gap-2 rounded-full border border-white/25 px-7 py-3.5 text-sm font-semibold"
                        >
                            <Headset size={15} />
                            Tanya via WhatsApp
                        </a>
                    </div>
                </div>
            </div>
        </>
    );
}
