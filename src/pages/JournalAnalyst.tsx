import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  ArrowLeft, UploadCloud, Sparkles, FileText, BookOpen, 
  Target, FlaskConical, AlertCircle, CheckCircle2, 
  Download, Copy, Loader2, Search, BookMarked, Layers
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface AnalysisResult {
  title: string;
  authors: string;
  year: string;
  journalName: string;
  abstract: string;
  problemStatement: string;
  methodology: {
    type: string;
    sample: string;
    dataAnalysis: string;
  };
  keyFindings: string[];
  limitations: string[];
  researchGap: string;
  novelty: string;
  recommendations: string[];
  criticalReview: {
    strengths: string[];
    weaknesses: string[];
  };
  background: string;
  purpose: string;
  theory: string;
  independentVariable: string;
  dependentVariable: string;
  results: string;
  professorAnalysis: string;
}

export default function JournalAnalyst() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [inputText, setInputText] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState<'overview' | 'methodology' | 'findings' | 'gap'>('overview');

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (!session) {
      navigate('/login');
    } else {
      setUserEmail(session);
    }
  }, [navigate]);

  if (!userEmail) return null;

  const handleAnalyze = async (textToAnalyze: string) => {
    if (!textToAnalyze.trim()) {
      setError('Mohon masukkan teks jurnal atau upload file PDF.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setResult(null);

    try {
      const prompt = `
        Analisis jurnal ilmiah yang saya berikan dan sajikan hasilnya dalam format terstruktur akademik dengan bahasa formal, jelas, dan tidak bertele-tele.
        
        WAJIB:
        Gunakan hanya informasi yang benar-benar ada dalam jurnal
        DILARANG membuat asumsi atau menambahkan informasi yang tidak tersedia (anti halusinasi)
        Jika informasi tidak ditemukan, tulis: “tidak disebutkan”
        Gunakan bahasa Indonesia formal akademik
        Ringkas tetapi tetap substantif dan mendalam

        Teks Jurnal:
        ${textToAnalyze}

        Berikan output dalam format JSON VALID dengan struktur berikut:
        {
          "title": "Judul Lengkap",
          "authors": "Nama Penulis",
          "year": "Tahun Terbit",
          "journalName": "Nama Jurnal",
          "abstract": "Ringkasan Abstrak",
          "problemStatement": "Rumusan Masalah Utama",
          "methodology": {
            "type": "Jenis Penelitian (Kualitatif/Kuantitatif/Mixed Method)",
            "sample": "Populasi dan Sampel",
            "dataAnalysis": "Teknik Analisis Data"
          },
          "keyFindings": ["Temuan 1", "Temuan 2", "..."],
          "limitations": ["Keterbatasan 1", "Keterbatasan 2", "... (jika tidak disebutkan, tulis: tidak disebutkan)"],
          "researchGap": "Identifikasi gap penelitian: theoretical gap / empirical gap / practical gap / contextual gap, jelaskan secara singkat",
          "novelty": "Nilai Kebaruan Penelitian",
          "recommendations": ["Rekomendasi 1", "Rekomendasi 2", "..."],
          "criticalReview": {
            "strengths": ["Kelebihan 1", "Kelebihan 2"],
            "weaknesses": ["Kekurangan 1", "Kekurangan 2"]
          },
          "background": "Latar Belakang",
          "purpose": "Tujuan Penelitian",
          "theory": "Teori yang digunakan",
          "independentVariable": "Variabel Independen (X) [X1, X2, dst jika ada, jika tidak tulis: tidak disebutkan]",
          "dependentVariable": "Variabel Dependen (Y) [Y, jika tidak ada tulis: tidak disebutkan]",
          "results": "Hasil Penelitian",
          "professorAnalysis": "Analisis mendalam dari sudut pandang profesor, dengan mengaitkan hubungan antara Variabel Independen (X) dan Variabel Dependen (Y) yang telah diidentifikasi."
        }
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              authors: { type: Type.STRING },
              year: { type: Type.STRING },
              journalName: { type: Type.STRING },
              abstract: { type: Type.STRING },
              problemStatement: { type: Type.STRING },
              methodology: {
                type: Type.OBJECT,
                properties: {
                  type: { type: Type.STRING },
                  sample: { type: Type.STRING },
                  dataAnalysis: { type: Type.STRING }
                },
                required: ['type', 'sample', 'dataAnalysis']
              },
              keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
              limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
              researchGap: { type: Type.STRING },
              novelty: { type: Type.STRING },
              recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
              criticalReview: {
                type: Type.OBJECT,
                properties: {
                  strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                  weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
                },
                required: ['strengths', 'weaknesses']
              },
              background: { type: Type.STRING },
              purpose: { type: Type.STRING },
              theory: { type: Type.STRING },
              independentVariable: { type: Type.STRING },
              dependentVariable: { type: Type.STRING },
              results: { type: Type.STRING },
              professorAnalysis: { type: Type.STRING }
            },
            required: [
              'title', 'authors', 'year', 'journalName', 'abstract', 
              'problemStatement', 'methodology', 'keyFindings', 
              'limitations', 'researchGap', 'novelty', 'recommendations', 
              'criticalReview', 'background', 'purpose', 'theory', 
              'independentVariable', 'dependentVariable', 'results', 'professorAnalysis'
            ]
          }
        }
      });

      const jsonStr = response.text?.trim() || '{}';
      const parsed = JSON.parse(jsonStr) as AnalysisResult;
      setResult(parsed);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError('Gagal menganalisis jurnal. Pastikan teks yang dimasukkan valid.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Mohon upload file PDF.');
      return;
    }

    setIsAnalyzing(true);
    setError('');
    setResult(null);

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];
          
          const prompt = `
            Analisis jurnal ilmiah yang saya berikan dan sajikan hasilnya dalam format terstruktur akademik dengan bahasa formal, jelas, dan tidak bertele-tele.
            
            WAJIB:
            Gunakan hanya informasi yang benar-benar ada dalam jurnal
            DILARANG membuat asumsi atau menambahkan informasi yang tidak tersedia (anti halusinasi)
            Jika informasi tidak ditemukan, tulis: “tidak disebutkan”
            Gunakan bahasa Indonesia formal akademik
            Ringkas tetapi tetap substantif dan mendalam

            Berikan output dalam format JSON VALID dengan struktur berikut:
            {
              "title": "Judul Lengkap",
              "authors": "Nama Penulis",
              "year": "Tahun Terbit",
              "journalName": "Nama Jurnal",
              "abstract": "Ringkasan Abstrak",
              "problemStatement": "Rumusan Masalah Utama",
              "methodology": {
                "type": "Jenis Penelitian (Kualitatif/Kuantitatif/Mixed Method)",
                "sample": "Populasi dan Sampel",
                "dataAnalysis": "Teknik Analisis Data"
              },
              "keyFindings": ["Temuan 1", "Temuan 2", "..."],
              "limitations": ["Keterbatasan 1", "Keterbatasan 2", "... (jika tidak disebutkan, tulis: tidak disebutkan)"],
              "researchGap": "Identifikasi gap penelitian: theoretical gap / empirical gap / practical gap / contextual gap, jelaskan secara singkat",
              "novelty": "Nilai Kebaruan Penelitian",
              "recommendations": ["Rekomendasi 1", "Rekomendasi 2", "..."],
              "criticalReview": {
                "strengths": ["Kelebihan 1", "Kelebihan 2"],
                "weaknesses": ["Kekurangan 1", "Kekurangan 2"]
              },
              "background": "Latar Belakang",
              "purpose": "Tujuan Penelitian",
              "theory": "Teori yang digunakan",
              "independentVariable": "Variabel Independen (X) [X1, X2, dst jika ada, jika tidak tulis: tidak disebutkan]",
              "dependentVariable": "Variabel Dependen (Y) [Y, jika tidak ada tulis: tidak disebutkan]",
              "results": "Hasil Penelitian",
              "professorAnalysis": "Analisis mendalam dari sudut pandang profesor, dengan mengaitkan hubungan antara Variabel Independen (X) dan Variabel Dependen (Y) yang telah diidentifikasi."
            }
          `;

          const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: {
              parts: [
                { inlineData: { data: base64Data, mimeType: 'application/pdf' } },
                { text: prompt }
              ]
            },
            config: {
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  title: { type: Type.STRING },
                  authors: { type: Type.STRING },
                  year: { type: Type.STRING },
                  journalName: { type: Type.STRING },
                  abstract: { type: Type.STRING },
                  problemStatement: { type: Type.STRING },
                  methodology: {
                    type: Type.OBJECT,
                    properties: {
                      type: { type: Type.STRING },
                      sample: { type: Type.STRING },
                      dataAnalysis: { type: Type.STRING }
                    },
                    required: ['type', 'sample', 'dataAnalysis']
                  },
                  keyFindings: { type: Type.ARRAY, items: { type: Type.STRING } },
                  limitations: { type: Type.ARRAY, items: { type: Type.STRING } },
                  researchGap: { type: Type.STRING },
                  novelty: { type: Type.STRING },
                  recommendations: { type: Type.ARRAY, items: { type: Type.STRING } },
                  criticalReview: {
                    type: Type.OBJECT,
                    properties: {
                      strengths: { type: Type.ARRAY, items: { type: Type.STRING } },
                      weaknesses: { type: Type.ARRAY, items: { type: Type.STRING } }
                    },
                    required: ['strengths', 'weaknesses']
                  },
                  background: { type: Type.STRING },
                  purpose: { type: Type.STRING },
                  theory: { type: Type.STRING },
                  independentVariable: { type: Type.STRING },
                  dependentVariable: { type: Type.STRING },
                  results: { type: Type.STRING },
                  professorAnalysis: { type: Type.STRING }
                },
                required: [
                  'title', 'authors', 'year', 'journalName', 'abstract', 
                  'problemStatement', 'methodology', 'keyFindings', 
                  'limitations', 'researchGap', 'novelty', 'recommendations', 
                  'criticalReview', 'background', 'purpose', 'theory', 
                  'independentVariable', 'dependentVariable', 'results', 'professorAnalysis'
                ]
              }
            }
          });

          const jsonStr = response.text?.trim() || '{}';
          const parsed = JSON.parse(jsonStr) as AnalysisResult;
          setResult(parsed);
        } catch (err: any) {
          console.error(err);
          setError('Gagal memproses PDF. Silakan coba lagi.');
        } finally {
          setIsAnalyzing(false);
          e.target.value = '';
        }
      };
    } catch (err: any) {
      console.error(err);
      setError('Terjadi kesalahan sistem.');
      setIsAnalyzing(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-3 cursor-pointer" onClick={() => navigate('/dashboard')}>
                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center shadow-sm">
                  <BookOpen className="w-4 h-4" />
                </div>
                <span className="text-xl font-semibold tracking-tight text-slate-900">Research Builder</span>
              </div>
              
              <nav className="hidden md:flex items-center gap-1">
                <button 
                  onClick={() => navigate('/dashboard')}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Title Builder
                </button>
                <button 
                  onClick={() => navigate('/journal-analyst')}
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl transition-colors"
                >
                  AI Journal Analyst
                </button>
                <button 
                  onClick={() => navigate('/journal-maker')}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Journal Maker
                </button>
                <button 
                  onClick={() => navigate('/ebook-maker')}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Ebook Maker
                </button>
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <Search className="w-4 h-4" />
                AI Analyst
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        {!result ? (
          <div className="max-w-3xl mx-auto">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-slate-900 mb-4">Analisis Jurnal Secara Instan</h2>
              <p className="text-slate-600">
                Dapatkan ringkasan terstruktur, temuan kunci, metodologi, dan research gap dari jurnal akademik hanya dalam hitungan detik.
              </p>
            </div>

            <div className="bg-white rounded-3xl shadow-xl shadow-slate-200/50 border border-slate-200 overflow-hidden">
              <div className="p-8">
                <div className="mb-6">
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Paste Teks Jurnal</label>
                  <textarea 
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Tempelkan abstrak atau seluruh teks jurnal di sini..."
                    className="w-full h-64 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-all resize-none"
                  />
                </div>

                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <Button 
                    onClick={() => handleAnalyze(inputText)}
                    isLoading={isAnalyzing}
                    className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl py-6 text-lg font-semibold shadow-lg shadow-indigo-200"
                  >
                    <Sparkles className="w-5 h-5 mr-2" />
                    Mulai Analisis
                  </Button>
                  
                  <div className="relative w-full sm:w-auto">
                    <input 
                      type="file" 
                      accept="application/pdf"
                      onChange={handleFileUpload}
                      className="absolute inset-0 opacity-0 cursor-pointer"
                      id="pdf-upload"
                      disabled={isAnalyzing}
                    />
                    <label 
                      htmlFor="pdf-upload"
                      className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 bg-white border-2 border-dashed border-slate-300 hover:border-indigo-400 hover:bg-indigo-50 rounded-xl text-slate-600 font-medium transition-all cursor-pointer"
                    >
                      <UploadCloud className="w-5 h-5" />
                      Upload PDF
                    </label>
                  </div>
                </div>

                {error && (
                  <div className="mt-6 p-4 bg-red-50 border border-red-100 text-red-600 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    {error}
                  </div>
                )}
              </div>
              
              <div className="bg-slate-50 p-6 border-t border-slate-100">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="flex items-center gap-3 text-slate-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-medium">Terstruktur & Rapi</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-medium">Identifikasi Research Gap</span>
                  </div>
                  <div className="flex items-center gap-3 text-slate-500">
                    <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                    <span className="text-xs font-medium">Review Kritis Otomatis</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Result Header */}
            <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                <div className="flex-1">
                  <div className="flex items-center gap-2 text-indigo-600 font-semibold text-sm mb-2 uppercase tracking-wider">
                    <BookOpen className="w-4 h-4" />
                    {result.journalName} ({result.year})
                  </div>
                  <h2 className="text-2xl md:text-3xl font-bold text-slate-900 mb-4 leading-tight">
                    {result.title}
                  </h2>
                  <div className="flex items-center gap-4 text-slate-500 text-sm">
                    <div className="flex items-center gap-1.5">
                      <FileText className="w-4 h-4" />
                      {result.authors}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button variant="secondary" onClick={() => setResult(null)} className="rounded-xl">
                    Analisis Baru
                  </Button>
                  <Button className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl">
                    <Download className="w-4 h-4 mr-2" />
                    Export
                  </Button>
                </div>
              </div>
            </div>

            {/* Tabs Navigation */}
            <div className="flex items-center gap-1 bg-slate-200/50 p-1 rounded-2xl w-fit">
              {[
                { id: 'overview', label: 'Overview', icon: BookOpen },
                { id: 'methodology', label: 'Metodologi', icon: FlaskConical },
                { id: 'findings', label: 'Temuan', icon: Target },
                { id: 'gap', label: 'Research Gap', icon: AlertCircle },
              ].map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-medium transition-all ${
                    activeTab === tab.id 
                      ? 'bg-white text-indigo-600 shadow-sm' 
                      : 'text-slate-500 hover:text-slate-700 hover:bg-white/50'
                  }`}
                >
                  <tab.icon className="w-4 h-4" />
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab Content */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="lg:col-span-2 space-y-6">
                <AnimatePresence mode="wait">
                  {activeTab === 'overview' && (
                    <motion.div 
                      key="overview"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                    >
                      <h3 className="text-xl font-bold text-slate-900 mb-4">Abstrak & Masalah</h3>
                      <div className="space-y-6">
                        <div>
                          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Abstrak</h4>
                          <p className="text-slate-700 leading-relaxed">{result.abstract}</p>
                        </div>
                        <div className="p-6 bg-indigo-50 rounded-2xl border border-indigo-100">
                          <h4 className="text-xs font-bold text-indigo-400 uppercase tracking-widest mb-2">Rumusan Masalah</h4>
                          <p className="text-indigo-900 font-medium">{result.problemStatement}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'methodology' && (
                    <motion.div 
                      key="methodology"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                    >
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Desain Penelitian</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4">
                            <Layers className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1">Jenis Penelitian</h4>
                          <p className="text-sm text-slate-600">{result.methodology.type}</p>
                        </div>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4">
                            <Target className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1">Sampel</h4>
                          <p className="text-sm text-slate-600">{result.methodology.sample}</p>
                        </div>
                        <div className="p-5 bg-slate-50 rounded-2xl border border-slate-100">
                          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center shadow-sm mb-4">
                            <FlaskConical className="w-5 h-5 text-indigo-600" />
                          </div>
                          <h4 className="text-sm font-bold text-slate-900 mb-1">Analisis Data</h4>
                          <p className="text-sm text-slate-600">{result.methodology.dataAnalysis}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'findings' && (
                    <motion.div 
                      key="findings"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                    >
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Temuan Kunci</h3>
                      <div className="space-y-4">
                        {result.keyFindings.map((finding, idx) => (
                          <div key={idx} className="flex items-start gap-4 p-4 bg-emerald-50 rounded-2xl border border-emerald-100">
                            <div className="w-6 h-6 bg-emerald-500 text-white rounded-full flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                              {idx + 1}
                            </div>
                            <p className="text-emerald-900 font-medium">{finding}</p>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}

                  {activeTab === 'gap' && (
                    <motion.div 
                      key="gap"
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -10 }}
                      className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200"
                    >
                      <h3 className="text-xl font-bold text-slate-900 mb-6">Research Gap & Novelty</h3>
                      <div className="space-y-6">
                        <div className="p-6 bg-red-50 rounded-2xl border border-red-100">
                          <div className="flex items-center gap-2 mb-3">
                            <AlertCircle className="w-5 h-5 text-red-500" />
                            <h4 className="font-bold text-red-900">Research Gap</h4>
                          </div>
                          <p className="text-red-800 leading-relaxed">{result.researchGap}</p>
                        </div>
                        <div className="p-6 bg-amber-50 rounded-2xl border border-amber-100">
                          <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-5 h-5 text-amber-500" />
                            <h4 className="font-bold text-amber-900">Nilai Kebaruan (Novelty)</h4>
                          </div>
                          <p className="text-amber-800 leading-relaxed">{result.novelty}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Critical Review Section */}
                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Analisis Mendalam (Profesor)</h3>
                  <p className="text-slate-700 leading-relaxed">{result.professorAnalysis}</p>
                </div>

                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Detail Penelitian</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Latar Belakang</h4>
                      <p className="text-sm text-slate-600">{result.background}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Tujuan</h4>
                      <p className="text-sm text-slate-600">{result.purpose}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Teori</h4>
                      <p className="text-sm text-slate-600">{result.theory}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Variabel Independen (X)</h4>
                      <p className="text-sm text-slate-600">{result.independentVariable}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Variabel Dependen (Y)</h4>
                      <p className="text-sm text-slate-600">{result.dependentVariable}</p>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-2">Hasil</h4>
                      <p className="text-sm text-slate-600">{result.results}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-8 shadow-sm border border-slate-200">
                  <h3 className="text-xl font-bold text-slate-900 mb-6">Review Kritis</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                      <h4 className="text-xs font-bold text-emerald-500 uppercase tracking-widest mb-4">Kelebihan</h4>
                      <ul className="space-y-3">
                        {result.criticalReview.strengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-red-500 uppercase tracking-widest mb-4">Kekurangan</h4>
                      <ul className="space-y-3">
                        {result.criticalReview.weaknesses.map((w, i) => (
                          <li key={i} className="flex items-start gap-3 text-sm text-slate-600">
                            <AlertCircle className="w-4 h-4 text-red-500 shrink-0 mt-0.5" />
                            {w}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
                  <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <BookMarked className="w-4 h-4 text-indigo-600" />
                    Rekomendasi Lanjutan
                  </h3>
                  <div className="space-y-3">
                    {result.recommendations.map((rec, i) => (
                      <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600 leading-relaxed">
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-indigo-600 rounded-3xl p-6 shadow-lg shadow-indigo-200 text-white">
                  <h3 className="font-bold mb-2">Butuh Judul Penelitian?</h3>
                  <p className="text-indigo-100 text-xs mb-4 leading-relaxed">
                    Gunakan hasil analisis ini untuk merumuskan judul skripsi yang kuat di Research Builder.
                  </p>
                  <Button 
                    onClick={() => navigate('/dashboard')}
                    className="w-full bg-white text-indigo-600 hover:bg-indigo-50 rounded-xl text-xs font-bold py-2"
                  >
                    Buka Research Builder
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
