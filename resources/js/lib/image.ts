/**
 * Kompres foto di browser sebelum upload.
 *
 * Server membatasi upload (upload_max_filesize 2M, post_max_size 8M)
 * sementara foto HP umumnya 2–6MB. Tanpa kompresi, inspeksi dengan
 * beberapa foto gagal total (413 / file rusak) dan tidak ada data
 * yang tersimpan. Helper ini mengecilkan ke maks 1600px JPEG ~0.8
 * (biasanya < 500KB) sehingga selalu lolos limit.
 * Aman: gagal kompres → file asli dipakai.
 */
export async function compressImage(file: File, maxDim = 1600, quality = 0.82): Promise<File> {
    if (!file.type.startsWith('image/')) return file;
    if (file.size <= 500_000) return file;

    try {
        if (typeof createImageBitmap === 'undefined') return file;
        const bitmap = await createImageBitmap(file);
        const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
        const width = Math.max(1, Math.round(bitmap.width * scale));
        const height = Math.max(1, Math.round(bitmap.height * scale));

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            bitmap.close();
            return file;
        }
        ctx.drawImage(bitmap, 0, 0, width, height);
        bitmap.close();

        const blob = await new Promise<Blob | null>((resolve) =>
            canvas.toBlob(resolve, 'image/jpeg', quality),
        );
        if (!blob || blob.size >= file.size) return file;

        const name = file.name.replace(/\.[a-z0-9]+$/i, '') + '.jpg';
        return new File([blob], name || 'foto.jpg', { type: 'image/jpeg' });
    } catch {
        return file;
    }
}

export async function compressImages(files: File[]): Promise<File[]> {
    return Promise.all(files.map((f) => compressImage(f)));
}
