
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
  CheckCircle2,
  Languages,
  FolderOpen
} from 'lucide-react';
import JSZip from 'jszip';
import { CueFile, FileStatus, SUPPORTED_ENCODINGS } from './types';
import { decodeBuffer, isLikelyGarbled, downloadFile, autoDetectEncoding, t2s } from './utils/encodingUtils';

const App: React.FC = () => {
  const [files, setFiles] = useState<CueFile[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [shouldConvertToSimplified, setShouldConvertToSimplified] = useState(true);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recursively scan entries from DataTransferItem
  const scanEntry = async (entry: any, path: string = ""): Promise<{ file: File, path: string }[]> => {
    if (entry.isFile) {
      if (entry.name.toLowerCase().endsWith('.cue')) {
        const file = await new Promise<File>((resolve) => entry.file(resolve));
        return [{ file, path: path + entry.name }];
      }
      return [];
    } else if (entry.isDirectory) {
      const reader = entry.createReader();
      const entries = await new Promise<any[]>((resolve) => {
        const allEntries: any[] = [];
        const readBatch = () => {
          reader.readEntries((batch: any[]) => {
            if (batch.length === 0) {
              resolve(allEntries);
            } else {
              allEntries.push(...batch);
              readBatch();
            }
          });
        };
        readBatch();
      });
      const results = await Promise.all(entries.map(e => scanEntry(e, path + entry.name + "/")));
      return results.flat();
    }
    return [];
  };

  const processFileEntries = async (entries: { file: File, path: string }[]) => {
    const newFiles: CueFile[] = await Promise.all(
      entries.map(async ({ file, path }) => {
        const arrayBuffer = await file.arrayBuffer();
        const initialText = decodeBuffer(arrayBuffer, 'utf-8');
        const looksGarbled = isLikelyGarbled(initialText);

        return {
          id: Math.random().toString(36).substring(2, 11),
          name: file.name,
          path: path,
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
    const entries = selectedFiles.map(f => ({ file: f, path: f.name }));
    await processFileEntries(entries);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    const items = Array.from(e.dataTransfer.items);
    // Fix: Explicitly cast to any to resolve "webkitGetAsEntry does not exist on type unknown"
    const entryPromises = items
      .map(item => (item as any).webkitGetAsEntry())
      .filter(entry => entry !== null)
      .map(entry => scanEntry(entry));
    
    const allFileInfos = (await Promise.all(entryPromises)).flat();
    if (allFileInfos.length > 0) {
      await processFileEntries(allFileInfos);
    }
  };

  const fixFile = async (fileId: string, manualEncoding?: string, forceConversion?: boolean) => {
    setFiles(prev => prev.map(f => f.id === fileId ? { ...f, status: FileStatus.PROCESSING } : f));
    
    const file = files.find(f => f.id === fileId);
    if (!file) return;

    await new Promise(r => setTimeout(r, 50)); 

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

      let finalText = result.text;
      const doConvert = forceConversion !== undefined ? forceConversion : shouldConvertToSimplified;
      if (doConvert) {
        finalText = t2s(finalText);
      }

      setFiles(prev => prev.map(f => f.id === fileId ? { 
        ...f, 
        fixedContent: finalText, 
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
        // Use the stored relative path to maintain folder structure
        zip.file(file.path, contentWithBom);
      });

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `CUE_Fixed_Structure_${new Date().toISOString().slice(0,10)}.zip`;
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
          极速本地修复。支持<b>拖入多个文件夹</b>，保留原目录结构并自动转为简体中文。
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
          onDrop={handleDrop}
        >
          <input type="file" multiple accept=".cue" className="hidden" ref={fileInputRef} onChange={onFilesSelected} />
          <div className="flex flex-col items-center text-center">
            <FolderOpen className={`w-10 h-10 mb-3 ${isDragging ? 'text-indigo-600' : 'text-slate-400'}`} />
            <h3 className="text-lg font-semibold text-slate-700">拖入 CUE 文件或整个文件夹</h3>
            <p className="text-sm text-slate-400 font-medium">自动保持文件夹层级，批量打包无限制</p>
          </div>
        </section>

        {files.length > 0 && (
          <>
            <div className="flex flex-wrap gap-4 justify-between items-center bg-white p-4 rounded-2xl shadow-sm border border-slate-100">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-slate-500">{files.length} 个 CUE 文件</span>
                <div className="h-6 w-px bg-slate-200"></div>
                <label className="flex items-center cursor-pointer group">
                  <div className="relative">
                    <input 
                      type="checkbox" 
                      className="hidden" 
                      checked={shouldConvertToSimplified} 
                      onChange={(e) => setShouldConvertToSimplified(e.target.checked)} 
                    />
                    <div className={`w-10 h-5 rounded-full shadow-inner transition-colors ${shouldConvertToSimplified ? 'bg-indigo-600' : 'bg-slate-300'}`}></div>
                    <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transform transition-transform ${shouldConvertToSimplified ? 'translate-x-5' : 'translate-x-0'}`}></div>
                  </div>
                  <div className="ml-2 text-xs font-semibold text-slate-600 group-hover:text-indigo-600 transition-colors flex items-center gap-1">
                    <Languages className="w-3.5 h-3.5" />
                    自动转简体
                  </div>
                </label>
              </div>

              <div className="flex gap-2">
                <button onClick={() => setFiles([])} className="text-sm text-slate-400 hover:text-red-500 px-3 py-2 transition-colors">清空列表</button>
                <button 
                  onClick={fixAll}
                  disabled={isProcessing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-indigo-100 disabled:opacity-50"
                >
                  {isProcessing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  全部修复
                </button>
                <button 
                  onClick={downloadAll}
                  disabled={!files.some(f => f.status === FileStatus.FIXED) || isDownloading}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white px-5 py-2 rounded-xl font-bold flex items-center gap-2 shadow-lg shadow-emerald-100 disabled:opacity-50"
                >
                  {isDownloading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Archive className="w-4 h-4" />}
                  {isDownloading ? '打包中...' : '下载结构化 ZIP'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {files.map((file) => (
                <div key={file.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm hover:border-indigo-200 transition-colors">
                  <div className="p-4 flex items-center justify-between gap-4">
                    <div className="flex items-center space-x-3 min-w-0 flex-1">
                      <div className={`p-2 rounded-lg shrink-0 ${file.status === FileStatus.FIXED ? 'bg-emerald-50 text-emerald-600' : 'bg-slate-100 text-slate-400'}`}>
                        <FileMusic className="w-5 h-5" />
                      </div>
                      <div className="truncate flex-1">
                        <h4 className="font-bold text-slate-800 truncate" title={file.path}>{file.name}</h4>
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-[9px] text-slate-400 font-mono truncate max-w-[200px] bg-slate-50 px-1 rounded" title={file.path}>
                            {file.path.split('/').slice(0, -1).join('/') || './'}
                          </span>
                          {file.status === FileStatus.FIXED && (
                            <div className="flex gap-1.5 shrink-0">
                              <span className="text-[9px] font-bold uppercase bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded flex items-center gap-1">
                                <ShieldCheck className="w-2.5 h-2.5" /> {file.detectedEncoding}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      <div className="relative group">
                        <select 
                          onChange={(e) => handleManualEncoding(file.id, e.target.value)}
                          className="appearance-none bg-slate-50 border border-slate-200 text-slate-600 text-[10px] py-1 pl-2 pr-6 rounded-lg cursor-pointer hover:bg-slate-100 outline-none"
                          value={file.status === FileStatus.FIXED ? file.detectedEncoding : 'auto'}
                        >
                          {SUPPORTED_ENCODINGS.map(enc => (
                            <option key={enc.value} value={enc.value}>{enc.label}</option>
                          ))}
                        </select>
                        <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                      </div>
                      
                      {file.status === FileStatus.FIXED ? (
                        <button onClick={() => downloadFile(file.fixedContent, file.name)} className="p-2 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 rounded-lg transition-colors">
                          <Download className="w-5 h-5" />
                        </button>
                      ) : (
                        <button onClick={() => fixFile(file.id)} disabled={file.status === FileStatus.PROCESSING} className="px-3 py-1.5 bg-indigo-50 text-indigo-600 hover:bg-indigo-100 rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                          {file.status === FileStatus.PROCESSING ? '处理中' : '修复'}
                        </button>
                      )}
                      <button onClick={() => setFiles(prev => prev.filter(f => f.id !== file.id))} className="p-2 text-slate-300 hover:text-red-500 transition-colors">
                        <Trash2 className="w-5 h-5" />
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

        {files.length === 0 && (
          <div className="grid md:grid-cols-3 gap-6 mt-6">
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-transform hover:-translate-y-1">
              <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center mb-4 text-blue-600">
                <FolderOpen className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">目录结构保留</h4>
              <p className="text-xs text-slate-500 leading-relaxed">直接拖入整个文件夹。下载时会自动还原原有的多级文件夹结构，方便音乐管理。</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-transform hover:-translate-y-1">
              <div className="w-10 h-10 bg-indigo-50 rounded-xl flex items-center justify-center mb-4 text-indigo-600">
                <Languages className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">繁简转换</h4>
              <p className="text-xs text-slate-500 leading-relaxed">修复乱码的同时，可自动将港台繁体歌名转换为简体，适配播放器显示。</p>
            </div>
            <div className="bg-white p-6 rounded-3xl border border-slate-100 shadow-sm transition-transform hover:-translate-y-1">
              <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center mb-4 text-emerald-600">
                <Archive className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-slate-800 mb-2">打包下载</h4>
              <p className="text-xs text-slate-500 leading-relaxed">不再受限于浏览器单次下载限制。所有修复文件打包为一个 ZIP，一次性快速获取。</p>
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto py-8 text-slate-400 text-[10px] tracking-widest uppercase flex items-center gap-2">
        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
        <p>目录保持 • 纯前端处理 • 批量下载</p>
        <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
      </footer>
    </div>
  );
};

export default App;
