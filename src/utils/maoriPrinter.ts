export async function generateMaoriWordImage(): Promise<string> {
  // Helper function defined directly in scope to prevent bundler reference errors
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

  // 1. Fetch from serverless API route
  const response = await fetch('/api/kupu-o-te-ra');
  if (!response.ok) {
    throw new Error(`API response failed with status: ${response.status}`);
  }

  const data = await response.json();
  if (data.error) {
    throw new Error(`Scraper API Error: ${data.error}`);
  }

  const word = data.word || '';
  const translation = data.translation || '';
  const sentenceMaori = data.examples?.[0] || '';
  const sentenceEnglish = data.examples?.[1] || '';

  // 2. Setup Canvas
  const width = 576;
  const height = 580;
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Background
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Border
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(15, 15, width - 30, height - 30);

  // Title Header
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 30px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('KUPU O TE RĀ', width / 2, 60);
  ctx.font = '16px monospace';
  ctx.fillText('kupu.maori.nz', width / 2, 85);

  // Divider Line
  ctx.beginPath();
  ctx.moveTo(35, 105);
  ctx.lineTo(width - 35, 105);
  ctx.stroke();

  // Word (Large)
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(word, width / 2, 165);

  // Translation / Definition
  ctx.font = 'bold 22px sans-serif';
  let currentY = wrapText(ctx, translation, width / 2, 215, width - 80, 28);

  // Example Sentences Section
  if (sentenceMaori) {
    currentY += 20;
    ctx.beginPath();
    ctx.moveTo(60, currentY);
    ctx.lineTo(width - 60, currentY);
    ctx.lineWidth = 1;
    ctx.stroke();

    currentY += 30;
    ctx.font = 'bold 18px sans-serif';
    ctx.fillText('TAUIRA / EXAMPLE', width / 2, currentY);

    currentY += 30;
    ctx.font = 'italic 20px sans-serif';
    currentY = wrapText(ctx, `"${sentenceMaori}"`, width / 2, currentY, width - 80, 26);

    if (sentenceEnglish) {
      currentY += 10;
      ctx.font = '18px sans-serif';
      wrapText(ctx, sentenceEnglish, width / 2, currentY, width - 80, 24);
    }
  }

  return canvas.toDataURL('image/png');
}
