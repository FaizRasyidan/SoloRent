import { Link, usePage } from '@inertiajs/react';
import { ArrowRight, Bike, Menu, Phone, Search, X } from 'lucide-react';
import { useState } from 'react';

const links = [
    ['Kendaraan', '/vehicles'],
    ['Cara Rental', '/cara-rental'],
] as Array<[string, string]>;

function isNavActive(path: string, href: string): boolean {
    if (href === '/vehicles') {
        return (
            path.startsWith('/vehicles') ||
            (path.startsWith('/booking') && !path.startsWith('/booking/check'))
        );
    }
    return path.startsWith(href);
}

export default function CustomerLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(false);
    const { url } = usePage();

    return (
        <div className="min-h-screen bg-[#F7F2EB] text-[#241203] antialiased">
            <header className="sticky top-0 z-40 border-b border-[#241203]/10 bg-[#F7F2EB]/85 backdrop-blur-md">
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
                        </span>
                    </Link>

                    <nav
                        className="hidden items-center gap-7 text-[13.5px] font-medium text-stone-600 lg:flex"
                        aria-label="Navigasi utama"
                    >
                        {links.map(([label, href]) => {
                            const active = isNavActive(url.split('?')[0], href);
                            return (
                                <Link
                                    key={href}
                                    href={href}
                                    aria-current={active ? 'page' : undefined}
                                    className={`rounded-full px-3.5 py-1.5 transition-[background-color,color] duration-200 ease-out hover:text-[#241203] ${
                                        active
                                            ? 'bg-[#FF9137]/20 font-semibold text-[#241203]'
                                            : ''
                                    }`}
                                >
                                    {label}
                                </Link>
                            );
                        })}
                    </nav>

                    <div className="flex items-center gap-2.5">
                        <a
                            href="tel:+62895364727475"
                            className="pressable hidden items-center gap-2 rounded-full border border-[#241203]/15 bg-white/60 px-3.5 py-2 text-[13px] font-semibold md:flex"
                        >
                            <Phone size={14} />
                            0895-3647-27475
                        </a>
                        <Link
                            href="/booking/check"
                            aria-current={url.split('?')[0].startsWith('/booking/check') ? 'page' : undefined}
                            className={`pressable hidden items-center gap-1.5 rounded-full border-2 px-4 py-2 text-[13px] font-semibold transition-[border-color,background-color] duration-200 ease-out sm:flex ${
                                url.split('?')[0].startsWith('/booking/check')
                                    ? 'border-[#241203] bg-[#241203] text-white'
                                    : 'border-[#241203]/15 bg-white/60 text-[#241203] hover:border-[#241203]/40'
                            }`}
                        >
                            <Search size={14} />
                            Cek Status
                        </Link>
                        <Link
                            href="/vehicles"
                            className="pressable hidden items-center gap-1.5 rounded-full bg-[#FF9137] px-4.5 py-2.5 text-[13.5px] font-semibold text-[#241203] sm:flex"
                            style={{ paddingLeft: 18, paddingRight: 18 }}
                        >
                            Rental Sekarang
                            <ArrowRight size={15} />
                        </Link>
                        <button
                            onClick={() => setOpen((v) => !v)}
                            aria-label={open ? 'Tutup menu' : 'Buka menu'}
                            aria-expanded={open}
                            className="pressable rounded-full border border-[#241203]/15 bg-white/70 p-2.5 lg:hidden"
                        >
                            {open ? <X size={18} /> : <Menu size={18} />}
                        </button>
                    </div>
                </div>

                {open && (
                    <nav
                        className="animate-fade-up border-t border-[#241203]/10 bg-[#F7F2EB] px-5 pt-2 pb-5 lg:hidden"
                        aria-label="Navigasi seluler"
                    >
                        {[['Beranda', '/'], ...links, ['Cek Status Booking', '/booking/check']].map(([label, href]) => (
                            <Link
                                key={label}
                                href={href}
                                onClick={() => setOpen(false)}
                                className="flex items-center justify-between border-b border-[#241203]/8 py-3.5 text-[15px] font-medium"
                            >
                                {label}
                                <ArrowRight
                                    size={16}
                                    className="text-stone-400"
                                />
                            </Link>
                        ))}
                        <Link
                            href="/vehicles"
                            className="pressable mt-4 flex items-center justify-center gap-2 rounded-full bg-[#FF9137] py-3.5 text-sm font-semibold text-[#241203]"
                        >
                            Rental Sekarang <ArrowRight size={16} />
                        </Link>
                    </nav>
                )}
            </header>

            <main>{children}</main>

            <footer className="border-t border-[#241203]/10 bg-white">
                <div className="mx-auto max-w-6xl px-5 py-12 lg:px-8">
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
                                PT Solo Rent Mobility — rental motor &amp; mobil
                                di Solo sejak 2019. Setiap hari 07.00–21.00.
                            </p>
                        </div>
                        <nav aria-label="Jelajah">
                            <p className="text-[11px] font-bold tracking-[0.16em] text-stone-400 uppercase">
                                Jelajah
                            </p>
                            <ul className="mt-4 space-y-2.5 text-[13.5px] font-medium text-stone-600">
                                <li>
                                    <Link
                                        href="/"
                                        className="hover:text-[#241203]"
                                    >
                                        Beranda
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/vehicles"
                                        className="hover:text-[#241203]"
                                    >
                                        Katalog
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/booking/check"
                                        className="hover:text-[#241203]"
                                    >
                                        Cek Booking
                                    </Link>
                                </li>
                            </ul>
                        </nav>
                        <nav aria-label="Bantuan">
                            <p className="text-[11px] font-bold tracking-[0.16em] text-stone-400 uppercase">
                                Bantuan
                            </p>
                            <ul className="mt-4 space-y-2.5 text-[13.5px] font-medium text-stone-600">
                                <li>
                                    <Link
                                        href="/#faq"
                                        className="hover:text-[#241203]"
                                    >
                                        FAQ
                                    </Link>
                                </li>
                                <li>
                                    <Link
                                        href="/#outlet"
                                        className="hover:text-[#241203]"
                                    >
                                        Outlet
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
                                    </a>
                                </li>
                                <li>halo@solorent.id</li>
                            </ul>
                        </div>
                    </div>
                    <div className="mt-10 border-t border-[#241203]/10 pt-6 text-[12.5px] text-stone-400">
                        © 2026 PT Solo Rent Mobility. Sewa motor &amp; mobil
                        terpercaya di Solo.
                    </div>
                </div>
            </footer>
        </div>
    );
}
