
import React, { useState, useRef } from 'react';
import { 
  FileMusic, 
  Upload, 
  Trash2, 
  Download, 
  RefreshCw,
  ShieldCheck,
  Zap,
  AlertCircle,
  ChevronDown,
  Archive,
  CheckCircle2
} from 'lucide-react';
import JSZip from 'jszip';
import { CueFile, FileStatus, SUPPORTED_ENCODINGS } from './types';
import { decodeBuffer, isLikelyGarbled, downloadFile, autoDetectEncoding } from './utils/encodingUtils';

const App: React.FC = () => {
  const [files, setFiles] = useState<CueFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFiles = async (selectedFiles: File[]) => {
    if (selectedFiles.length === 0) return;

    const newFiles: CueFile[] = await Promise.all(
      selectedFiles.map(async (file: File) => {
        const arrayBuffer = await file.arrayBuffer();
        const initialText = decodeBuffer(arrayBuffer, 'utf-8');
        const looksGarbled = isLikelyGarbled(initialText);

        return {
          id: Math.random().toString(36).substring(2, 11),
          name: file.name,
          size: file.size,
          lastModified: file.lastModified,
          originalRaw: arrayBuffer,
          decodedContent: initialText,
          fixedContent: '',
          detectedEncoding: looksGarbled ? 'unknown' : 'utf-8',
          status: FileStatus.PENDING
        };
      })
    );

    setFiles(prev => [...prev, ...newFiles]);
  };

  const onFilesSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []) as File[];
    await processFiles(selectedFiles);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const fixFile = async (fileId: string, manualEncoding?: string) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: FileStatus.PROCESSING } : f));
    
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    // Simulate small delay for UI feedback
    await new Promise(r => setTimeout(r, 100));

    try {
      let result;
      if (manualEncoding && manualEncoding !== 'auto') {
        result = { 
          text: decodeBuffer(file.originalRaw, manualEncoding), 
          encoding: manualEncoding 
        };
      } else {
        result = autoDetectEncoding(file.originalRaw);
      }

      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        fixedContent: result.text, 
        detectedEncoding: result.encoding,
        status: FileStatus.FIXED 
      } : f));

    } catch (error: any) {
      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        status: FileStatus.ERROR,
        errorMessage: error.message 
      } : f));
    }
  };

  const handleManualEncoding = (fileId: string, encoding: string) => {
    fixFile(fileId, encoding);
  };

  const fixAll = async () => {
    setIsProcessing(true);
    const pendingFiles = files.filter(f => f.status !== FileStatus.FIXED);
    // Process in chunks or sequentially for UI smoothness
    for (const file of pendingFiles) {
      await fixFile(file.id);
    }
    setIsProcessing(false);
  };

  const downloadAll = async () => {
    const fixedFiles = files.filter(f => f.status === FileStatus.FIXED);
    if (fixedFiles.length === 0) return;

    if (fixedFiles.length === 1) {
      downloadFile(fixedFiles[0].fixedContent, fixedFiles[0].name);
      return;
    }

    setIsDownloading(true);
    try {
      const zip = new JSZip();
      const BOM = new Uint8Array([0xEF, 0xBB, 0xBF]);

      fixedFiles.forEach(file => {
        const contentWithBom = new Blob([BOM, file.fixedContent], { type: 'text/plain;charset=utf-8' });
        zip.file(file.name, contentWithBom);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `Fixed_CUE_${new Date().toISOString().slice(0,10)}.zip`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert("打包下载失败");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8 flex flex-col items-center bg-[#f8fafc]">
      <header className="w-full max-w-5xl mb-10 text-center">
        <div className="flex items-center justify-center mb-4 space-x-3">
          <div className="bg-indigo-600 p-3 rounded-2xl shadow-xl shadow-indigo-100">
            <FileMusic className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">CUE 编码助手</h1>
        </div>
        <p className="text-slate-500 max-w-2xl mx-auto">
          本地极速修复乱码。采用智能启发式算法自动探测编码，支持一键打包下载。
        </p>
      </header>

      <main className="w-full max-w-5xl flex flex-col gap-6">
        <section 
          className={`relative border-2 border-dashed rounded-3xl p-10 transition-all cursor-pointer ${
            isDragging ? 'border-indigo-600 bg-indigo-50/50' : 'border-slate-300 bg-white hover:border-indigo-400'
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={async (e) => {
            e.preventDefault();
            setIsDragging(false);
            const droppedFiles = (Array.from(e.dataTransfer.files) as File[]).filter(f => f.name.toLowerCase().endsWith('.cue') || f.name.toLowerCase().endsWith('.txt'));
            await processFiles(droppedFiles);
          }}
        >
          <input type="file" multiple accept=".cue,.txt" className="hidden" ref={fileInputRef} onChange={onFilesSelected} />
          <div className="flex flex-col items-center text-center">
            <Upload className={`w-10 h-10 mb-3 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
            <h3 className="text-lg font-semibold text-slate-700">拖入 CUE 文件</h3>
            <p className="text-sm text-slate-400 font-medium">100% 离线处理，保障隐私安全</p>
          </div>
        </section>

        {files.length > 0 && (
          <>
            <div className="flex justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <span className="text-sm font-medium text-slate-500">{files.length} 个文件待处理</span>
              <div className="flex gap-2">
                <button onClick={() => setFiles([])} className="text-sm text-slate-400 hover:text-red-500 px-3 py-2 transition-colors">清空</button>
                <button 
                  onClick={fixAll}
                  disabled={isProcessing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  一键修复全部
                </button>
                <button 
                  onClick={downloadAll}
                  disabled={!files.some(f => f.status === FileStatus.FIXED) || isDownloading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                  {isDownloading ? '打包中...' : '打包下载'}
                </button>
              </div>
            </div>

            <div className="space-y-4">
              {files.map((file) => (
                <div key={file.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 min-w-0">
                      <div className={`p-2 rounded-lg ${file.status === FileStatus.FIXED ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <FileMusic className="w-5 h-5" />
                      </div>
                      <div className="truncate">
                        <h4 className="font-bold text-slate-800 truncate">{file.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          {file.status === FileStatus.FIXED ? (
                            <span className="text-[10px] font-bold uppercase tracking-wider bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-md flex items-center gap-1">
                              <ShieldCheck className="w-3 h-3" /> {file.detectedEncoding}
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 uppercase tracking-widest">等待修复</span>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <div className="relative group">
                        <select 
                          onChange={(e) => handleManualEncoding(file.id, e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-[11px] py-1.5 pl-3 pr-8 rounded-lg cursor-pointer hover:bg-slate-100 outline-none"
                          value={file.status === FileStatus.FIXED ? file.detectedEncoding : 'auto'}
                        >
                          {SUPPORTED_ENCODINGS.map(enc => (
                            <option key={enc.value} value={enc.value}>{enc.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      
                      {file.status === FileStatus.FIXED ? (
                        <button onClick={() => downloadFile(file.fixedContent, file.name)} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors">
                          <Download className="w-5 h-5" />
                        </button>
                      ) : (
                        <button onClick={() => fixFile(file.id)} disabled={file.status === FileStatus.PROCESSING} className="px-4 py-2 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-sm font-bold transition-colors disabled:opacity-50">
                          {file.status === FileStatus.PROCESSING ? '处理中' : '修复'}
                        </button>
                      )}
                      <button onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                  
                  {file.status === FileStatus.FIXED && (
                    <div className="px-4 pb-4">
                      <div className="bg-slate-900 rounded-xl p-3 text-[11px] font-mono text-slate-300 overflow-hidden relative group">
                        <div className="absolute top-2 right-3 text-[9px] uppercase tracking-widest text-slate-500 font-sans">内容预览</div>
                        <div className="whitespace-pre-wrap line-clamp-2">
                          {file.fixedContent.substring(0, 200)}
                        </div>
                        {isLikelyGarbled(file.fixedContent) && (
                          <div className="mt-2 flex items-center gap-1.5 text-amber-400 text-[10px]">
                            <AlertCircle className="w-3 h-3" />
                            <span>自动识别可能不准确，请尝试手动切换编码。</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {files.length === 0 && (
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
                <Zap className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">本地修复</h4>
              <p className="text-xs text-slate-500 leading-relaxed">无需联网，利用浏览器 TextDecoder API 实现极速编码转换。</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-amber-50 rounded-xl flex items-center justify-center mb-4 text-amber-600">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">UTF-8 BOM</h4>
              <p className="text-xs text-slate-500 leading-relaxed">自动添加字节顺序标记（BOM），确保 Foobar2000 完美识别。</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">批量打包</h4>
              <p className="text-xs text-slate-500 leading-relaxed">一键生成 ZIP 压缩包，解决浏览器单次下载文件过多的限制。</p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 text-slate-400 text-[10px] tracking-widest uppercase">
        <p>© 2024 CUE Master • 纯前端离线版</p>
      </footer>
    </div>
  );
};

export default App;
