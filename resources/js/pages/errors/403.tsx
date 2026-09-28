import { Head, Link } from '@inertiajs/react';
import { ShieldX } from 'lucide-react';

export default function Forbidden() {
    return (
        <>
            <Head title="403 — Akses tidak diizinkan" />
            <div className="flex min-h-svh items-center justify-center bg-[#F4F5F7] px-4 text-slate-800">
                <div className="w-full max-w-md rounded-2xl border border-slate-200/80 bg-white p-8 text-center">
                    <div className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
                        <ShieldX className="size-6" />
                    </div>
                    <p className="mt-4 text-4xl font-semibold tracking-tight text-slate-900 tabular-nums">403</p>
                    <h1 className="mt-1 text-lg font-semibold text-slate-900">Akses tidak diizinkan.</h1>
                    <p className="mt-1 text-sm text-slate-500">
                        Anda tidak memiliki akses ke halaman ini.
                    </p>
                    <div className="mt-6 flex flex-col gap-2.5">
                        <Link
                            href="/admin/dashboard"
                            className="flex w-full items-center justify-center rounded-xl bg-[#FF9137] px-4 py-3 text-sm font-semibold text-[#241203] transition-[transform,background-color] duration-150 ease-out hover:bg-[#ff9f52] active:scale-[0.99]"
                        >
                            Kembali ke Dashboard
                        </Link>
                        <Link
                            href="/admin/login"
                            className="flex w-full items-center justify-center rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50"
                        >
                            Ke halaman login
                        </Link>
                    </div>
                </div>
            </div>
        </>
    );
}
