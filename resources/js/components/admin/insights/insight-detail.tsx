import { Link } from '@inertiajs/react';
import { Badge } from '@/components/ui/badge';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { INSIGHT_CATEGORY_LABELS, type InsightItem } from '@/types/insights';

export function InsightDetail({
    item,
    onClose,
}: {
    item: InsightItem | null;
    onClose: () => void;
}) {
    return (
        <Sheet open={item !== null} onOpenChange={(v) => !v && onClose()}>
            <SheetContent side="right" aria-label="Detail insight">
                {item && (
                    <>
                        <SheetHeader>
                            <Badge
                                variant="secondary"
                                className="w-fit text-[11px]"
                            >
                                {INSIGHT_CATEGORY_LABELS[item.category] ??
                                    item.category}
                            </Badge>
                            <SheetTitle className="text-left text-base">
                                {item.title}
                            </SheetTitle>
                            <SheetDescription className="text-left text-sm">
                                {item.summary}
                            </SheetDescription>
                        </SheetHeader>
                        <div className="space-y-4 overflow-y-auto px-4 pb-6">
                            <div>
                                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                    Bukti data
                                </p>
                                <ul className="mt-2 list-disc space-y-1.5 pl-5 text-sm text-slate-700">
                                    {item.evidence.map((line, i) => (
                                        <li key={i}>{line}</li>
                                    ))}
                                </ul>
                            </div>
                            <div className="rounded-xl bg-slate-50 p-3.5">
                                <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
                                    Rekomendasi
                                </p>
                                <p className="mt-1 text-sm text-slate-700">
                                    {item.recommendation}
                                </p>
                            </div>
                            <Link
                                href={item.action_url}
                                className="inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-slate-700"
                            >
                                Buka laporan terkait
                            </Link>
                        </div>
                    </>
                )}
            </SheetContent>
        </Sheet>
    );
}
