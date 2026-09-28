import { Bike, CarFront } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

export function AvailabilityBadge({ status }: { status: string }) {
    if (status === 'unavailable') {
        return (
            <span className="flex items-center gap-1.5 rounded-full bg-[#4A4A4A]/90 px-3 py-1.5 text-[11px] font-bold text-white shadow-sm backdrop-blur-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
                Tidak tersedia
            </span>
        );
    }
    if (status === 'limited') {
        return (
            <span className="flex items-center gap-1.5 rounded-full bg-[#FFFC8C] px-3 py-1.5 text-[11px] font-bold text-[#241203] shadow-sm">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                Tersisa 1 unit
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-3 py-1.5 text-[11px] font-bold text-[#0B6B4F] shadow-sm backdrop-blur-sm">
            <span className="h-1.5 w-1.5 rounded-full bg-[#0B6B4F]" />
            Tersedia
        </span>
    );
}

export function VehicleImage({
    src,
    alt,
    category,
    className,
    imgClassName,
}: {
    src: string | null;
    alt: string;
    category: 'motor' | 'mobil';
    className?: string;
    imgClassName?: string;
}) {
    const [failed, setFailed] = useState(false);
    const [loaded, setLoaded] = useState(false);

    if (!src || failed) {
        return (
            <div
                className={cn(
                    'flex flex-col items-center justify-center gap-2 bg-[#F7F2EB] text-stone-400',
                    className,
                )}
                role="img"
                aria-label={`Foto ${alt} belum tersedia`}
            >
                {category === 'motor' ? (
                    <Bike size={40} strokeWidth={1.5} />
                ) : (
                    <CarFront size={40} strokeWidth={1.5} />
                )}
                <span className="text-xs font-semibold tracking-wide uppercase">
                    Vehicle Image
                </span>
            </div>
        );
    }

    return (
        <div className={cn('relative bg-[#F7F2EB]', className)}>
            {!loaded && (
                <div className="absolute inset-0 animate-pulse bg-stone-200/70" />
            )}
            <img
                src={src}
                alt={alt}
                loading="lazy"
                onLoad={() => setLoaded(true)}
                onError={() => setFailed(true)}
                className={cn(
                    'h-full w-full object-cover transition-[opacity] duration-300 ease-out',
                    loaded ? 'opacity-100' : 'opacity-0',
                    imgClassName,
                )}
            />
        </div>
    );
}
