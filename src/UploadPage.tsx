import React, { useState } from 'react';
import { supabase } from './supabase';
import { Upload, CheckCircle2, AlertCircle, RefreshCw } from 'lucide-react';

export function UploadPage() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setMessage(null);

    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${Math.random().toString(36).substring(2)}_${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      // Upload image to Supabase Storage bucket 'uploads'
      const { error: uploadError } = await supabase.storage
        .from('uploads')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get Public URL
      const { data: publicUrlData } = supabase.storage
        .from('uploads')
        .getPublicUrl(filePath);

      const publicUrl = publicUrlData.publicUrl;

      // Insert into print_queue table
      const { error: dbError } = await supabase
        .from('print_queue')
        .insert([{ image_url: publicUrl, printed: false }]);

      if (dbError) throw dbError;

      setMessage({ type: 'success', text: 'Image sent to print queue!' });
    } catch (err: any) {
      console.error('Upload Error:', err);
      setMessage({ type: 'error', text: err.message || 'Failed to upload image.' });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0D0E10] text-[#FFFFFF] font-sans flex flex-col items-center justify-center p-6">
      <div className="max-w-md w-full bg-[#131417] border border-white/10 rounded-3xl p-8 space-y-6 shadow-2xl text-center">
        <div className="w-16 h-16 bg-[#FF4444] rounded-2xl flex items-center justify-center mx-auto shadow-[0_0_20px_rgba(255,68,68,0.4)]">
          <Upload className="w-8 h-8 text-white" />
        </div>

        <div>
          <h1 className="text-2xl font-bold tracking-tight">Upload Image</h1>
          <p className="text-xs text-[#8E9299] font-mono mt-1 uppercase tracking-widest">
            Send a photo directly to the thermal printer
          </p>
        </div>

        <label className="block cursor-pointer">
          <div className="py-12 px-6 border-2 border-dashed border-white/20 hover:border-[#FF4444] rounded-2xl bg-white/5 transition-all flex flex-col items-center justify-center gap-3">
            {uploading ? (
              <>
                <RefreshCw className="w-8 h-8 text-[#FF4444] animate-spin" />
                <span className="text-xs font-mono uppercase tracking-widest text-white/80">Uploading...</span>
              </>
            ) : (
              <>
                <Upload className="w-8 h-8 text-[#8E9299]" />
                <span className="text-xs font-mono uppercase tracking-widest text-white/80">Choose Photo</span>
              </>
            )}
          </div>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={uploading}
            className="hidden"
          />
        </label>

        {message && (
          <div className={`p-4 rounded-xl flex items-center justify-center gap-2 text-xs font-mono uppercase tracking-wider ${
            message.type === 'success' ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-500' : 'bg-red-500/10 border border-red-500/20 text-red-500'
          }`}>
            {message.type === 'success' ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
            {message.text}
          </div>
        )}
      </div>
    </div>
  );
}

export default UploadPage;
