export async function extractDominantColor(blob: Blob): Promise<string | undefined> {
  if (typeof window === "undefined" || !window.createImageBitmap) return undefined;
  try {
    const bitmap = await window.createImageBitmap(blob);
    const canvas = document.createElement("canvas");
    canvas.width = 50;
    canvas.height = 50;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return undefined;
    
    ctx.drawImage(bitmap, 0, 0, 50, 50);
    const imageData = ctx.getImageData(0, 0, 50, 50);
    const data = imageData.data;
    
    let r = 0, g = 0, b = 0;
    let count = 0;
    
    for (let i = 0; i < data.length; i += 4) {
      // Ignore completely transparent pixels
      if (data[i + 3] === 0) continue;
      r += data[i];
      g += data[i + 1];
      b += data[i + 2];
      count++;
    }
    
    if (count === 0) return undefined;
    
    r = Math.round(r / count);
    g = Math.round(g / count);
    b = Math.round(b / count);
    
    return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
  } catch (e) {
    console.error("color extraction failed", e);
    return undefined;
  }
}
