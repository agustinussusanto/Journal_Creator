import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { BookOpen, Search, LogOut, User, FileText, AlertCircle, Book } from 'lucide-react';
import { Button } from '../components/ui/Button';

export default function EbookMaker() {
  const navigate = useNavigate();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    const session = localStorage.getItem('user_session');
    if (!session) {
      navigate('/login');
    } else {
      setUserEmail(session);
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem('user_session');
    navigate('/login');
  };

  if (!userEmail) return null;

  return (
    <div className="min-h-screen bg-[#f8fafc] font-sans pb-20">
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
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
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
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl transition-colors"
                >
                  Ebook Maker
                </button>
              </nav>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <Book className="w-4 h-4" />
                Ebook Maker
              </div>
              <Button variant="ghost" onClick={handleLogout} className="text-slate-600 hover:text-slate-900">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl p-10 shadow-xl shadow-slate-200/50 border border-slate-200"
        >
          <h1 className="text-3xl font-bold text-slate-900 mb-6">Ebook Maker</h1>
          <p className="text-slate-600 mb-8 leading-relaxed">
            Selamat datang di Ebook Maker. Halaman ini dirancang untuk membantu Anda menyusun draf ebook akademik yang lengkap.
          </p>

          <div className="bg-indigo-50 border border-indigo-100 rounded-2xl p-6 mb-8">
            <h3 className="font-semibold text-indigo-900 mb-3 flex items-center gap-2">
              <AlertCircle className="w-5 h-5" />
              Instruksi Penggunaan
            </h3>
            <ul className="text-sm text-indigo-800 space-y-2 list-disc list-inside">
              <li>Gunakan hasil analisis dari <strong>AI Journal Analyst</strong> sebagai referensi.</li>
              <li>Pastikan setiap bagian ebook disusun secara sistematis sesuai standar akademik.</li>
            </ul>
            
            <div className="mt-6 flex justify-center">
              <a 
                href="https://ebook-architect-092bae5b.base44.app" 
                target="_blank" 
                rel="noopener noreferrer"
                className="inline-flex items-center gap-3 px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-lg shadow-indigo-200 transition-all hover:scale-105"
              >
                <Book className="w-6 h-6" />
                Buka Ebook Architect
              </a>
            </div>
          </div>
        </motion.div>
      </main>
    </div>
  );
}
