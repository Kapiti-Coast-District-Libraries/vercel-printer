export async function generateSudokuImage(): Promise<string> {
  // Fetch a puzzle grid from a free Sudoku API
  const response = await fetch('https://sudoku-api.vercel.app/api/dosuku');
  const data = await response.json();
  const grid: number[][] = data.newboard.grids[0].value;

  // 576px matches standard 80mm thermal print resolution
  const width = 576;
  const height = 650;
  const cellSize = width / 9;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context unavailable');

  // White background (high contrast for thermal print)
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, width, height);

  // Title Header
  ctx.fillStyle = '#000000';
  ctx.font = 'bold 36px monospace';
  ctx.textAlign = 'center';
  ctx.fillText('DAILY SUDOKU', width / 2, 50);

  const startY = 70;

  // Draw cells and numbers
  for (let r = 0; r < 9; r++) {
    for (let c = 0; c < 9; c++) {
      const x = c * cellSize;
      const y = startY + r * cellSize;
      const val = grid[r][c];

      // Light cell border
      ctx.lineWidth = 1;
      ctx.strokeStyle = '#000000';
      ctx.strokeRect(x, y, cellSize, cellSize);

      // Print filled numbers
      if (val !== 0) {
        ctx.fillStyle = '#000000';
        ctx.font = 'bold 36px sans-serif';
        ctx.fillText(val.toString(), x + cellSize / 2, y + cellSize / 2 + 12);
      }
    }
  }

  // Draw thick 3x3 grid borders
  ctx.lineWidth = 4;
  for (let i = 0; i <= 9; i += 3) {
    // Vertical lines
    ctx.beginPath();
    ctx.moveTo(i * cellSize, startY);
    ctx.lineTo(i * cellSize, startY + width);
    ctx.stroke();

    // Horizontal lines
    ctx.beginPath();
    ctx.moveTo(0, startY + i * cellSize);
    ctx.lineTo(width, startY + i * cellSize);
    ctx.stroke();
  }

  return canvas.toDataURL('image/png');
}

/**
 * Converts a base64 Data URL to a standard JavaScript File object
 */
export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/png';
  const bstr = atob(arr[1]);
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, { type: mime });
}
