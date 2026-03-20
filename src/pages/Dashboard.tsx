import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  LogOut, User, Sparkles, Copy, CheckCircle2, BookOpen, 
  Database, Layers, Plus, X, Target, AlertCircle, 
  Lightbulb, FlaskConical, BookMarked, ShieldCheck, ChevronDown, ChevronUp, UploadCloud, Loader2, FileDown
} from 'lucide-react';
import { Button } from '../components/ui/Button';
import { GoogleGenAI, Type } from '@google/genai';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { jsPDF } from 'jspdf';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

interface JournalData {
  peneliti: string;
  judul: string;
  jenis_penelitian: string;
  latar_belakang: string;
  masalah: string;
  tujuan: string;
  teori: string;
  metode: string;
  variabel_independen: string;
  variabel_dependen: string;
  hasil: string;
  keterbatasan: string;
  research_gap: string;
}

interface Journal {
  id: string;
  data: JournalData;
  isExpanded: boolean;
}

const emptyJournalData = (): JournalData => ({
  peneliti: '', judul: '', jenis_penelitian: '', latar_belakang: '',
  masalah: '', tujuan: '', teori: '', metode: '', variabel_independen: '',
  variabel_dependen: '', hasil: '', keterbatasan: '', research_gap: ''
});

const journalFields: { key: keyof JournalData, label: string, type: 'text' | 'textarea' }[] = [
  { key: 'judul', label: 'Judul', type: 'textarea' },
  { key: 'peneliti', label: 'Peneliti (Tahun)', type: 'text' },
  { key: 'jenis_penelitian', label: 'Jenis Penelitian', type: 'text' },
  { key: 'latar_belakang', label: 'Latar Belakang', type: 'textarea' },
  { key: 'masalah', label: 'Masalah', type: 'textarea' },
  { key: 'tujuan', label: 'Tujuan', type: 'textarea' },
  { key: 'teori', label: 'Teori', type: 'text' },
  { key: 'metode', label: 'Metode', type: 'text' },
  { key: 'variabel_independen', label: 'Variabel Independen (X)', type: 'text' },
  { key: 'variabel_dependen', label: 'Variabel Dependen (Y)', type: 'text' },
  { key: 'hasil', label: 'Hasil', type: 'textarea' },
  { key: 'keterbatasan', label: 'Keterbatasan', type: 'textarea' },
  { key: 'research_gap', label: 'Research Gap', type: 'textarea' },
];

interface ResearchComponents {
  topik: string;
  gap: string;
  tujuan: string;
  metode: string;
  nilaiTeoritis: string;
  teoriPendukung: string;
}

interface ComponentRecommendations {
  topik: string[];
  gap: string[];
  tujuan: string[];
  metode: string[];
  nilaiTeoritis: string[];
  teoriPendukung: string[];
}

interface TitleResult {
  title: string;
  explanation: string;
}

