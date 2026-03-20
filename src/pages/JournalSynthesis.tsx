import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  BookOpen, 
  Sparkles, 
  Loader2, 
  FileText, 
  ChevronRight, 
  AlertCircle,
  Copy,
  Check
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { analyzeJournal } from '../services/geminiService';
import ReactMarkdown from 'react-markdown';

export default function JournalSynthesis() {
  const [journalText, setJournalText] = useState('');
  const [result, setResult] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [isCopied, setIsCopied] = useState(false);

  const handleAnalyze = async () => {
    if (!journalText.trim()) {
      setError('Mohon masukkan teks jurnal terlebih dahulu.');
      return;
    }

    setIsLoading(true);
    setError('');
    setResult('');

    try {
      const synthesis = await analyzeJournal(journalText);
      setResult(synthesis);
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan saat menganalisis jurnal.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCopy = () => {
    navigator.clipboard.writeText(result);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#FDFCFB] text-[#1A1A1A] font-sans selection:bg-emerald-100">
      {/* Header */}
      <header className="max-w-5xl mx-auto px-6 pt-12 pb-8 border-b border-black/5">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-10 h-10 bg-emerald-600 rounded-full flex items-center justify-center text-white">
            <BookOpen className="w-5 h-5" />
          </div>
          <span className="text-sm font-semibold tracking-widest uppercase opacity-50">RMC Synthesis Tool</span>
        </div>
        <h1 className="text-5xl md:text-6xl font-serif italic font-light tracking-tight mb-4">
          Hasil Analisis Jurnal
        </h1>
        <p className="text-xl text-black/60 max-w-2xl leading-relaxed">
          Sintesis dan evaluasi kritis berdasarkan Research Model Canvas (RMC). 
          Dapatkan narasi terstruktur yang mudah dipahami tanpa batasan tabel yang kaku.
        </p>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Input Section */}
          <div className="lg:col-span-5 space-y-6">
            <div className="bg-white border border-black/5 rounded-3xl p-8 shadow-sm">
              <div className="flex items-center gap-2 mb-6">
                <FileText className="w-5 h-5 text-emerald-600" />
                <h2 className="text-lg font-semibold">Teks Jurnal</h2>
              </div>
              
              <textarea
                value={journalText}
                onChange={(e) => setJournalText(e.target.value)}
                placeholder="Tempelkan teks jurnal atau abstrak di sini..."
                className="w-full h-80 bg-[#F9F9F9] border-none rounded-2xl p-6 text-sm focus:ring-2 focus:ring-emerald-500/20 transition-all resize-none placeholder:opacity-30"
              />

              {error && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-4 p-4 bg-red-50 text-red-600 rounded-xl flex items-center gap-2 text-sm"
                >
                  <AlertCircle className="w-4 h-4" />
                  {error}
                </motion.div>
              )}

              <Button 
                onClick={handleAnalyze}
                isLoading={isLoading}
                className="w-full mt-6 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl h-14 text-base font-semibold group"
              >
                {!isLoading && (
                  <>
                    Analisis Jurnal
                    <ChevronRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                  </>
                )}
                {isLoading && "Menganalisis..."}
              </Button>
            </div>

            <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100">
              <h3 className="text-emerald-900 font-semibold mb-2 flex items-center gap-2">
                <Sparkles className="w-4 h-4" />
                Tips Analisis
              </h3>
              <p className="text-sm text-emerald-800/70 leading-relaxed">
                Pastikan teks yang dimasukkan mencakup bagian pendahuluan, metodologi, dan hasil penelitian untuk mendapatkan sintesis RMC yang paling akurat.
              </p>
            </div>
          </div>

          {/* Result Section */}
          <div className="lg:col-span-7">
            <AnimatePresence mode="wait">
              {isLoading ? (
                <motion.div 
                  key="loading"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center space-y-4 bg-white rounded-3xl border border-black/5"
                >
                  <Loader2 className="w-12 h-12 text-emerald-600 animate-spin" />
                  <div>
                    <p className="font-semibold text-lg">Sedang Menyusun Sintesis</p>
                    <p className="text-black/40 text-sm">Gemini sedang mengevaluasi Research Model Canvas...</p>
                  </div>
                </motion.div>
              ) : result ? (
                <motion.div 
                  key="result"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="bg-white rounded-3xl border border-black/5 p-10 shadow-sm relative"
                >
                  <div className="absolute top-6 right-6 flex gap-2">
                    <button 
                      onClick={handleCopy}
                      className="p-2 hover:bg-emerald-50 rounded-lg transition-colors text-emerald-600"
                      title="Salin Hasil"
                    >
                      {isCopied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    </button>
                  </div>

                  <div className="prose prose-emerald max-w-none prose-p:leading-relaxed prose-p:text-black/80 prose-headings:font-serif prose-headings:italic prose-headings:font-light">
                    <ReactMarkdown>{result}</ReactMarkdown>
                  </div>
                </motion.div>
              ) : (
                <motion.div 
                  key="empty"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="h-full min-h-[400px] flex flex-col items-center justify-center text-center space-y-4 bg-[#F9F9F9] rounded-3xl border border-dashed border-black/10"
                >
                  <div className="w-16 h-16 bg-black/5 rounded-full flex items-center justify-center text-black/20">
                    <Sparkles className="w-8 h-8" />
                  </div>
                  <div>
                    <p className="font-semibold text-black/40">Hasil Sintesis Akan Muncul di Sini</p>
                    <p className="text-black/20 text-sm">Masukkan teks jurnal di sebelah kiri untuk memulai.</p>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </main>

      <footer className="max-w-5xl mx-auto px-6 py-12 border-t border-black/5 text-center text-black/30 text-sm">
        &copy; 2026 JurnalSintesis RMC &bull; Powered by Gemini 3.1 Pro
      </footer>
    </div>
  );
}
