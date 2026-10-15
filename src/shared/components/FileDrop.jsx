// Drag-and-drop (or click) upload with client-side type/size checks and a
// progress bar. Calls onUploaded(file) with the API's stored file record, once
// per file; `multiple` uploads several files one after another.
import { useRef, useState } from 'react';
import { UploadCloud } from 'lucide-react';
import { cn } from '@/shared/lib/cn';
import { UPLOAD_RULES, uploadFile } from '@/shared/lib/upload';

export default function FileDrop({ purpose, kind = 'document', onUploaded, disabled, compact, multiple, hint, label = 'Drop a file here or click to choose' }) {
  const input = useRef(null);
  const [over, setOver] = useState(false);
  const [progress, setProgress] = useState(null);
  const [count, setCount] = useState(null);
  const [errors, setErrors] = useState([]);
  const rule = UPLOAD_RULES[kind];

  const check = (file) => {
    if (file.size > rule.maxMB * 1048576) return `${file.name}: larger than ${rule.maxMB} MB`;
    const okType = rule.accept.split(',').some((t) => (t.startsWith('.') ? file.name.toLowerCase().endsWith(t) : file.type === t));
    return okType ? null : `${file.name}: use ${rule.label}`;
  };

  const sendAll = async (list) => {
    const files = [...(list || [])].slice(0, multiple ? 20 : 1);
    if (!files.length) return;
    const errs = [];
    for (let i = 0; i < files.length; i += 1) {
      const file = files[i];
      const bad = check(file);
      if (bad) { errs.push(bad); continue; }
      setCount(files.length > 1 ? `${i + 1} of ${files.length}` : null);
      setProgress(0);
      try {
        const saved = await uploadFile(file, purpose, { onProgress: setProgress });
        await onUploaded(saved, file);
      } catch (e) {
        errs.push(`${file.name}: ${e.message}`);
      }
    }
    setProgress(null);
    setCount(null);
    setErrors(errs);
    if (input.current) input.current.value = '';
  };

  const busy = progress !== null;
  return (
    <div>
      <button type="button" disabled={disabled || busy}
        onClick={() => input.current && input.current.click()}
        onDragOver={(e) => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => { e.preventDefault(); setOver(false); sendAll(e.dataTransfer.files); }}
        className={cn('flex w-full flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed text-center transition-colors disabled:cursor-not-allowed disabled:opacity-60',
          compact ? 'px-3 py-3' : 'px-4 py-6', over ? 'border-brand-500 bg-brand-50' : 'border-line-strong bg-surface-muted hover:border-brand-300 hover:bg-white')}>
        <UploadCloud className={cn('text-brand-600', compact ? 'h-5 w-5' : 'h-7 w-7')} aria-hidden />
        <span className="text-sm font-medium text-ink">{busy ? `Uploading${count ? ` ${count}` : ''}… ${progress}%` : label}</span>
        {!compact && <span className="text-xs text-ink-subtle">{hint || rule.label}</span>}
        {busy && <span className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full bg-brand-600 transition-all" style={{ width: `${progress}%` }} /></span>}
      </button>
      <input ref={input} type="file" accept={rule.accept} multiple={multiple} className="sr-only" tabIndex={-1} onChange={(e) => sendAll(e.target.files)} />
      {errors.length > 0 && <ul className="mt-1.5 space-y-0.5 text-xs text-danger-600" role="alert">{errors.map((e) => <li key={e}>{e}</li>)}</ul>}
    </div>
  );
}