export default function Dashboard() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const navigate = useNavigate();

  // State
  const [temaUtama, setTemaUtama] = useState('');
  const [journals, setJournals] = useState<Journal[]>([
    { id: '1', data: emptyJournalData(), isExpanded: true },
    { id: '2', data: emptyJournalData(), isExpanded: false },
    { id: '3', data: emptyJournalData(), isExpanded: false },
  ]);
  
  const [components, setComponents] = useState<ResearchComponents>({
    topik: '',
    gap: '',
    tujuan: '',
    metode: '',
    nilaiTeoritis: '',
    teoriPendukung: ''
  });
  const [recommendations, setRecommendations] = useState<ComponentRecommendations | null>(null);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [results, setResults] = useState<TitleResult[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [analysisMarkdown, setAnalysisMarkdown] = useState('');
  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [extractingId, setExtractingId] = useState<string | null>(null);

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

  const addJournal = () => {
    setJournals([...journals, { id: Date.now().toString(), data: emptyJournalData(), isExpanded: true }]);
  };

  const removeJournal = (id: string) => {
    if (journals.length > 1) {
      setJournals(journals.filter(j => j.id !== id));
    }
  };

  const updateJournalData = (id: string, newData: Partial<JournalData>) => {
    setJournals(journals.map(j => j.id === id ? { ...j, data: { ...j.data, ...newData } } : j));
  };

  const toggleJournalExpand = (id: string) => {
    setJournals(journals.map(j => j.id === id ? { ...j, isExpanded: !j.isExpanded } : j));
  };

  const updateComponent = (key: keyof ResearchComponents, value: string) => {
    setComponents(prev => ({ ...prev, [key]: value }));
  };

  const handleFileUpload = async (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setError('Mohon upload file PDF.');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('Ukuran file PDF maksimal 10MB.');
      return;
    }

    setExtractingId(id);
    setError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];

          const prompt = `
Analisis jurnal akademik yang diunggah dan ekstrak informasi secara lengkap, sistematis, dan akademis.

WAJIB:
- Gunakan bahasa Indonesia formal
- Ambil informasi hanya berdasarkan isi jurnal (dilarang berasumsi)
- Jika informasi tidak ditemukan, isi dengan "tidak disebutkan"
- Output HARUS dalam format JSON VALID tanpa tambahan teks lain

ATURAN PENTING VARIABEL:
- Variabel dependen (Y) WAJIB hanya 1
- Variabel independen (X) HARUS mengikuti isi jurnal (tidak dibatasi jumlahnya)
- Jumlah X bisa 1, 2, 3, 5, bahkan lebih (sesuai jurnal)
- DILARANG mengarang atau menambahkan variabel yang tidak ada di jurnal
- Gunakan format: X1, X2, X3, ... sesuai jumlah variabel sebenarnya

Berikan output dengan struktur berikut:

{
  "peneliti": "Nama penulis utama dkk (Tahun)",
  "judul": "Judul lengkap jurnal",
  "jenis_penelitian": "kuantitatif / kualitatif / mixed method",
  "latar_belakang": "Ringkasan latar belakang penelitian",
  "masalah": "Masalah utama penelitian",
  "tujuan": "Tujuan utama penelitian",
  "teori": "Grand theory atau teori utama yang digunakan",
  "metode": "Metode penelitian (misal: regresi, SEM, studi kasus, dll)",
  "variabel": {
    "independen": [
      "X1: Nama variabel",
      "X2: Nama variabel",
      "X3: Nama variabel (tambahkan sesuai jumlah sebenarnya dalam jurnal)"
    ],
    "dependen": "Y: Nama variabel (WAJIB hanya 1)"
  },
  "hasil": "Jelaskan hasil uji pengaruh masing-masing variabel X terhadap Y secara spesifik (misal: X1 berpengaruh signifikan terhadap Y, X2 tidak berpengaruh signifikan terhadap Y, dst sesuai isi jurnal)",
  "keterbatasan": "Keterbatasan penelitian (jika ada)",
  "research_gap": {
    "jenis_gap": "Pilih satu atau lebih: knowledge gap / research gap / methodological gap / theoretical gap / empirical gap / practical gap / population gap / contextual gap / data gap",
    "penjelasan": "Jelaskan celah penelitian berdasarkan isi jurnal (bukan asumsi)",
    "rekomendasi_penelitian": "Saran penelitian selanjutnya yang lebih kuat dan spesifik"
  }
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
              responseMimeType: 'application/json'
            }
          });

          if (response.text) {
             try {
               const parsed = JSON.parse(response.text);
               const mappedData: JournalData = {
                 peneliti: parsed.peneliti || '',
                 judul: parsed.judul || '',
                 jenis_penelitian: parsed.jenis_penelitian || '',
                 latar_belakang: parsed.latar_belakang || '',
                 masalah: parsed.masalah || '',
                 tujuan: parsed.tujuan || '',
                 teori: parsed.teori || '',
                 metode: parsed.metode || '',
                 variabel_independen: Array.isArray(parsed.variabel?.independen) ? parsed.variabel.independen.join(', ') : (parsed.variabel?.independen || ''),
                 variabel_dependen: parsed.variabel?.dependen || '',
                 hasil: parsed.hasil || '',
                 keterbatasan: parsed.keterbatasan || '',
                 research_gap: parsed.research_gap ? `${parsed.research_gap.jenis_gap || ''}\n${parsed.research_gap.penjelasan || ''}\nRekomendasi: ${parsed.research_gap.rekomendasi_penelitian || ''}` : ''
               };
               setJournals(prev => prev.map(j => 
                 j.id === id 
                   ? { ...j, data: mappedData, isExpanded: true } 
                   : { ...j, isExpanded: false }
               ));
             } catch (e) {
               console.error("JSON Parse Error", e);
               setError('Gagal memformat hasil AI. Pastikan PDF berisi jurnal akademik yang valid.');
             }
          } else {
            setError('Gagal mengekstrak PDF.');
          }
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Terjadi kesalahan saat memproses PDF dengan AI.');
        } finally {
          setExtractingId(null);
          e.target.value = '';
        }
      };
      reader.onerror = () => {
        setError('Gagal membaca file PDF.');
        setExtractingId(null);
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan sistem.');
      setExtractingId(null);
    }
  };

  const handleAnalyze = async () => {
    const filledJournals = journals.filter(j => j.data.judul.trim() !== '' || j.data.peneliti.trim() !== '');
    if (filledJournals.length < 3) {
      setError('Minimal 3 jurnal harus diisi atau diupload untuk dianalisis.');
      return;
    }

    setIsAnalyzing(true);
    setError('');

    try {
      const filledJournalsWithIndex = filledJournals.map((j, i) => ({
        index: i + 1,
        ...j.data
      }));

      const gapInstruction = `
PANDUAN IDENTIFIKASI RESEARCH GAP:
- Knowledge Gap: Ada yang belum diketahui dalam literatur.
- Methodological Gap: Ada kelemahan/keterbatasan pada metode penelitian sebelumnya.
- Empirical Gap: Hasil penelitian sebelumnya tidak konsisten atau bertentangan.
- Theoretical Gap: Teori yang ada belum mampu menjelaskan fenomena tertentu.
- Practical Gap: Ada perbedaan antara teori dan praktik di lapangan.
- Population Gap: Populasi tertentu belum banyak diteliti.
- Contextual Gap: Konteks (waktu, tempat, situasi) berbeda dari penelitian sebelumnya.
- Data Gap: Keterbatasan data pada penelitian sebelumnya.
      `;

      const prompt = `
