import { useRef, useState } from "react";
import { api, apiError } from "@/lib/api";
import { ImagePlus, X, Loader2 } from "lucide-react";
import { toast } from "sonner";

// Uploads an image, returns file_id via onChange(fileId). Shows a local preview.
export function ImageUpload({ onChange, testId = "image" }) {
  const inputRef = useRef();
  const [preview, setPreview] = useState(null);
  const [uploading, setUploading] = useState(false);

  const pick = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setPreview(URL.createObjectURL(file));
    try {
      const form = new FormData();
      form.append("file", file);
      const { data } = await api.post("/media/upload", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      onChange(data.file_id);
      toast.success("Imagem carregada");
    } catch (err) {
      toast.error(apiError(err, "Falha ao enviar imagem"));
      setPreview(null);
      onChange(null);
    } finally {
      setUploading(false);
    }
  };

  const clear = () => {
    setPreview(null);
    onChange(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <div>
      {preview ? (
        <div className="relative inline-block">
          <img src={preview} alt="preview" className="max-h-48 rounded-xl border border-slate-800" />
          {uploading && (
            <div className="absolute inset-0 flex items-center justify-center bg-slate-950/60 rounded-xl">
              <Loader2 className="w-6 h-6 animate-spin text-emerald-400" />
            </div>
          )}
          <button
            type="button"
            data-testid={`${testId}-clear`}
            onClick={clear}
            className="absolute -top-2 -right-2 w-7 h-7 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-400 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          data-testid={`${testId}-dropzone`}
          onClick={() => inputRef.current?.click()}
          className="flex flex-col items-center justify-center gap-2 w-full py-8 rounded-xl border-2 border-dashed border-slate-800 text-slate-500 hover:border-emerald-500/50 hover:text-slate-300 transition-colors"
        >
          <ImagePlus className="w-7 h-7" />
          <span className="text-sm">Clique para adicionar uma imagem</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={pick} className="hidden" data-testid={`${testId}-input`} />
    </div>
  );
}
