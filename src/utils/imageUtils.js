export async function resizeToBase64(file, size) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement('canvas');
      canvas.width  = size;
      canvas.height = size;
      const ctx = canvas.getContext('2d');
      const min = Math.min(img.naturalWidth, img.naturalHeight);
      const sx  = (img.naturalWidth  - min) / 2;
      const sy  = (img.naturalHeight - min) / 2;
      ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Immagine non caricabile')); };
    img.src = url;
  });
}