Anda adalah seorang profesor dan reviewer jurnal internasional bereputasi.

Analisis jurnal-jurnal berikut secara kritis, mendalam, dan akademis:
${JSON.stringify(filledJournalsWithIndex, null, 2)}

${temaUtama?.trim() ? `Tema utama penelitian pengguna: "${temaUtama}"` : ''}

${gapInstruction}

TUJUAN:
Menghasilkan analisis yang terintegrasi antara Research Gap dan kerangka Research Model Canvas (RMC) untuk menyusun arah penelitian yang kuat, sistematis, dan layak disetujui dosen.

---

ATURAN:
- Gunakan bahasa Indonesia formal akademik
- Analisis berbasis isi jurnal (tanpa asumsi)
- Bersikap kritis seperti reviewer jurnal Scopus
- Fokus pada evaluasi, sintesis, dan gap (bukan ringkasan)
- Jika jurnal tidak relevan dengan tema → beri tanda ❌ + alasan akademik
- Jika relevan → beri tanda ✅
- Output HARUS dalam format JSON VALID tanpa tambahan teks lain.

---

HASIL YANG DIMINTA HARUS BERUPA JSON DENGAN STRUKTUR BERIKUT:
{
  "markdown_analysis": "Berisi seluruh analisis lengkap dalam format Markdown (gunakan heading ###, bullet points, dan tabel untuk matriks). Struktur markdown HARUS mencakup:\\n\\n### 1. AREA STUDI / TOPIK PENELITIAN\\nBuatkan 3–5 pilihan topik penelitian yang mewakili pola dari jurnal, selaras dengan tema utama, dan berbeda dari penelitian sebelumnya (punya novelty).\\n\\n### 2. MASALAH NYATA (PROBLEM STATEMENT)\\nRumuskan masalah utama yang belum terselesaikan dari jurnal-jurnal tersebut.\\n\\n### 3. TEORI PENDUKUNG (GRAND THEORY)\\nSebutkan teori-teori utama yang relevan untuk memecahkan masalah tersebut.\\n\\n### 4. TUJUAN PENELITIAN\\nBuatkan 3–5 pilihan tujuan penelitian yang spesifik dan terukur.\\n\\n### 5. METODE PENELITIAN\\nSarankan 3–5 pendekatan metode yang paling tepat untuk menjawab tujuan.\\n\\n### 6. NILAI KEBAHARUAN (NOVELTY)\\nJelaskan apa yang membuat arah penelitian ini baru dan penting (Nilai Teoritis & Praktis).\\n\\n### 7. ANALISIS JURNAL (EVALUASI KRITIS)\\nUntuk setiap jurnal, berikan: Relevansi (✅ / ❌ beserta alasan), Kelebihan utama, Kekurangan / Keterbatasan, dan Jenis Research Gap.\\n\\n### 8. MATRIKS ANALISIS JURNAL\\nBuat tabel perbandingan ringkas (Peneliti, Fokus, Metode, Hasil, Gap).\\n\\n### 9. SINTESIS AKHIR\\nBerikan kesimpulan berupa pola umum, kelemahan dominan, dan arah penelitian yang paling potensial.",
  "topik": ["Pilihan 1 (Fokus, spesifik, berbasis gap)", "Pilihan 2", "Pilihan 3"],
  "gap": ["Pilihan 1 (Diambil dari kelemahan jurnal sebelumnya, jelas, terukur)", "Pilihan 2", "Pilihan 3"],
  "tujuan": ["Pilihan 1 (Selaras dengan masalah, gunakan kata kerja ilmiah)", "Pilihan 2", "Pilihan 3"],
  "metode": ["Pilihan 1 (Metode paling relevan + alasan singkat kenapa cocok)", "Pilihan 2", "Pilihan 3"],
  "nilaiTeoritis": ["Pilihan 1 (Menunjukkan kontribusi ilmiah, jelas letak novelty)", "Pilihan 2", "Pilihan 3"],
  "teoriPendukung": ["Pilihan 1 (Teori utama / grand theory yang relevan)", "Pilihan 2", "Pilihan 3"]
}
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-pro-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              markdown_analysis: { type: Type.STRING },
              topik: { type: Type.ARRAY, items: { type: Type.STRING } },
              gap: { type: Type.ARRAY, items: { type: Type.STRING } },
              tujuan: { type: Type.ARRAY, items: { type: Type.STRING } },
              metode: { type: Type.ARRAY, items: { type: Type.STRING } },
              nilaiTeoritis: { type: Type.ARRAY, items: { type: Type.STRING } },
              teoriPendukung: { type: Type.ARRAY, items: { type: Type.STRING } }
            },
            required: ['markdown_analysis', 'topik', 'gap', 'tujuan', 'metode', 'nilaiTeoritis', 'teoriPendukung']
          }
        }
      });

      const jsonStr = response.text?.trim() || '{}';
      const parsed = JSON.parse(jsonStr);
      
      setComponents({
        topik: parsed.topik?.[0] || '',
        gap: parsed.gap?.[0] || '',
        tujuan: parsed.tujuan?.[0] || '',
        metode: parsed.metode?.[0] || '',
        nilaiTeoritis: parsed.nilaiTeoritis?.[0] || '',
        teoriPendukung: parsed.teoriPendukung?.[0] || ''
      });
      setRecommendations({
        topik: parsed.topik || [],
        gap: parsed.gap || [],
        tujuan: parsed.tujuan || [],
        metode: parsed.metode || [],
        nilaiTeoritis: parsed.nilaiTeoritis || [],
        teoriPendukung: parsed.teoriPendukung || []
      });
      setAnalysisMarkdown(parsed.markdown_analysis || '');
      setShowAnalysisModal(true);
    } catch (err: any) {
      console.error('Analysis error:', err);
      setError('Gagal menganalisis jurnal. Silakan coba lagi.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleExportWord = (title: string, explanation: string) => {
    const content = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>Export Judul Penelitian</title>
        <style>
          body { font-family: 'Times New Roman', serif; font-size: 12pt; }
          h1 { font-size: 16pt; text-align: center; }
          h2 { font-size: 14pt; margin-top: 20px; }
          p { margin-bottom: 10px; }
          ul { margin-top: 0; }
          li { margin-bottom: 8px; }
        </style>
      </head>
      <body>
        <h1>Judul Penelitian</h1>
        <p><strong>${title}</strong></p>
        <p><em>Alasan: ${explanation}</em></p>
        
        <h2>Komponen Penelitian</h2>
        <ul>
          <li><strong>Topik Penelitian:</strong> ${components.topik}</li>
          <li><strong>Masalah Penelitian (Gap):</strong> ${components.gap}</li>
          <li><strong>Tujuan Penelitian:</strong> ${components.tujuan}</li>
          <li><strong>Metode Penelitian:</strong> ${components.metode}</li>
          <li><strong>Nilai Kebaruan (Novelty):</strong> ${components.nilaiTeoritis}</li>
          <li><strong>Teori Pendukung:</strong> ${components.teoriPendukung}</li>
        </ul>
      </body>
      </html>
    `;

    const blob = new Blob(['\ufeff', content], {
      type: 'application/msword'
    });
    
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Judul_Penelitian_${new Date().getTime()}.doc`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleExportPDF = (title: string, explanation: string) => {
    const doc = new jsPDF();
    const margin = 20;
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;

    // Title Section
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Judul Penelitian", margin, yPos);
    yPos += 10;

    doc.setFontSize(12);
    doc.setFont("helvetica", "bold");
    const titleLines = doc.splitTextToSize(title, maxLineWidth);
    doc.text(titleLines, margin, yPos);
    yPos += titleLines.length * 6 + 4;

    doc.setFont("helvetica", "italic");
    doc.setFontSize(11);
    const expLines = doc.splitTextToSize(`Alasan: ${explanation}`, maxLineWidth);
    doc.text(expLines, margin, yPos);
    yPos += expLines.length * 6 + 10;

    // Components Section
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Komponen Penelitian", margin, yPos);
    yPos += 10;

    doc.setFontSize(11);
    
    const componentsList = [
      { label: "Topik Penelitian", value: components.topik },
      { label: "Masalah Penelitian (Gap)", value: components.gap },
      { label: "Tujuan Penelitian", value: components.tujuan },
      { label: "Metode Penelitian", value: components.metode },
      { label: "Nilai Kebaruan (Novelty)", value: components.nilaiTeoritis },
      { label: "Teori Pendukung", value: components.teoriPendukung }
    ];

    componentsList.forEach(comp => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${comp.label}:`, margin, yPos);
      yPos += 6;
      
      doc.setFont("helvetica", "normal");
      const valLines = doc.splitTextToSize(comp.value || "-", maxLineWidth);
      if (yPos + (valLines.length * 5) > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(valLines, margin, yPos);
      yPos += valLines.length * 5 + 6;
    });

    doc.save(`Judul_Penelitian_${new Date().getTime()}.pdf`);
  };

  const handleExportAllPDF = () => {
    const doc = new jsPDF();
    const margin = 20;
    let yPos = 20;
    const pageWidth = doc.internal.pageSize.getWidth();
    const maxLineWidth = pageWidth - margin * 2;

    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.text("Rekomendasi Judul Penelitian", margin, yPos);
    yPos += 15;

    results.forEach((result, index) => {
      if (yPos > 260) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      const titleLines = doc.splitTextToSize(`${index + 1}. ${result.title}`, maxLineWidth);
      doc.text(titleLines, margin, yPos);
      yPos += titleLines.length * 6 + 2;

      doc.setFontSize(11);
      doc.setFont("helvetica", "italic");
      const expLines = doc.splitTextToSize(`Alasan: ${result.explanation}`, maxLineWidth - 10);
      
      if (yPos + (expLines.length * 5) > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(expLines, margin + 5, yPos);
      yPos += expLines.length * 5 + 10;
    });

    // Components Section
    doc.addPage();
    yPos = 20;
    doc.setFontSize(16);
    doc.setFont("helvetica", "bold");
    doc.text("Komponen Penelitian", margin, yPos);
    yPos += 12;

    doc.setFontSize(11);
    const componentsList = [
      { label: "Topik Penelitian", value: components.topik },
      { label: "Masalah Penelitian (Gap)", value: components.gap },
      { label: "Tujuan Penelitian", value: components.tujuan },
      { label: "Metode Penelitian", value: components.metode },
      { label: "Nilai Kebaruan (Novelty)", value: components.nilaiTeoritis },
      { label: "Teori Pendukung", value: components.teoriPendukung }
    ];

    componentsList.forEach(comp => {
      if (yPos > 270) {
        doc.addPage();
        yPos = 20;
      }
      doc.setFont("helvetica", "bold");
      doc.text(`${comp.label}:`, margin, yPos);
      yPos += 6;
      
      doc.setFont("helvetica", "normal");
      const valLines = doc.splitTextToSize(comp.value || "-", maxLineWidth);
      if (yPos + (valLines.length * 5) > 280) {
        doc.addPage();
        yPos = 20;
      }
      doc.text(valLines, margin, yPos);
      yPos += valLines.length * 5 + 6;
    });

    doc.save(`Semua_Rekomendasi_Judul_${new Date().getTime()}.pdf`);
  };

  const handleGenerate = async () => {
    if (!components.topik || !components.gap || !components.tujuan) {
      setError('Pastikan Topik, Gap Penelitian, dan Tujuan sudah terisi.');
      return;
    }

    setIsGenerating(true);
    setError('');
    setShowModal(true);
    setResults([]);

    try {
      const prompt = `
Berdasarkan komponen penelitian berikut:

Topik Penelitian: ${components.topik}
Masalah Penelitian: ${components.gap}
Tujuan Penelitian: ${components.tujuan}
Metode Penelitian: ${components.metode}
Teori Pendukung: ${components.teoriPendukung}
Nilai Kebaruan: ${components.nilaiTeoritis}

TUGAS:
Buatkan 5–10 judul skripsi yang berkualitas tinggi dan layak disetujui dosen pembimbing.

KRITERIA WAJIB:
- Akademik, formal, dan spesifik
- Mengandung variabel penelitian (X → Y jika ada)
- Selaras dengan metode penelitian
- Mencerminkan research gap dan novelty
- Tidak ambigu dan tidak terlalu umum

ATURAN:
- Maksimal 20 kata per judul
- Gunakan struktur umum judul skripsi Indonesia
- Variasikan gaya penulisan (tidak monoton)
- Prioritaskan kejelasan variabel dibanding keindahan bahasa
- Hindari kata tidak ilmiah
- Hindari judul terlalu luas

---

CONTOH POLA:
- Pengaruh X terhadap Y menggunakan metode Z
- Analisis X dalam meningkatkan Y dengan pendekatan Z
- Studi empiris X terhadap Y berdasarkan teori T

---

OUTPUT:
Pilih judul yang paling kuat di posisi pertama.
Berikan penjelasan singkat (1-2 kalimat) mengapa setiap judul tersebut kuat secara akademis pada bagian explanation.
`;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: {
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                explanation: { type: Type.STRING }
              },
              required: ['title', 'explanation']
            }
          }
        }
      });

      const jsonStr = response.text?.trim() || '[]';
      const parsedResults = JSON.parse(jsonStr) as TitleResult[];
      setResults(parsedResults);
    } catch (err: any) {
      console.error('Generation error:', err);
      setError('Gagal menghasilkan judul. Silakan coba lagi.');
      setShowModal(false);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  if (!userEmail) return null;

  return (
    <div className="min-h-screen bg-[#e2e8f0] font-sans pb-24">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-slate-200 sticky top-0 z-50">
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
                  className="px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 rounded-xl transition-colors"
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
                  onClick={() => navigate('/ebook-maker')}
                  className="px-4 py-2 text-sm font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-colors"
                >
                  Ebook Maker
                </button>
              </nav>
            </div>
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex items-center gap-2 text-sm text-slate-600 bg-slate-100 px-3 py-1.5 rounded-full">
                <User className="w-4 h-4" />
                {userEmail}
              </div>
              <Button variant="ghost" onClick={handleLogout} className="text-slate-600 hover:text-slate-900">
                <LogOut className="w-4 h-4 sm:mr-2" />
                <span className="hidden sm:inline">Logout</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      {/* Main Content - Stacked Cards */}
      <main className="flex flex-col items-center pt-16 px-4">
        
        {/* Card 1: Header */}
        <div className="w-full max-w-3xl bg-gradient-to-b from-blue-500 to-blue-700 rounded-[2rem] pt-16 pb-16 px-8 text-center relative shadow-xl z-30">
          <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-blue-400/30 backdrop-blur-md p-4 rounded-2xl shadow-lg border border-white/20">
            <BookOpen className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-white mb-4 tracking-tight">Smart Research Title Builder</h1>
          <p className="text-blue-100 text-sm md:text-base max-w-xl mx-auto">
            Membantu mahasiswa merumuskan judul penelitian skripsi, tesis, akademik yang kuat menggunakan metode Research Builder Framework.
          </p>
        </div>

        {/* Card 2: Matriks Jurnal */}
        <div className="w-full max-w-4xl bg-white rounded-[2rem] p-6 md:p-10 shadow-2xl -mt-8 relative z-20 border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">1</div>
            <Database className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-slate-800">Matriks Jurnal Terdahulu</h2>
          </div>
          <p className="text-slate-500 text-sm mb-8">
            Masukkan jurnal dengan tema yang sama untuk menentukan Research Gap dan Topik Penelitian secara otomatis menggunakan AI.
          </p>

          <div className="bg-blue-50/50 border border-blue-100 rounded-2xl p-6 mb-8">
            <label className="block text-sm font-medium text-blue-900 mb-2">Tema Utama Penelitian (Opsional)</label>
            <p className="text-xs text-blue-600/70 mb-3">Masukkan tema utama yang ingin Anda teliti untuk mengarahkan AI dalam menganalisis jurnal.</p>
            <input 
              type="text"
              value={temaUtama}
              onChange={(e) => setTemaUtama(e.target.value)}
              placeholder="Contoh: Pengaruh AI Terhadap Produktivitas Kerja..."
              className="w-full bg-white border border-blue-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-shadow"
            />
          </div>

          <div className="space-y-4 mb-6">
            {journals.map((journal, index) => (
              <div key={journal.id} className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm transition-all focus-within:border-blue-400">
                {/* Header */}
                <div className="bg-slate-50 p-4 border-b border-slate-200 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 cursor-pointer" onClick={() => toggleJournalExpand(journal.id)}>
                    <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm shrink-0">{index + 1}</div>
                    <h3 className="font-semibold text-slate-800 line-clamp-1 text-sm">
                      {journal.data.judul || `Jurnal ${index + 1} (Belum ada data)`}
                    </h3>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    <input
                      type="file"
                      accept="application/pdf"
                      id={`pdf-upload-${journal.id}`}
                      className="hidden"
                      onChange={(e) => handleFileUpload(journal.id, e)}
                      disabled={extractingId === journal.id}
                    />
                    <label
                      htmlFor={`pdf-upload-${journal.id}`}
                      className={`cursor-pointer px-3 py-1.5 rounded-lg transition-colors flex items-center gap-2 text-sm font-medium ${
                        extractingId === journal.id
                          ? 'bg-blue-50 text-blue-400 cursor-not-allowed'
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                      title="Upload PDF Jurnal"
                    >
                      {extractingId === journal.id ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /> Ekstrak...</>
                      ) : (
                        <><UploadCloud className="w-4 h-4" /> Upload PDF</>
                      )}
                    </label>
                    <button 
                      onClick={() => toggleJournalExpand(journal.id)}
                      className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg transition-colors"
                    >
                      {journal.isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                    </button>
                    <button 
                      onClick={() => removeJournal(journal.id)}
                      className="text-slate-400 hover:text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition-colors"
                      title="Hapus Jurnal"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                </div>
                
                {/* Body */}
                {journal.isExpanded && (
                  <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white">
                    {journalFields.map(field => (
                      <div key={field.key} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                        <label className="block text-xs font-semibold text-slate-500 mb-1 uppercase tracking-wider">{field.label}</label>
                        {field.type === 'textarea' ? (
                          <textarea
                            value={journal.data[field.key]}
                            onChange={(e) => updateJournalData(journal.id, { [field.key]: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all min-h-[80px] resize-y"
                            placeholder={`Masukkan ${field.label.toLowerCase()}...`}
                          />
                        ) : (
                          <input
                            type="text"
                            value={journal.data[field.key]}
                            onChange={(e) => updateJournalData(journal.id, { [field.key]: e.target.value })}
                            className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                            placeholder={`Masukkan ${field.label.toLowerCase()}...`}
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <button 
              onClick={addJournal}
              className="flex items-center gap-2 text-sm font-medium text-slate-600 bg-white border border-slate-200 hover:bg-slate-50 px-4 py-2.5 rounded-xl transition-colors w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4" /> Tambah Jurnal
            </button>
            
            <div className="flex items-center gap-3 w-full sm:w-auto">
              {analysisMarkdown && (
                <Button 
                  onClick={() => setShowAnalysisModal(true)} 
                  variant="secondary"
                  className="rounded-xl px-6 py-2.5 w-full sm:w-auto border-blue-200 text-blue-600 hover:bg-blue-50"
                >
                  <BookOpen className="w-4 h-4 mr-2" />
                  Lihat Hasil Analisis
                </Button>
              )}
              <Button 
                onClick={handleAnalyze} 
                isLoading={isAnalyzing}
                className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-6 py-2.5 w-full sm:w-auto"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                Analisis Jurnal dengan AI
              </Button>
            </div>
          </div>
        </div>

        {/* Card 3: Komponen Penelitian */}
        <div className="w-full max-w-5xl bg-white rounded-[2rem] p-6 md:p-10 shadow-2xl -mt-8 relative z-10 border border-slate-100">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-bold text-sm">2</div>
            <Layers className="w-6 h-6 text-blue-600" />
            <h2 className="text-2xl font-semibold text-slate-800">Komponen Penelitian</h2>
          </div>
          <p className="text-slate-500 text-sm mb-8">
            Lengkapi komponen di bawah ini. Komponen-komponen ini dapat diisi otomatis dari jurnal-jurnal di atas.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-10">
            {/* Topik */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium text-slate-800 text-sm">Topik Penelitian</h3>
              </div>
              <textarea 
                value={components.topik}
                onChange={(e) => updateComponent('topik', e.target.value)}
                placeholder="Contoh: Pengaruh AI Terhadap Peningkatan Kinerja..."
                className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-600 resize-none h-20"
              />
              {recommendations?.topik && recommendations.topik.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekomendasi AI:</p>
                  {recommendations.topik.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateComponent('topik', rec)}
                      className="w-full text-left text-sm text-slate-700 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 transition-colors flex items-start gap-2"
                    >
                      <span className="text-blue-500 font-medium mt-0.5">{idx + 1}.</span>
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Gap */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 focus-within:border-red-400 focus-within:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <AlertCircle className="w-5 h-5 text-red-500" />
                <h3 className="font-medium text-slate-800 text-sm">Masalah Nyata (Gap Penelitian)</h3>
              </div>
              <textarea 
                value={components.gap}
                onChange={(e) => updateComponent('gap', e.target.value)}
                placeholder="Contoh: Banyak penelitian AI, namun belum spesifik pada efisiensi..."
                className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-600 resize-none h-20"
              />
              {recommendations?.gap && recommendations.gap.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekomendasi AI:</p>
                  {recommendations.gap.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateComponent('gap', rec)}
                      className="w-full text-left text-sm text-slate-700 bg-white border border-slate-200 hover:border-red-300 hover:bg-red-50 rounded-xl p-3 transition-colors flex items-start gap-2"
                    >
                      <span className="text-red-500 font-medium mt-0.5">{idx + 1}.</span>
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Tujuan */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 focus-within:border-emerald-400 focus-within:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <Lightbulb className="w-5 h-5 text-emerald-500" />
                <h3 className="font-medium text-slate-800 text-sm">Tujuan Penelitian</h3>
              </div>
              <textarea 
                value={components.tujuan}
                onChange={(e) => updateComponent('tujuan', e.target.value)}
                placeholder="Contoh: Mengukur peningkatan efisiensi setelah..."
                className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-600 resize-none h-20"
              />
              {recommendations?.tujuan && recommendations.tujuan.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekomendasi AI:</p>
                  {recommendations.tujuan.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateComponent('tujuan', rec)}
                      className="w-full text-left text-sm text-slate-700 bg-white border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 rounded-xl p-3 transition-colors flex items-start gap-2"
                    >
                      <span className="text-emerald-500 font-medium mt-0.5">{idx + 1}.</span>
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Metode */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 focus-within:border-purple-400 focus-within:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <FlaskConical className="w-5 h-5 text-purple-500" />
                <h3 className="font-medium text-slate-800 text-sm">Metode / Pendekatan</h3>
              </div>
              <textarea 
                value={components.metode}
                onChange={(e) => updateComponent('metode', e.target.value)}
                placeholder="Contoh: Kuantitatif dengan Regresi Linear..."
                className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-600 resize-none h-20"
              />
              {recommendations?.metode && recommendations.metode.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekomendasi AI:</p>
                  {recommendations.metode.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateComponent('metode', rec)}
                      className="w-full text-left text-sm text-slate-700 bg-white border border-slate-200 hover:border-purple-300 hover:bg-purple-50 rounded-xl p-3 transition-colors flex items-start gap-2"
                    >
                      <span className="text-purple-500 font-medium mt-0.5">{idx + 1}.</span>
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Nilai Teoritis */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium text-slate-800 text-sm">Nilai Teoritis (Potensi)</h3>
              </div>
              <textarea 
                value={components.nilaiTeoritis}
                onChange={(e) => updateComponent('nilaiTeoritis', e.target.value)}
                placeholder="Contoh: Memperbarui teori penerimaan teknologi..."
                className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-600 resize-none h-20"
              />
              {recommendations?.nilaiTeoritis && recommendations.nilaiTeoritis.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekomendasi AI:</p>
                  {recommendations.nilaiTeoritis.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateComponent('nilaiTeoritis', rec)}
                      className="w-full text-left text-sm text-slate-700 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 transition-colors flex items-start gap-2"
                    >
                      <span className="text-blue-500 font-medium mt-0.5">{idx + 1}.</span>
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Teori Pendukung */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5 focus-within:border-blue-400 focus-within:bg-white transition-colors">
              <div className="flex items-center gap-2 mb-3">
                <BookMarked className="w-5 h-5 text-blue-500" />
                <h3 className="font-medium text-slate-800 text-sm">Teori Pendukung</h3>
              </div>
              <textarea 
                value={components.teoriPendukung}
                onChange={(e) => updateComponent('teoriPendukung', e.target.value)}
                placeholder="Contoh: Technology Acceptance Model (TAM)..."
                className="w-full bg-transparent border-none focus:outline-none text-sm text-slate-600 resize-none h-20"
              />
              {recommendations?.teoriPendukung && recommendations.teoriPendukung.length > 0 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Rekomendasi AI:</p>
                  {recommendations.teoriPendukung.map((rec, idx) => (
                    <button
                      key={idx}
                      onClick={() => updateComponent('teoriPendukung', rec)}
                      className="w-full text-left text-sm text-slate-700 bg-white border border-slate-200 hover:border-blue-300 hover:bg-blue-50 rounded-xl p-3 transition-colors flex items-start gap-2"
                    >
                      <span className="text-blue-500 font-medium mt-0.5">{idx + 1}.</span>
                      <span>{rec}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {error && !isAnalyzing && (
            <div className="mb-6 p-4 bg-red-50 text-red-600 rounded-xl text-sm border border-red-100 text-center">
              {error}
            </div>
          )}

          <div className="flex justify-center">
            <Button 
              onClick={handleGenerate}
              className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl px-8 py-4 text-lg shadow-lg shadow-blue-500/30 w-full md:w-auto min-w-[300px]"
            >
              <Sparkles className="w-5 h-5 mr-2" />
              Generate Judul Penelitian
            </Button>
          </div>
        </div>

      </main>

      {/* Results Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Rekomendasi Judul</h2>
                    <p className="text-sm text-slate-500">Hasil analisis AI berdasarkan komponen Anda</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {results.length > 0 && !isGenerating && (
                    <Button 
                      onClick={handleExportAllPDF}
                      className="bg-red-50 text-red-600 hover:bg-red-100 hover:text-red-700 border border-red-200 rounded-xl px-4 py-2 text-sm flex items-center gap-2"
                    >
                      <FileDown className="w-4 h-4" />
                      Export All to PDF
                    </Button>
                  )}
                  <button 
                    onClick={() => setShowModal(false)}
                    className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                {isGenerating ? (
                  <div className="flex flex-col items-center justify-center py-20">
                    <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mb-6 relative">
                      <Sparkles className="w-8 h-8 text-blue-600 animate-pulse" />
                      <div className="absolute inset-0 border-4 border-blue-500/20 rounded-2xl animate-ping" style={{ animationDuration: '2s' }}></div>
                    </div>
                    <h3 className="text-lg font-medium text-slate-900 mb-2">Merumuskan Judul...</h3>
                    <p className="text-slate-500 text-center max-w-sm">
                      AI sedang menyusun judul penelitian yang paling relevan dan kuat secara akademis.
                    </p>
                  </div>
                ) : results.length > 0 ? (
                  <div className="space-y-4">
                    {results.map((result, index) => (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        key={index}
                        className="bg-white rounded-2xl p-6 shadow-sm border border-slate-200 hover:border-blue-300 transition-colors group relative overflow-hidden"
                      >
                        <div className="absolute top-0 left-0 w-1 h-full bg-blue-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                        
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <h3 className="text-lg font-bold text-slate-900 mb-3 leading-snug">
                              {result.title}
                            </h3>
                            <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                              <span className="font-semibold text-blue-900 text-sm block mb-1 flex items-center gap-1.5">
                                <Lightbulb className="w-4 h-4 text-blue-600" /> Mengapa ini bagus:
                              </span>
                              <p className="text-sm text-slate-700 leading-relaxed">
                                {result.explanation}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 shrink-0">
                            <button
                              onClick={() => handleCopy(result.title, index)}
                              className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors border border-transparent hover:border-blue-100 flex items-center justify-center"
                              title="Copy title"
                            >
                              {copiedIndex === index ? (
                                <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                              ) : (
                                <Copy className="w-5 h-5" />
                              )}
                            </button>
                            <button
                              onClick={() => handleExportWord(result.title, result.explanation)}
                              className="p-2.5 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-xl transition-colors border border-transparent hover:border-indigo-100 flex items-center justify-center"
                              title="Export to Word"
                            >
                              <FileDown className="w-5 h-5" />
                            </button>
                            <button
                              onClick={() => handleExportPDF(result.title, result.explanation)}
                              className="p-2.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition-colors border border-transparent hover:border-red-100 flex items-center justify-center"
                              title="Export to PDF"
                            >
                              <FileDown className="w-5 h-5" />
                            </button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : null}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Analysis Modal */}
      <AnimatePresence>
        {showAnalysisModal && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white sticky top-0 z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-slate-900">Hasil Analisis Jurnal</h2>
                    <p className="text-sm text-slate-500">Sintesis dan evaluasi kritis berdasarkan Research Model Canvas</p>
                  </div>
                </div>
                <button 
                  onClick={() => setShowAnalysisModal(false)}
                  className="p-2 text-slate-400 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto bg-slate-50 flex-1">
                <div className="bg-white rounded-2xl p-6 md:p-8 shadow-sm border border-slate-200 prose prose-slate max-w-none prose-headings:text-slate-800 prose-a:text-blue-600 hover:prose-a:text-blue-500 prose-table:w-full prose-th:bg-slate-50 prose-th:p-3 prose-td:p-3 prose-th:border prose-td:border prose-th:border-slate-200 prose-td:border-slate-200">
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {analysisMarkdown}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
