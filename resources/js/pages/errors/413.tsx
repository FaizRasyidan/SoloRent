import { Head, Link } from '@inertiajs/react';
import { ImageOff } from 'lucide-react';

export default function TooLarge() {
    return (
        <>
            <Head title="413 — Data terlalu besar" />
            <div className="flex min-h-svh items-center justify-center bg-[#F4F5F7] px-4 text-slate-800">
                <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
                        <ImageOff className="size-6" />
                    </div>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">413</p>
                    <h1 className="mt-1 text-lg font-semibold text-slate-900">Data yang dikirim terlalu besar.</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Total foto melebihi batas server. Kurangi jumlah foto atau gunakan foto beresolusi
                        lebih kecil, lalu coba simpan lagi. Data belum tersimpan.
                    </p>
                    <div className="mt-6 flex flex-col gap-2.5">
                        <Link
                            href="/admin/bookings"
                            className="flex w-full items-center justify-center rounded-xl bg-[#FF9137] px-4 py-3 text-sm font-semibold text-[#241203] transition-[transform,background-color] duration-150 ease-out hover:bg-[#ff9f52] active:scale-[0.99]"
                        >
                            Kembali ke Booking
                        </Link>
                        <Link
                            href="/admin/dashboard"
                            className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                        >
                            Ke Dashboard
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
