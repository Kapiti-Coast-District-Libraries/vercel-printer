export async function generateMaoriWordImage(): Promise<string> {
  if (typeof window === 'undefined') {
    throw new Error('Canvas rendering must run in the browser');
  }

  const response = await fetch('/api/kupu-o-te-ra');
  if (!response.ok) throw new Error(`API response failed with status: ${response.status}`);

  const data = await response.json();
  if (data.error) throw new Error(`Scraper API Error: ${data.error}`);

  const word = data.word || '';
  const translation = data.translation || '';
  const sentenceMaori = data.examples?.[0] || '';
  const sentenceEnglish = data.examples?.[1] || '';

  const width = 576;
  
  // Calculate dynamic canvas height prior to rendering
  const dummyCanvas = document.createElement('canvas');
  const dCtx = dummyCanvas.getContext('2d')!;
  
  let requiredHeight = 220; // Base space for headers & title
  requiredHeight += measureTextHeight(dCtx, translation, 'bold 22px sans-serif', width - 80, 28);
  
  if (sentenceMaori) {
    requiredHeight += 60; // Padding + TAUIRA label
    requiredHeight += measureTextHeight(dCtx, `"${sentenceMaori}"`, 'italic 20px sans-serif', width - 80, 26);
    if (sentenceEnglish) {
      requiredHeight += 10;
      requiredHeight += measureTextHeight(dCtx, sentenceEnglish, '18px sans-serif', width - 80, 24);
    }
  }

  const height = Math.max(520, requiredHeight + 40);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // Background & Border
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);
  ctx.lineWidth = 4;
  ctx.strokeStyle = '#000000';
  ctx.strokeRect(15, 15, width - 30, height - 30);

  // Header
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

  // Word & Translation
  ctx.font = 'bold 44px sans-serif';
  ctx.fillText(word, width / 2, 165);

  ctx.font = 'bold 22px sans-serif';
  let currentY = wrapText(ctx, translation, width / 2, 215, width - 80, 28);

  // Examples Section
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

function measureTextHeight(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string,
  maxWidth: number,
  lineHeight: number
): number {
  if (!text) return 0;
  ctx.font = font;
  const words = text.split(' ');
  let line = '';
  let lines = 1;

  for (let n = 0; n < words.length; n++) {
    const testLine = line + words[n] + ' ';
    if (ctx.measureText(testLine).width > maxWidth && n > 0) {
      line = words[n] + ' ';
      lines++;
    } else {
      line = testLine;
    }
  }
  return lines * lineHeight;
}
