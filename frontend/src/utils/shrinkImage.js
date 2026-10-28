/*
 * Photos attached to a student record are stored in the database, so each one is kept to
 * 200 KB at most (the server enforces the same limit). A phone photo is several MB, so it is
 * shrunk in the browser before it is uploaded: first by lowering the JPEG quality, then by
 * making the picture smaller, until it fits. A photo that is already small is left untouched.
 */
export const IMAGE_MAX_BYTES = 200 * 1024;

const LONGEST_SIDE = 1600;
const QUALITIES = [0.85, 0.75, 0.65, 0.55, 0.45];
const MIN_SCALE = 0.3;

export const isImageFile = file => /^image\//i.test(file?.type || '');

/*
 * The best picture that fits in `max` bytes. `encode(scale, quality)` resolves to a Blob.
 * Tries every quality at the full size first, then a smaller picture, and so on. null if nothing fits.
 */
export async function fitUnder(max, encode) {
  for (let scale = 1; scale >= MIN_SCALE; scale = Math.round(scale * 80) / 100) {
    for (const quality of QUALITIES) {
      const blob = await encode(scale, quality);
      if (blob && blob.size <= max) return blob;
    }
  }
  return null;
}

// Resolves to a File of at most `max` bytes (a JPEG), the same file when it already fits, or null when it cannot be shrunk enough.
export async function shrinkImage(file, max = IMAGE_MAX_BYTES) {
  if (!isImageFile(file) || file.size <= max) return file;
  const bitmap = await createImageBitmap(file);
  try {
    const base = Math.min(1, LONGEST_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement('canvas');
    const encode = (scale, quality) => new Promise(resolve => {
      canvas.width = Math.max(1, Math.round(bitmap.width * base * scale));
      canvas.height = Math.max(1, Math.round(bitmap.height * base * scale));
      const context = canvas.getContext('2d');
      // A JPEG has no transparency: a PNG's clear parts would turn black without a white background.
      context.fillStyle = '#fff';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(resolve, 'image/jpeg', quality);
    });
    const blob = await fitUnder(max, encode);
    if (!blob) return null;
    const name = file.name.replace(/\.[^.]+$/, '') || 'photo';
    return new File([blob], `${name}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close?.();
  }
}
