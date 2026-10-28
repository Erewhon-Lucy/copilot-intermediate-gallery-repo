import type { Photo } from '@/lib/mock-photo-data';

const extensionByMimeType: Record<string, string> = {
  'image/avif': 'avif',
  'image/bmp': 'bmp',
  'image/gif': 'gif',
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/svg+xml': 'svg',
  'image/tiff': 'tif',
  'image/webp': 'webp',
  'image/x-icon': 'ico',
};

const supportedExtensions = new Set(Object.values(extensionByMimeType));

function getImageExtension(contentType: string, url: string): string {
  const mimeType = contentType.split(';', 1)[0].trim().toLowerCase();
  if (mimeType.startsWith('image/')) {
    const knownExtension = extensionByMimeType[mimeType];
    const mimeExtension = mimeType.split('/')[1].split('+')[0];
    const extension = knownExtension ?? mimeExtension.replace(/^x-/, '');
    if (/^[a-z0-9]{1,8}$/.test(extension)) {
      return extension;
    }
  } else if (mimeType && mimeType !== 'application/octet-stream') {
    throw new Error('The selected file is not an image.');
  }

  const urlExtension = new URL(url, window.location.href)
    .pathname.split('/')
    .pop()
    ?.match(/\.([a-z0-9]{1,8})$/i)?.[1]
    .toLowerCase();
  if (urlExtension && supportedExtensions.has(urlExtension)) {
    return urlExtension;
  }

  throw new Error('The image format could not be determined. Check the photo asset URL and file type.');
}

function getSafeFilename(title: string, id: string, extension: string): string {
  const safeTitle = title
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/^\.+|\.+$/g, '')
    .slice(0, 100);
  const safeId = id.replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
  const baseName = safeTitle || `photo-${safeId || 'download'}`;
  const withoutMatchingExtension = baseName.toLowerCase().endsWith(`.${extension}`)
    ? baseName.slice(0, -(extension.length + 1))
    : baseName;

  return `${withoutMatchingExtension}.${extension}`;
}

export async function downloadPhoto(photo: Pick<Photo, 'id' | 'title' | 'url'>): Promise<void> {
  if (!photo.url.trim()) {
    throw new Error('This photo does not have a download URL.');
  }

  let response: Response;
  try {
    response = await fetch(photo.url);
  } catch {
    throw new Error('The photo could not be reached. Check that the asset exists and allows cross-origin requests.');
  }

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('The photo asset was not found. Check that its URL points to an available image.');
    }
    throw new Error(`The photo server returned an error (HTTP ${response.status}). Try again later.`);
  }

  let blob: Blob;
  try {
    blob = await response.blob();
  } catch {
    throw new Error('The photo data could not be read. Check the asset and cross-origin settings, then try again.');
  }

  const contentType = response.headers.get('content-type')?.trim() || blob.type;
  const extension = getImageExtension(contentType, photo.url);
  const link = document.createElement('a');
  const objectUrl = URL.createObjectURL(blob);

  try {
    link.href = objectUrl;
    link.download = getSafeFilename(photo.title, photo.id, extension);
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
  } finally {
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
}
