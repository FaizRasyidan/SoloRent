import { Form, Head, Link } from '@inertiajs/react';
import { Bike, ShieldCheck } from 'lucide-react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';

export default function AdminLogin({ status }: { status?: string }) {
    return (
        <>
            <Head title="Admin Login" />
            <div className="flex min-h-svh items-center justify-center bg-[#F4F5F7] px-4 py-10 text-slate-800">
                <div className="w-full max-w-md">
                    <div className="mb-6 flex flex-col items-center gap-3 text-center">
                        <div className="flex size-12 items-center justify-center rounded-2xl bg-[#FF9137] text-[#241203]">
                            <Bike className="size-6" strokeWidth={2.25} />
                        </div>
                        <div>
                            <p className="text-xl font-semibold tracking-tight text-slate-900">SoloRent</p>
                            <p className="mt-1 inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-500">
                                <ShieldCheck className="size-3.5" />
                                Admin Dashboard
                            </p>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-slate-200/80 bg-white p-6 shadow-[0_1px_2px_rgba(15,23,42,0.06)] sm:p-8">
                        <h1 className="text-lg font-semibold tracking-tight text-slate-900">Masuk sebagai Admin</h1>
                        <p className="mt-1 text-sm text-slate-500">
                            Kelola armada, booking, dan operasional dari satu tempat.
                        </p>

                        {status && (
                            <div className="mt-4 rounded-xl bg-emerald-50 px-4 py-3 text-center text-sm font-medium text-emerald-700">
                                {status}
                            </div>
                        )}

                        <Form
                            action="/admin/login"
                            method="post"
                            resetOnSuccess={['password']}
                            className="mt-6 flex flex-col gap-5"
                        >
                            {({ processing, errors }) => (
                                <>
                                    <div className="grid gap-2">
                                        <Label htmlFor="email">Email</Label>
                                        <Input
                                            id="email"
                                            type="email"
                                            name="email"
                                            required
                                            autoFocus
                                            autoComplete="email"
                                            placeholder="admin@solorent.test"
                                            className="h-12 rounded-xl"
                                        />
                                        <InputError message={errors.email} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="password">Password</Label>
                                        <PasswordInput
                                            id="password"
                                            name="password"
                                            required
                                            autoComplete="current-password"
                                            placeholder="••••••••••••"
                                            className="h-12 rounded-xl"
                                        />
                                        <InputError message={errors.password} />
                                    </div>

                                    <div className="flex items-center space-x-3">
                                        <Checkbox id="remember" name="remember" />
                                        <Label htmlFor="remember" className="font-normal">
                                            Ingat saya
                                        </Label>
                                    </div>

                                    <Button
                                        type="submit"
                                        disabled={processing}
                                        className="h-12 w-full rounded-xl bg-[#FF9137] text-[15px] font-semibold text-[#241203] transition-[transform,background-color] duration-150 ease-out hover:bg-[#ff9f52] active:scale-[0.98]"
                                    >
                                        {processing && <Spinner />}
                                        Masuk sebagai Admin
                                    </Button>
                                </>
                            )}
                        </Form>
                    </div>

                    <p className="mt-6 text-center text-sm text-slate-500">
                        Area khusus administrator.{' '}
                        <Link href="/" className="font-medium text-slate-900 underline underline-offset-4">
                            Kembali ke website
                        </Link>
                    </p>
                </div>
            </div>
        </>
    );
}
