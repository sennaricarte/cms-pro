export interface CompressedImage {
  blob: Blob;
  width: number;
  height: number;
}

const DEFAULT_MAX_DIMENSION = 2000;
const DEFAULT_QUALITY = 0.85;

function isSvg(file: File): boolean {
  return file.type === 'image/svg+xml' || /\.svg$/i.test(file.name);
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Não foi possível ler a imagem para compressão.'));
    };

    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('O navegador não conseguiu exportar a imagem.'));
          return;
        }

        resolve(blob);
      },
      type,
      quality,
    );
  });
}

async function supportsWebpBlob(): Promise<boolean> {
  if (typeof document === 'undefined') {
    return false;
  }

  const canvas = document.createElement('canvas');
  canvas.width = 1;
  canvas.height = 1;

  if (typeof canvas.toBlob !== 'function') {
    return false;
  }

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, 'image/webp', 0.8);
  });

  return blob?.type === 'image/webp';
}

function scaledSize(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const longest = Math.max(width, height);

  if (longest <= maxDimension) {
    return { width, height };
  }

  const ratio = maxDimension / longest;
  return {
    width: Math.max(1, Math.round(width * ratio)),
    height: Math.max(1, Math.round(height * ratio)),
  };
}

export async function compressImage(
  file: File,
  maxDimension: number = DEFAULT_MAX_DIMENSION,
  quality: number = DEFAULT_QUALITY,
): Promise<CompressedImage> {
  if (isSvg(file)) {
    return {
      blob: file,
      width: 0,
      height: 0,
    };
  }

  const image = await loadImage(file);
  const { width, height } = scaledSize(image.naturalWidth, image.naturalHeight, maxDimension);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext('2d');

  if (!context) {
    throw new Error('Canvas 2D indisponível neste navegador.');
  }

  context.drawImage(image, 0, 0, width, height);

  const mime = (await supportsWebpBlob()) ? 'image/webp' : 'image/jpeg';
  const blob = await canvasToBlob(canvas, mime, quality);

  return { blob, width, height };
}
