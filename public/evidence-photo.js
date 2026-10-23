(function () {
  const maxBytes = 900 * 1024;
  const acceptedTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
  const variants = [
    { edge: 1600, quality: 0.82 },
    { edge: 1440, quality: 0.72 },
    { edge: 1280, quality: 0.62 },
    { edge: 960, quality: 0.55 }
  ];

  function readDataUrl(blob) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      const timer = setTimeout(() => { reader.abort(); reject(new Error("A leitura da fotografia demorou demasiado. Tente novamente.")); }, 30000);
      reader.onload = () => { clearTimeout(timer); resolve(reader.result); };
      reader.onerror = () => { clearTimeout(timer); reject(new Error("Não foi possível ler a fotografia.")); };
      reader.onabort = () => clearTimeout(timer);
      reader.readAsDataURL(blob);
    });
  }

  function decodeImage(file) {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const image = new Image();
      const finish = (error) => {
        clearTimeout(timer);
        URL.revokeObjectURL(url);
        image.onload = null;
        image.onerror = null;
        if (error) reject(error);
        else resolve(image);
      };
      const timer = setTimeout(() => finish(new Error("A fotografia demorou demasiado a abrir. Tente outra vez.")), 30000);
      image.onload = () => finish();
      image.onerror = () => finish(new Error("Não foi possível abrir a fotografia. No iPhone, tire-a diretamente na aplicação ou use o formato Mais Compatível."));
      image.src = url;
    });
  }

  function encodeJpeg(canvas, quality) {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("A preparação da fotografia demorou demasiado. Tente outra vez.")), 30000);
      canvas.toBlob((blob) => {
        clearTimeout(timer);
        if (!blob) reject(new Error("Não foi possível preparar a fotografia."));
        else resolve(blob);
      }, "image/jpeg", quality);
    });
  }

  async function prepare(file) {
    if (!file?.size) throw new Error("A fotografia está vazia. Tire-a novamente.");
    if (file.size > 40 * 1024 * 1024) throw new Error("Esta fotografia é demasiado grande. Tire uma nova fotografia.");
    if (acceptedTypes.has(file.type) && file.size <= maxBytes) {
      return { name: file.name, type: file.type, size: file.size, originalByteSize: file.size,
        processed: false, lastModified: file.lastModified, dataUrl: await readDataUrl(file) };
    }

    const image = await decodeImage(file);
    const canvas = document.createElement("canvas");
    for (const variant of variants) {
      const scale = Math.min(1, variant.edge / Math.max(image.naturalWidth, image.naturalHeight));
      canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
      canvas.getContext("2d").drawImage(image, 0, 0, canvas.width, canvas.height);
      const blob = await encodeJpeg(canvas, variant.quality);
      if (blob.size <= maxBytes) {
        canvas.width = 0;
        canvas.height = 0;
        return { name: (file.name || "fotografia").replace(/\.[^.]+$/, "") + ".jpg", type: "image/jpeg",
          size: blob.size, originalByteSize: file.size, processed: true,
          lastModified: file.lastModified, dataUrl: await readDataUrl(blob) };
      }
    }
    canvas.width = 0;
    canvas.height = 0;
    throw new Error("Não foi possível reduzir esta fotografia para envio. Tente tirar outra.");
  }

  window.TrataEvidencePhoto = { prepare, maxBytes };
})();
