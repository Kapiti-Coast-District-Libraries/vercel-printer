/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { supabase } from "./supabase";
import { useState, useRef, useEffect, ChangeEvent } from 'react';
import { Upload, Printer, Settings, Image as ImageIcon, Trash2, RefreshCw, ZoomIn, Contrast, Cpu, AlertCircle, CheckCircle2, Grid, Languages } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { generateSudokuImage } from './utils/sudokuPrinter';
import { generateMaoriWordImage } from './utils/maoriPrinter';

// --- Constants ---
const PRINTER_WIDTHS = {
  '58mm': 384, // Standard 58mm printer dot width
  '80mm': 576, // Standard 80mm printer dot width
};

export default function App() {
  const [image, setImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [printerWidth, setPrinterWidth] = useState<'58mm' | '80mm'>('80mm');
  const [contrast, setContrast] = useState(1.6);
  const [isProcessing, setIsProcessing] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);

  // USB State
  const [usbDevice, setUsbDevice] = useState<any | null>(null);
  const [usbStatus, setUsbStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'error'>('disconnected');
  const [usbError, setUsbError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // --- Auto Connect Helper ---
  const autoConnectUsb = async () => {
    try {
      const devices = await (navigator as any).usb.getDevices();

      if (devices.length > 0) {
        const device = devices[0];

        await device.open();
        if (device.configuration === null) {
          await device.selectConfiguration(1);
        }

        await device.claimInterface(0);

        setUsbDevice(device);
        setUsbStatus('connected');
      }
    } catch (err: any) {
      console.error("Auto connect failed:", err);
    }
  };

  // --- WebUSB Integration ---
  const connectUsb = async () => {
    setUsbStatus('connecting');
    setUsbError(null);
    try {
      const device = await (navigator as any).usb.requestDevice({ filters: [] });
      await device.open();
      await device.selectConfiguration(1);
      await device.claimInterface(0);
      setUsbDevice(device);
      setUsbStatus('connected');
    } catch (err: any) {
      console.error('USB Connection Error:', err);
      setUsbStatus('error');
      setUsbError(err instanceof Error ? err.message : String(err));
    }
  };

  const disconnectUsb = async () => {
    if (usbDevice) {
      await usbDevice.close();
      setUsbDevice(null);
      setUsbStatus('disconnected');
    }
  };

  useEffect(() => {
    window.focus();
    autoConnectUsb();
  }, []);

  // --- Print Generation Triggers ---
  const handleGenerateSudoku = async () => {
    setFileName(null);
    setIsProcessing(true);
    try {
      const sudokuDataUrl = await generateSudokuImage();
      setImage(sudokuDataUrl);
    } catch (err: any) {
      console.error("Failed to generate Sudoku:", err);
      setUsbError("Sudoku error: " + (err instanceof Error ? err.message : "Unknown error"));
      setIsProcessing(false);
    }
  };

  const handleGenerateMaoriWord = async () => {
    setFileName(null);
    setIsProcessing(true);
    try {
      const maoriDataUrl = await generateMaoriWordImage();
      setImage(maoriDataUrl);
    } catch (err: any) {
      console.error("Failed to generate Māori Word of the Day:", err);
      setUsbError("Māori Word error: " + (err instanceof Error ? err.message : "Unknown error"));
      setIsProcessing(false);
    }
  };

  // --- Global Keyboard Listener (1 = Sudoku, 3 = Kupu o te Rā) ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (['INPUT', 'TEXTAREA'].includes((e.target as HTMLElement)?.tagName)) return;

      console.log(`Key pressed: key="${e.key}", code="${e.code}"`);

      if (e.key === '1' || e.key === 'End' || e.code === 'Numpad1' || e.code === 'Digit1') {
        e.preventDefault();
        handleGenerateSudoku();
      } else if (e.key === '3' || e.key === 'PageDown' || e.code === 'Numpad3' || e.code === 'Digit3') {
        e.preventDefault();
        handleGenerateMaoriWord();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [printerWidth]);

  // --- ESC/POS Encoding ---
  const getEscPosData = (canvas: HTMLCanvasElement): Uint8Array => {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return new Uint8Array();

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;

    const widthInBytes = Math.ceil(width / 8);
    const header = new Uint8Array([
      0x1B, 0x40, // Initialize
      0x1D, 0x76, 0x30, 0, // GS v 0 0
      widthInBytes % 256, Math.floor(widthInBytes / 256), // xL xH
      height % 256, Math.floor(height / 256) // yL yH
    ]);

    const pixelData = new Uint8Array(widthInBytes * height);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = (y * width + x) * 4;
        const gray = data[i];
        if (gray < 128) {
          const byteIdx = y * widthInBytes + Math.floor(x / 8);
          const bitIdx = 7 - (x % 8);
          pixelData[byteIdx] |= (1 << bitIdx);
        }
      }
    }

    const footer = new Uint8Array([0x0A, 0x0A, 0x0A, 0x1D, 0x56, 0x41, 0x03]); // Line feeds + Cut
    const combined = new Uint8Array(header.length + pixelData.length + footer.length);
    combined.set(header);
    combined.set(pixelData, header.length);
    combined.set(footer, header.length + pixelData.length);

    return combined;
  };

  // --- Thermal Optimise Pre-processing ---
  function _boxBlur(g: Float32Array, w: number, h: number, radius: number) {
    const tmp = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let kx = -radius; kx <= radius; kx++) {
          const nx = x + kx;
          if (nx >= 0 && nx < w) { sum += g[y * w + nx]; count++; }
        }
        tmp[y * w + x] = sum / count;
      }
    }
    const out = new Float32Array(w * h);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0, count = 0;
        for (let ky = -radius; ky <= radius; ky++) {
          const ny = y + ky;
          if (ny >= 0 && ny < h) { sum += tmp[ny * w + x]; count++; }
        }
        out[y * w + x] = sum / count;
      }
    }
    return out;
  }

  function applyThermalOptimise(g: Float32Array, w: number, h: number) {
    const n = w * h;
    const invGamma = 1 / 1.4;
    for (let i = 0; i < n; i++) {
      g[i] = 255 * Math.pow(g[i] / 255, invGamma);
    }
    const cFactor = 1.2;
    for (let i = 0; i < n; i++) {
      g[i] = Math.max(0, Math.min(255, 128 + (g[i] - 128) * cFactor));
    }
    const blurred = _boxBlur(g, w, h, 2);
    const amount = 1.5;
    for (let i = 0; i < n; i++) {
      g[i] = Math.max(0, Math.min(255, g[i] + amount * (g[i] - blurred[i])));
    }
  }

  function ditherAtkinson(g: Float32Array, w: number, h: number, t: number) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        const old = g[idx];
        const nw = old < t ? 0 : 255;
        g[idx] = nw;
        const err = (old - nw) / 8;
        if (x + 1 < w) g[idx + 1] += err;
        if (x + 2 < w) g[idx + 2] += err;
        if (y + 1 < h && x > 0) g[idx + w - 1] += err;
        if (y + 1 < h) g[idx + w] += err;
        if (y + 1 < h && x + 1 < w) g[idx + w + 1] += err;
        if (y + 2 < h) g[idx + w * 2] += err;
      }
    }
  }

  const handleDirectPrint = async () => {
    if (!usbDevice || !canvasRef.current) return;
    
    try {
      if (!usbDevice.opened) {
        await usbDevice.open();
        await usbDevice.selectConfiguration(1);
        await usbDevice.claimInterface(0);
      }
      
      const data = getEscPosData(canvasRef.current);
      const endpoint = usbDevice.configuration?.interfaces[0].alternate.endpoints.find((e: any) => e.direction === 'out');
      if (!endpoint) throw new Error('No output endpoint found');
      
      await usbDevice.transferOut(endpoint.endpointNumber, data);
      
      const { error: logError } = await supabase
        .from('print_logs')
        .insert([{}]);
      
      if (logError) console.error("Admin Log Error:", logError);
      
    } catch (err: any) {
      console.error('Print Error:', err);
      setUsbError('Print failed: ' + (err instanceof Error ? err.message : 'Unknown error'));
    }
  };

  // --- Image Processing ---
  const processImage = async (imgSrc: string) => {
    setIsProcessing(true);
    try {
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = async () => {
          try {
            const canvas = canvasRef.current;
            if (!canvas) throw new Error("Canvas not available");
            const ctx = canvas.getContext("2d");
            if (!ctx) throw new Error("Canvas context not available");

            const targetWidth = PRINTER_WIDTHS[printerWidth];
            const scale = targetWidth / img.width;
            const targetHeight = Math.floor(img.height * scale);

            canvas.width = targetWidth;
            canvas.height = targetHeight;
            ctx.drawImage(img, 0, 0, targetWidth, targetHeight);

            const imageData = ctx.getImageData(0, 0, targetWidth, targetHeight);
            const data = imageData.data;
            const w = targetWidth;
            const h = targetHeight;
            const gray = new Float32Array(w * h);

            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                gray[y * w + x] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
              }
            }

            applyThermalOptimise(gray, w, h);
            ditherAtkinson(gray, w, h, 128);

            for (let y = 0; y < h; y++) {
              for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const v = gray[y * w + x] < 128 ? 0 : 255;
                data[i] = data[i + 1] = data[i + 2] = v;
                data[i + 3] = 255;
              }
            }

            ctx.putImageData(imageData, 0, 0);
            setProcessedImage(canvas.toDataURL("image/png"));

            await handleDirectPrint();
            resolve();
          } catch (err) { reject(err); }
        };
        img.onerror = () => reject(new Error("Image failed to load"));
        img.src = imgSrc;
      });

      // Cleanup Supabase Storage safely if a remote file was pulled
      if (fileName) {
        try {
          await supabase.storage.from("uploads").remove([fileName]);
        } catch (e) {
          console.warn("Storage cleanup notice:", e);
        } finally {
          setFileName(null);
        }
      }

    } catch (err: any) {
      console.error("Processing error:", err);
      setUsbError("Processing failed: " + (err instanceof Error ? err.message : "Unknown error"));
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    const subscription = supabase
      .channel("print_queue_listener")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "print_queue" },
        async (payload) => {
          const row = payload.new;
          if (!row || row.printed) return;
          
          setImage(row.image_url);
          const fileNameX = row.image_url.split("/").pop();
          setFileName(fileNameX ?? null);

          await supabase.from("print_queue").delete().eq("id", row.id);
        }
      ).subscribe();

    return () => { supabase.removeChannel(subscription); };
  }, []);

  useEffect(() => {
    if (image) processImage(image);
  }, [image, printerWidth, contrast]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setFileName(null);
      const reader = new FileReader();
      reader.onload = (event) => setImage(event.target?.result as string);
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0E10] text-[#FFFFFF] font-sans selection:bg-[#FF4444] selection:text-white">
      <header className="border-b border-white/5 px-6 py-4 flex items-center justify-between bg-[#131417] sticky top-0 z-50 backdrop-blur-md bg-opacity-80">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-[#FF4444] rounded-xl flex items-center justify-center shadow-[0_0_20px_rgba(255,68,68,0.4)]">
            <Printer className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold tracking-tight">Thermal Print Studio</h1>
            <div className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              <p className="text-[9px] uppercase tracking-[0.2em] text-[#8E9299] font-mono">Hardware Direct v2.0</p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <AnimatePresence mode="wait">
            {usbStatus === 'connected' ? (
              <motion.div 
                initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/20 rounded-full text-emerald-500 text-[10px] font-mono uppercase tracking-widest"
              >
                <CheckCircle2 className="w-3 h-3" />
                {usbDevice?.productName || 'USB Printer Connected'}
                <div className="flex items-center gap-2 ml-2 border-l border-emerald-500/20 pl-2">
                  <button onClick={disconnectUsb} className="hover:text-white transition-colors">Disconnect</button>
                  <button onClick={connectUsb} className="text-emerald-500/50 hover:text-white transition-colors" title="Force Reconnect"><RefreshCw className="w-3 h-3" /></button>
                </div>
              </motion.div>
            ) : (
              <motion.button 
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                onClick={connectUsb}
                className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-full transition-all text-[10px] font-mono uppercase tracking-widest text-[#8E9299] hover:text-white"
              >
                <Cpu className="w-4 h-4" />
                Connect USB Printer
              </motion.button>
            )}
          </AnimatePresence>

          <button
            onClick={handleGenerateSudoku}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all text-xs font-mono uppercase tracking-wider text-white"
          >
            <Grid className="w-4 h-4 text-[#FF4444]" />
            Sudoku
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/10 rounded text-[#8E9299]">1</kbd>
          </button>

          <button
            onClick={handleGenerateMaoriWord}
            className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-full transition-all text-xs font-mono uppercase tracking-wider text-white"
          >
            <Languages className="w-4 h-4 text-[#FF4444]" />
            Kupu o te Rā
            <kbd className="px-1.5 py-0.5 text-[9px] font-mono bg-white/10 rounded text-[#8E9299]">3</kbd>
          </button>
          
          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-5 py-2 bg-[#FF4444] hover:bg-[#FF5555] rounded-full transition-all text-sm font-bold shadow-[0_0_20px_rgba(255,68,68,0.2)]"
          >
            <Upload className="w-4 h-4" />
            Upload
          </button>
          <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto p-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
        <aside className="lg:col-span-4 space-y-6">
          <section className="bg-[#131417] border border-white/5 rounded-3xl p-6 space-y-8 shadow-2xl">
            <div className="flex items-center gap-2 text-[#8E9299]">
              <Settings className="w-4 h-4" />
              <h2 className="text-[10px] uppercase tracking-[0.2em] font-mono">Engine Calibration</h2>
            </div>

            <div className="space-y-6">
              <div className="space-y-3">
                <label className="text-[10px] text-[#8E9299] uppercase tracking-widest font-mono">Paper Standard</label>
                <div className="grid grid-cols-2 gap-3">
                  {(['58mm', '80mm'] as const).map((width) => (
                    <button
                      key={width}
                      onClick={() => setPrinterWidth(width)}
                      className={`py-3 rounded-xl border transition-all text-xs font-bold tracking-widest ${
                        printerWidth === width 
                          ? 'bg-[#FF4444] border-[#FF4444] text-white shadow-[0_0_15px_rgba(255,68,68,0.3)]' 
                          : 'bg-white/5 border-white/10 text-[#8E9299] hover:border-white/20'
                      }`}
                    >
                      {width}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <label className="text-[10px] text-[#8E9299] uppercase tracking-widest font-mono flex items-center gap-2">
                    <Contrast className="w-3 h-3" /> Contrast Gain
                  </label>
                  <span className="text-[10px] font-mono text-[#FF4444] bg-[#FF4444]/10 px-2 py-0.5 rounded">{contrast.toFixed(1)}x</span>
                </div>
                <input 
                  type="range" min="0.5" max="3" step="0.1" value={contrast} 
                  onChange={(e) => setContrast(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-white/5 rounded-lg appearance-none cursor-pointer accent-[#FF4444]"
                />
              </div>
            </div>

            <div className="pt-6 border-t border-white/5 space-y-4">
              {usbStatus === 'connected' ? (
                <button 
                  onClick={handleDirectPrint}
                  disabled={!processedImage}
                  className="w-full py-5 bg-[#FF4444] hover:bg-[#FF5555] disabled:opacity-50 text-white rounded-2xl font-black text-sm tracking-[0.2em] flex flex-col items-center justify-center gap-1 transition-all shadow-[0_10px_30px_rgba(255,68,68,0.4)] active:scale-[0.98]"
                >
                  <div className="flex items-center gap-2">
                    <Cpu className="w-5 h-5" />
                    DIRECT USB PRINT
                  </div>
                  <span className="text-[8px] opacity-60 font-mono uppercase tracking-widest">Hardware Direct Output</span>
                </button>
              ) : (
                <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-start gap-3">
                  <Cpu className="w-5 h-5 text-[#8E9299] shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-[#8E9299] uppercase tracking-wider">Hardware Link Required</p>
                    <p className="text-[9px] text-[#4A4B50] leading-relaxed">
                      Connect your USB thermal printer to enable direct hardware communication and high-fidelity printing.
                    </p>
                  </div>
                </div>
              )}
              
              {usbError && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-2 text-red-500 text-[9px] font-mono uppercase">
                  <AlertCircle className="w-3 h-3" />
                  {usbError}
                </div>
              )}
            </div>
          </section>

          {image && (
            <section className="bg-[#131417] border border-white/5 rounded-3xl p-5 group">
              <div className="flex items-center justify-between mb-4">
                <span className="text-[9px] uppercase tracking-[0.2em] text-[#8E9299] font-mono">Source Buffer</span>
                <button onClick={() => setImage(null)} className="text-[#8E9299] hover:text-[#FF4444] transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
              <div className="relative rounded-xl overflow-hidden">
                <img src={image} className="w-full opacity-40 grayscale group-hover:opacity-60 transition-opacity" alt="Original" />
                <div className="absolute inset-0 bg-gradient-to-t from-[#131417] to-transparent"></div>
              </div>
            </section>
          )}
        </aside>

        <div className="lg:col-span-8">
          <div className="bg-[#080809] border border-white/5 rounded-[2.5rem] min-h-[700px] flex flex-col items-center justify-center p-12 relative overflow-hidden shadow-inner">
            <div className="absolute inset-0 opacity-[0.05] pointer-events-none" 
                 style={{ backgroundImage: 'linear-gradient(#FFFFFF 1px, transparent 1px), linear-gradient(90deg, #FFFFFF 1px, transparent 1px)', backgroundSize: '40px 40px' }}></div>
            
            <AnimatePresence mode="wait">
              {!image ? (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 1.1 }}
                  className="text-center space-y-6 relative z-10"
                >
                  <div className="w-24 h-24 bg-white/5 border border-dashed border-white/10 rounded-[2rem] flex items-center justify-center mx-auto mb-8">
                    <ImageIcon className="w-10 h-10 text-white/10" />
                  </div>
                  <h3 className="text-2xl font-bold text-white/80 tracking-tight">Awaiting Input</h3>
                  <p className="text-xs text-[#8E9299] max-w-xs mx-auto leading-relaxed uppercase tracking-widest font-mono">
                    Press <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">1</kbd> for Sudoku or <kbd className="px-1.5 py-0.5 bg-white/10 rounded text-white">3</kbd> for Kupu o te Rā.
                  </p>
                </motion.div>
              ) : (
                <motion.div 
                  initial={{ opacity: 0, y: 40 }} animate={{ opacity: 1, y: 0 }}
                  className="relative"
                >
                  <div 
                    className="bg-white shadow-[0_40px_100px_rgba(0,0,0,0.8)] transition-all duration-700 ease-out overflow-hidden"
                    style={{ 
                      width: printerWidth === '58mm' ? '320px' : '440px',
                      minHeight: '500px'
                    }}
                  >
                    <div className="h-6 w-full bg-gradient-to-b from-black/10 to-transparent"></div>
                    <div className="p-6 flex flex-col items-center">
                      {isProcessing ? (
                        <div className="py-32 flex flex-col items-center gap-6">
                          <RefreshCw className="w-10 h-10 text-black/10 animate-spin" />
                          <span className="text-[9px] font-mono text-black/30 uppercase tracking-[0.4em]">Compiling Bits...</span>
                        </div>
                      ) : (
                        processedImage && (
                          <motion.img 
                            initial={{ opacity: 0, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, filter: 'blur(0px)' }}
                            src={processedImage} 
                            className="w-full h-auto pixelated"
                            style={{ imageRendering: 'pixelated' }}
                          />
                        )
                      )}
                    </div>
                    <div className="h-6 w-full flex overflow-hidden">
                      {Array.from({ length: 24 }).map((_, i) => (
                        <div key={i} className="flex-1 h-full bg-white rotate-45 translate-y-3 border-t border-l border-black/5"></div>
                      ))}
                    </div>
                  </div>
                  <div className="absolute -top-12 left-0 flex items-center gap-3">
                    <span className="px-3 py-1 bg-[#FF4444] text-white text-[8px] font-black uppercase tracking-widest rounded-full shadow-lg shadow-[#FF4444]/20">Hardware Preview</span>
                    <span className="text-[8px] text-[#8E9299] font-mono uppercase tracking-[0.2em]">{printerWidth} Virtual Paper</span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div className="mt-8 flex items-center justify-between px-6">
            <div className="flex items-center gap-8">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${usbStatus === 'connected' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]' : 'bg-white/10'}`}></div>
                <span className="text-[9px] font-mono text-[#8E9299] uppercase tracking-[0.2em]">USB Link: {usbStatus}</span>
              </div>
              <div className="flex items-center gap-3">
                <ZoomIn className="w-3.5 h-3.5 text-[#8E9299]" />
                <span className="text-[9px] font-mono text-[#8E9299] uppercase tracking-[0.2em]">Dither: Atkinson</span>
              </div>
            </div>
            <p className="text-[9px] font-mono text-[#8E9299] uppercase tracking-[0.2em]">
              Resolution: {printerWidth === '58mm' ? '384' : '576'} Dots
            </p>
          </div>
        </div>
      </main>

      <canvas ref={canvasRef} className="hidden" />

      <footer className="mt-20 border-t border-white/5 p-10 text-center">
        <p className="text-[9px] font-mono text-[#3A3B40] uppercase tracking-[0.5em]">
          Hardware-Direct Thermal Engine // 2026 Edition
        </p>
      </footer>

      <style>{`
        .pixelated {
          image-rendering: -moz-crisp-edges;
          image-rendering: -webkit-crisp-edges;
          image-rendering: pixelated;
          image-rendering: crisp-edges;
        }
        input[type="range"]::-webkit-slider-thumb {
          appearance: none;
          width: 16px;
          height: 16px;
          background: #FF4444;
          border-radius: 50%;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(255,68,68,0.5);
          border: 2px solid #0D0E10;
        }
      `}</style>
    </div>
  );
}
