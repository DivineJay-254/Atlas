import React, { useState, useEffect } from 'react';
import { Code, Download, Copy, Check, X, FileText, Terminal, Layers } from 'lucide-react';
import JSZip from 'jszip';

interface CodebaseModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CodebaseModal: React.FC<CodebaseModalProps> = ({ isOpen, onClose }) => {
  const [files, setFiles] = useState<Record<string, string>>({});
  const [selectedFile, setSelectedFile] = useState<string>('atlas_core.py');
  const [copied, setCopied] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetch('/api/codebase')
        .then(res => res.json())
        .then(data => {
          setFiles(data);
          if (data['atlas_core.py']) {
            setSelectedFile('atlas_core.py');
          }
        })
        .catch(err => {
          console.warn('Failed to load codebase:', err);
        });
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const currentContent = files[selectedFile] || '# Loading codebase...';

  const handleCopy = () => {
    navigator.clipboard.writeText(currentContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownloadZip = async () => {
    setIsDownloading(true);
    try {
      const zip = new JSZip();
      Object.entries(files).forEach(([name, content]) => {
        zip.file(name, content);
      });
      // Include sample .env file
      zip.file(
        '.env',
        '# Atlas Environment Configuration\nGEMINI_API_KEY=\nATLAS_MODEL=gemini-3.8-flash\nELEVENLABS_API_KEY=\nELEVENLABS_VOICE_ID=pNInz6obpgDQGcFmaJgB\nOPENWEATHER_API_KEY=\n'
      );

      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Atlas_Windows_AI_Assistant.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('ZIP generation error:', err);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fade-in">
      <div className="w-full max-w-5xl bg-slate-950 border border-cyan-500/30 rounded-2xl shadow-2xl overflow-hidden flex flex-col h-[700px]">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-cyan-500/20">
          <div className="flex items-center space-x-3">
            <Layers className="w-5 h-5 text-cyan-400" />
            <div>
              <h2 className="font-cyber text-lg font-bold text-slate-100 tracking-wide">
                ATLAS PYTHON DESKTOP ENGINE (WINDOWS CODEBASE)
              </h2>
              <p className="font-mono text-xs text-slate-400">
                Official Google GenAI Python SDK Architecture with SAPI5 Audio & Security Blocklists
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button
              onClick={handleDownloadZip}
              disabled={isDownloading}
              className="px-3.5 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-mono text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition-colors cursor-pointer disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span>{isDownloading ? 'Packaging...' : 'Download .ZIP (Windows)'}</span>
            </button>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-red-400 transition-colors p-1"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 flex overflow-hidden">
          {/* File Explorer Sidebar */}
          <div className="w-60 bg-slate-950/80 border-r border-cyan-500/20 p-3 flex flex-col justify-between">
            <div>
              <span className="font-mono text-[10px] uppercase tracking-wider text-slate-400 block px-2 mb-2 font-semibold">
                Architecture Files
              </span>
              <div className="space-y-1">
                {Object.keys(files).map((fileName) => (
                  <button
                    key={fileName}
                    onClick={() => setSelectedFile(fileName)}
                    className={`w-full text-left px-3 py-2 rounded-lg font-mono text-xs flex items-center space-x-2 transition-all cursor-pointer ${
                      selectedFile === fileName
                        ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-semibold'
                        : 'text-slate-400 hover:bg-slate-900 hover:text-slate-200'
                    }`}
                  >
                    {fileName.endsWith('.py') && <Code className="w-3.5 h-3.5 text-cyan-400" />}
                    {fileName.endsWith('.bat') && <Terminal className="w-3.5 h-3.5 text-amber-400" />}
                    {fileName.endsWith('.txt') && <FileText className="w-3.5 h-3.5 text-emerald-400" />}
                    {fileName.endsWith('.md') && <FileText className="w-3.5 h-3.5 text-blue-400" />}
                    <span className="truncate">{fileName}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Batch Launcher Tip */}
            <div className="bg-slate-900/60 p-2.5 rounded-lg border border-slate-800 text-[11px] font-mono text-slate-400">
              <span className="text-cyan-400 font-semibold block mb-1">1-Click Launch:</span>
              Run <code className="text-slate-200">run_atlas.bat</code> on Windows 10/11 to start automated venv setup.
            </div>
          </div>

          {/* Code Viewer Panel */}
          <div className="flex-1 flex flex-col bg-black/90 overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-slate-900/40 border-b border-slate-800 text-xs font-mono">
              <span className="text-slate-300 font-semibold">{selectedFile}</span>
              <button
                onClick={handleCopy}
                className="flex items-center space-x-1 text-slate-400 hover:text-cyan-300 transition-colors p-1 rounded hover:bg-slate-800 cursor-pointer"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied!' : 'Copy Code'}</span>
              </button>
            </div>
            <pre className="flex-1 p-4 overflow-auto font-mono text-xs text-slate-300 leading-relaxed">
              <code>{currentContent}</code>
            </pre>
          </div>
        </div>
      </div>
    </div>
  );
};
