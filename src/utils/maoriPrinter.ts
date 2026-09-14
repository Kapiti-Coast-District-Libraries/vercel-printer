export async function generateMaoriWordImage(): Promise<string> {
  function wrapText(
    ctx: CanvasRenderingContext2D,
    text: string,
    x: number,
    y: number,
    maxWidth: number,
    lineHeight: number
  ): number {
    if (!text) return y;
    const words = text.split(' ');
    let line = '';
    let currentY = y;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      const metrics = ctx.measureText(testLine);
      if (metrics.width > maxWidth && n > 0) {
        ctx.fillText(line.trim(), x, currentY);
        line = words[n] + ' ';
        currentY += lineHeight;
      } else {
        line = testLine;
      }
    }
    ctx.fillText(line.trim(), x, currentY);
    return currentY + lineHeight;
  }

  function measureHeight(
    ctx: CanvasRenderingContext2D,
    text: string,
    maxWidth: number,
    lineHeight: number
  ): number {
    if (!text) return 0;
    const words = text.split(' ');
    let line = '';
    let count = 1;

    for (let n = 0; n < words.length; n++) {
      const testLine = line + words[n] + ' ';
      if (ctx.measureText(testLine).width > maxWidth && n > 0) {
        line = words[n] + ' ';
        count++;
      } else {
        line = testLine;
      }
    }
    return count * lineHeight;
  }

  const response = await fetch('/api/kupu-o-te-ra');
  if (!response.ok) throw new Error(`API response failed with status: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(`Scraper API Error: ${data.error}`);

  const word = data.word || '';
  const translation = data.translation || '';
  const details: string[] = data.details || data.examples || [];

  const width = 576;
  const dummyCanvas = document.createElement('canvas');
  const dCtx = dummyCanvas.getContext('2d')!;

  // Dynamic canvas height calculation
  let calculatedHeight = 220;
  dCtx.font = 'bold 22px sans-serif';
  calculatedHeight += measureHeight(dCtx, translation, width - 80, 28);

  if (details.length > 0) {
    calculatedHeight += 60;
    for (const item of details) {
      const isBullet = item.startsWith('-') || item.startsWith('See also');
      dCtx.font = isBullet ? 'italic 16px sans-serif' : '18px sans-serif';
      const lh = isBullet ? 22 : 26;
      calculatedHeight += measureHeight(dCtx, item, width - 80, lh) + 8;
    }
  }

  const height = Math.max(520, calculatedHeight + 40);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Background & Outer Border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(15, 15, width - 30, height - 30);

  // Receipt Header
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KUPU O TE RĀ', width / 2, 60);
  ctx.font = '16px monospace';
  ctx.fillText('kupu.maori.nz', width / 2, 85);

  ctx.beginPath();
  ctx.moveTo(35, 105);
  ctx.lineTo(width - 35, 105);
  ctx.stroke();

  // Word & Main Translation
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(word, width / 2, 165);

  ctx.font = 'bold 22px sans-serif';
  let currentY = wrapText(ctx, translation, width / 2, 215, width - 80, 28);

  // Content Details Section
  if (details.length > 0) {
    currentY += 15;
    ctx.beginPath();
    ctx.moveTo(60, currentY);
    ctx.lineTo(width - 60, currentY);
    ctx.lineWidth = 1;
    ctx.stroke();

    currentY += 30;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('TAUIRA & KŌRERO / DETAILS', width / 2, currentY);
    currentY += 30;

    for (const item of details) {
      const isBullet = item.startsWith('-') || item.startsWith('See also');
      ctx.font = isBullet ? 'italic 16px sans-serif' : '18px sans-serif';
      const lh = isBullet ? 22 : 26;
      currentY = wrapText(ctx, item, width / 2, currentY, width - 80, lh) + 8;
    }
  }

  return canvas.toDataURL('image/png');
}
