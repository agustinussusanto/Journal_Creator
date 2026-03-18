import React, { useState, useEffect } from 'react';
import { GoogleGenAI, Type } from '@google/genai';
import { Copy, Check, Loader2, RefreshCw, BookOpen, Target, Lightbulb, Search, Beaker, FileText, Database, ChevronDown, ChevronUp, Sparkles, UploadCloud, AlertCircle, Settings, X, Download, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, HeadingLevel, Table, TableRow, TableCell, BorderStyle, WidthType } from 'docx';
import { saveAs } from 'file-saver';

let ai: GoogleGenAI | null = null;
try {
  if (process.env.GEMINI_API_KEY) {
    ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
} catch (e) {
  console.error("Failed to initialize GoogleGenAI", e);
}

interface TitleResult {
  title: string;
  scores: {
    clarity: number;
    specificity: number;
    strength: number;
  };
}

interface Journal {
  peneliti: string;
  judul: string;
  masalah: string;
  tujuan: string;
  teori: string;
  hasil: string;
  researchGap?: string;
  topik?: string;
  isTopikSesuai?: boolean;
  pesanKesesuaian?: string;
}

const GAP_TYPES = [
  { id: 'knowledge', name: 'Knowledge Gap', desc: 'Kekurangan informasi atau pengetahuan yang belum dibahas.' },
  { id: 'research', name: 'Research Gap', desc: 'Hasil penelitian sebelumnya belum konsisten atau masih terbatas.' },
  { id: 'methodological', name: 'Methodological Gap', desc: 'Keterbatasan atau perbedaan metode penelitian yang digunakan.' },
  { id: 'theoretical', name: 'Theoretical Gap', desc: 'Kurangnya penggunaan atau pengembangan teori.' },
  { id: 'empirical', name: 'Empirical Gap', desc: 'Minimnya data atau bukti nyata di lapangan.' },
  { id: 'practical', name: 'Practical Gap', desc: 'Perbedaan antara teori dan praktik di dunia nyata.' },
  { id: 'population', name: 'Population Gap', desc: 'Penelitian belum mencakup subjek atau populasi tertentu.' },
  { id: 'contextual', name: 'Contextual Gap', desc: 'Penelitian belum dilakukan pada konteks/lokasi/situasi tertentu.' },
  { id: 'data', name: 'Data Gap', desc: 'Keterbatasan atau kurangnya data yang digunakan dalam penelitian.' },
];

export default function App() {
  const [apiProvider, setApiProvider] = useState<'default' | 'openrouter'>(() => (localStorage.getItem('apiProvider') as 'default' | 'openrouter') || 'default');
  const [openRouterKey, setOpenRouterKey] = useState(() => localStorage.getItem('openRouterKey') || '');
  const [openRouterModel, setOpenRouterModel] = useState(() => localStorage.getItem('openRouterModel') || 'google/gemini-2.5-flash');
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('apiProvider', apiProvider);
    localStorage.setItem('openRouterKey', openRouterKey);
    localStorage.setItem('openRouterModel', openRouterModel);
  }, [apiProvider, openRouterKey, openRouterModel]);

  const callAI = async (prompt: string, schema: any, isPdf: boolean = false, pdfData?: string) => {
    if (apiProvider === 'default') {
      if (!ai) throw new Error('API Key Gemini bawaan tidak ditemukan. Silakan gunakan OpenRouter di Pengaturan.');
      
      let contents: any = prompt;
      if (isPdf && pdfData) {
        contents = {
          parts: [
            { inlineData: { data: pdfData, mimeType: 'application/pdf' } },
            { text: prompt }
          ]
        };
      }

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents,
        config: {
          responseMimeType: 'application/json',
          responseSchema: schema
        }
      });
      return response.text;
    } else {
      if (!openRouterKey) throw new Error('API Key OpenRouter belum diisi. Silakan isi di Pengaturan.');
      if (isPdf) throw new Error('Fitur ekstrak PDF saat ini hanya didukung menggunakan provider bawaan (Gemini). Silakan isi manual atau ganti provider.');

      const systemPrompt = `You are a helpful assistant. You MUST respond ONLY in valid JSON format that matches this schema:\n${JSON.stringify(schema, null, 2)}\nDo not include markdown formatting like \`\`\`json. Just output the raw JSON object.`;

      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${openRouterKey}`,
          "Content-Type": "application/json",
          "HTTP-Referer": window.location.origin,
          "X-Title": "AI Title Generator"
        },
        body: JSON.stringify({
          model: openRouterModel,
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: prompt }
          ],
          response_format: { type: "json_object" }
        })
      });

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "Terjadi kesalahan pada API OpenRouter.");
      }

      const data = await response.json();
      let text = data.choices[0].message.content;
      text = text.replace(/```json/g, '').replace(/```/g, '').trim();
      return text;
    }
  };

  const [journals, setJournals] = useState<Journal[]>(
    Array.from({ length: 10 }, () => ({
      peneliti: '',
      judul: '',
      masalah: '',
      tujuan: '',
      teori: '',
      hasil: '',
    }))
  );

  const addJournal = () => {
    setJournals([...journals, {
      peneliti: '',
      judul: '',
      masalah: '',
      tujuan: '',
      teori: '',
      hasil: '',
    }]);
  };

  const removeJournal = (index: number) => {
    setJournals(journals.filter((_, i) => i !== index));
  };

  const [formData, setFormData] = useState({
    areaStudi: '',
    masalahNyata: '',
    tujuanPenelitian: '',
    metodePenelitian: '',
    nilaiKebaruan: '',
    teoriPendukung: '',
  });

  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [loadingTitles, setLoadingTitles] = useState(false);
  const [results, setResults] = useState<TitleResult[]>([]);
  const [error, setError] = useState('');
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [expandedJournal, setExpandedJournal] = useState<number | null>(0);
  const [extractingIndex, setExtractingIndex] = useState<number | null>(null);
  const [temaUtama, setTemaUtama] = useState('');
  const [selectedGapType, setSelectedGapType] = useState<string>('research');
  const [topikOptions, setTopikOptions] = useState<string[]>([]);
  const [tujuanOptions, setTujuanOptions] = useState<string[]>([]);
  const [metodeOptions, setMetodeOptions] = useState<string[]>([]);
  const [kebaruanOptions, setKebaruanOptions] = useState<string[]>([]);

  const handleJournalChange = (index: number, field: keyof Journal, value: string) => {
    const newJournals = [...journals];
    newJournals[index] = { ...newJournals[index], [field]: value };
    setJournals(newJournals);
  };

  const handleTextareaResize = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    e.target.style.height = 'auto';
    e.target.style.height = `${e.target.scrollHeight}px`;
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileUpload = async (index: number, e: React.ChangeEvent<HTMLInputElement>) => {
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

    setExtractingIndex(index);
    setError('');

    try {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = async () => {
        try {
          const base64Data = (reader.result as string).split(',')[1];

          const prompt = `Ekstrak informasi dari jurnal akademik terlampir.
          Berikan output dalam format JSON dengan struktur persis seperti ini:
          {
            "peneliti": "Nama penulis dkk (Tahun)",
            "judul": "Judul lengkap jurnal",
            "masalah": "Masalah utama yang melatarbelakangi penelitian",
            "tujuan": "Tujuan utama penelitian",
            "teori": "Teori utama atau grand theory yang digunakan",
            "hasil": "Sebutkan secara spesifik dan jelas variabel independen (X1, X2, X3, dst) dan variabel dependen (Y) beserta namanya. Jelaskan hasil signifikansi pengaruh masing-masing variabel X terhadap Y (misal: X1 (Nama Variabel) berpengaruh signifikan terhadap Y (Nama Variabel), X2 (Nama) tidak berpengaruh signifikan terhadap Y)."
          }`;

          const schema = {
            type: Type.OBJECT,
            properties: {
              peneliti: { type: Type.STRING },
              judul: { type: Type.STRING },
              masalah: { type: Type.STRING },
              tujuan: { type: Type.STRING },
              teori: { type: Type.STRING },
              hasil: { type: Type.STRING },
            },
            required: ['peneliti', 'judul', 'masalah', 'tujuan', 'teori', 'hasil']
          };

          const responseText = await callAI(prompt, schema, true, base64Data);

          if (responseText) {
            const parsed = JSON.parse(responseText);
            const newJournals = [...journals];
            newJournals[index] = {
              peneliti: parsed.peneliti || '',
              judul: parsed.judul || '',
              masalah: parsed.masalah || '',
              tujuan: parsed.tujuan || '',
              teori: parsed.teori || '',
              hasil: parsed.hasil || '',
            };
            setJournals(newJournals);
          } else {
            setError('Gagal mengekstrak PDF. Silakan coba lagi atau isi manual.');
          }
        } catch (err: any) {
          console.error(err);
          setError(err.message || 'Terjadi kesalahan saat memproses PDF dengan AI.');
        } finally {
          setExtractingIndex(null);
          e.target.value = '';
        }
      };
      reader.onerror = () => {
        setError('Gagal membaca file PDF.');
        setExtractingIndex(null);
      };
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan sistem.');
      setExtractingIndex(null);
    }
  };

  const analyzeJournals = async () => {
    // Check if at least some journals are filled (e.g., first 3 for testing, but ideally 10)
    const filledJournalsWithIndex = journals.map((j, i) => ({ ...j, originalIndex: i })).filter(j => j.judul.trim() !== '' && j.hasil.trim() !== '');
    if (filledJournalsWithIndex.length < 3) {
      setError('Mohon isi minimal 3 jurnal (Judul dan Hasil) untuk dianalisis oleh AI. Disarankan mengisi ke-10 jurnal untuk hasil maksimal.');
      return;
    }

    setLoadingAnalysis(true);
    setError('');

    try {
      const selectedGap = GAP_TYPES.find(g => g.id === selectedGapType);
      const gapInstruction = selectedGap 
        ? `Fokuskan analisis gap pada jenis **${selectedGap.name}** (${selectedGap.desc}).` 
        : '';

      const prompt = `Saya memiliki daftar jurnal penelitian berikut:
${JSON.stringify(filledJournalsWithIndex, null, 2)}

${temaUtama.trim() ? `Pengguna telah menetapkan Tema Utama penelitian: "${temaUtama}".\n` : ''}${gapInstruction}
Berdasarkan matriks jurnal di atas, tolong analisis dan tentukan:
1. 3-5 pilihan Topik Penelitian (Area Studi) yang paling merepresentasikan tema umum dari jurnal-jurnal tersebut, disesuaikan dengan Gap yang ditemukan.
2. Masalah Nyata (${selectedGap?.name || 'Research Gap'} umum), misalnya dari celah yang belum diteliti secara keseluruhan sesuai jenis gap yang dipilih.
3. Teori Pendukung yang paling relevan atau sering digunakan dari jurnal-jurnal tersebut.
4. 3-5 pilihan Tujuan Penelitian yang logis berdasarkan masalah nyata yang ditemukan.
5. 3-5 pilihan Metode Penelitian yang paling cocok untuk menyelesaikan masalah tersebut (bisa dari metode yang paling berhasil di jurnal atau usulan metode baru).
6. 3-5 pilihan Nilai Kebaruan (Novelty) yang bisa ditawarkan dari penelitian ini dibandingkan jurnal-jurnal sebelumnya.
7. Analisis spesifik untuk masing-masing jurnal (berdasarkan 'originalIndex'):
   a. Topik spesifik dari jurnal tersebut.
   b. Apakah topik jurnal ini sesuai/sejalan dengan ${temaUtama.trim() ? `"Tema Utama" yang ditetapkan pengguna` : `"Topik Penelitian" utama`}? (true/false)
   c. Pesan informasi jika topik kurang sesuai (kosongkan jika sesuai).
   d. ${selectedGap?.name || 'Research Gap'} spesifik dari jurnal tersebut.

Berikan jawaban dalam format JSON dengan struktur:
{
  "topikPenelitianOptions": ["string", "string"],
  "masalahNyata": "string",
  "teoriPendukung": "string",
  "tujuanPenelitianOptions": ["string", "string"],
  "metodePenelitianOptions": ["string", "string"],
  "nilaiKebaruanOptions": ["string", "string"],
  "journalAnalyses": [
    {
      "originalIndex": number,
      "topik": "string",
      "isTopikSesuai": boolean,
      "pesanKesesuaian": "string",
      "researchGap": "string"
    }
  ]
}`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          topikPenelitianOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          masalahNyata: { type: Type.STRING },
          teoriPendukung: { type: Type.STRING },
          tujuanPenelitianOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          metodePenelitianOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          nilaiKebaruanOptions: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
          },
          journalAnalyses: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                originalIndex: { type: Type.INTEGER },
                topik: { type: Type.STRING },
                isTopikSesuai: { type: Type.BOOLEAN },
                pesanKesesuaian: { type: Type.STRING },
                researchGap: { type: Type.STRING },
              },
              required: ['originalIndex', 'topik', 'isTopikSesuai', 'pesanKesesuaian', 'researchGap'],
            }
          }
        },
        required: ['topikPenelitianOptions', 'masalahNyata', 'teoriPendukung', 'tujuanPenelitianOptions', 'metodePenelitianOptions', 'nilaiKebaruanOptions', 'journalAnalyses'],
      };

      const responseText = await callAI(prompt, schema);

      if (responseText) {
        const parsed = JSON.parse(responseText);
        
        const options = parsed.topikPenelitianOptions || [];
        const tujuanOpts = parsed.tujuanPenelitianOptions || [];
        const metodeOpts = parsed.metodePenelitianOptions || [];
        const kebaruanOpts = parsed.nilaiKebaruanOptions || [];
        
        setTopikOptions(options);
        setTujuanOptions(tujuanOpts);
        setMetodeOptions(metodeOpts);
        setKebaruanOptions(kebaruanOpts);

        setFormData(prev => ({
          ...prev,
          areaStudi: options.length > 0 ? options[0] : '',
          masalahNyata: parsed.masalahNyata || '',
          teoriPendukung: parsed.teoriPendukung || '',
          tujuanPenelitian: tujuanOpts.length > 0 ? tujuanOpts[0] : '',
          metodePenelitian: metodeOpts.length > 0 ? metodeOpts[0] : '',
          nilaiKebaruan: kebaruanOpts.length > 0 ? kebaruanOpts[0] : '',
        }));
        
        if (parsed.journalAnalyses && Array.isArray(parsed.journalAnalyses)) {
          setJournals(prev => {
            const newJournals = [...prev];
            parsed.journalAnalyses.forEach((analysis: any) => {
              if (newJournals[analysis.originalIndex]) {
                newJournals[analysis.originalIndex] = {
                  ...newJournals[analysis.originalIndex],
                  researchGap: analysis.researchGap,
                  topik: analysis.topik,
                  isTopikSesuai: analysis.isTopikSesuai,
                  pesanKesesuaian: analysis.pesanKesesuaian
                };
              }
            });
            return newJournals;
          });
        }

        // Scroll to form
        document.getElementById('research-form')?.scrollIntoView({ behavior: 'smooth' });
      } else {
        setError('Gagal menganalisis jurnal. Silakan coba lagi.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi AI untuk analisis jurnal.');
    } finally {
      setLoadingAnalysis(false);
    }
  };

  const generateTitles = async () => {
    if (Object.values(formData).some((val) => (val as string).trim() === '')) {
      setError('Mohon lengkapi semua komponen penelitian untuk hasil yang maksimal.');
      return;
    }

    setLoadingTitles(true);
    setError('');
    setResults([]);

    try {
      const prompt = `Kamu adalah asisten akademik ahli yang membantu mahasiswa merumuskan judul penelitian skripsi atau tesis yang kuat.
Berdasarkan 6 komponen Research Builder Framework berikut:
1. Topik Penelitian: ${formData.areaStudi}
2. Masalah Nyata: ${formData.masalahNyata}
3. Tujuan Penelitian: ${formData.tujuanPenelitian}
4. Metode Penelitian: ${formData.metodePenelitian}
5. Nilai Kebaruan: ${formData.nilaiKebaruan}
6. Teori Pendukung: ${formData.teoriPendukung}

Buatkan tepat 10 variasi judul penelitian akademik yang berbeda, formal, logis, layak untuk skripsi/tesis, tidak terlalu panjang, dan menggunakan bahasa akademik.
Aturan pembuatan judul:
1. Harus memiliki minimal dua variabel penelitian.
2. Memiliki objek penelitian.
3. Menggunakan kata akademik seperti: Analisis, Pengaruh, Evaluasi, Model, Implementasi, Studi, Optimalisasi.
4. Struktur judul umumnya: Metode + Variabel + Objek Penelitian.
5. Hindari judul yang terlalu umum.

Selain judul, berikan juga skor kualitas (skala 1-100) untuk masing-masing judul berdasarkan:
- Kejelasan variabel (clarity)
- Spesifik objek (specificity)
- Kekuatan akademik (strength)`;

      const schema = {
        type: Type.OBJECT,
        properties: {
          titles: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING, description: 'Judul penelitian akademik' },
                scores: {
                  type: Type.OBJECT,
                  properties: {
                    clarity: { type: Type.INTEGER },
                    specificity: { type: Type.INTEGER },
                    strength: { type: Type.INTEGER },
                  },
                  required: ['clarity', 'specificity', 'strength'],
                },
              },
              required: ['title', 'scores'],
            },
          }
        },
        required: ['titles']
      };

      const responseText = await callAI(prompt, schema);

      if (responseText) {
        const parsedResults = JSON.parse(responseText);
        setResults(parsedResults.titles || parsedResults);
        setTimeout(() => {
          document.getElementById('results-section')?.scrollIntoView({ behavior: 'smooth' });
        }, 100);
      } else {
        setError('Gagal menghasilkan judul. Silakan coba lagi.');
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Terjadi kesalahan saat menghubungi AI untuk membuat judul.');
    } finally {
      setLoadingTitles(false);
    }
  };

  const copyToClipboard = (text: string, index: number) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const exportToPDF = () => {
    const doc = new jsPDF();
    
    doc.setFontSize(18);
    doc.text('Hasil Analisis Jurnal & Rekomendasi Judul', 14, 22);
    
    doc.setFontSize(12);
    doc.text(`Tema Utama: ${temaUtama || 'Tidak ditentukan'}`, 14, 32);
    
    let yPos = 45;
    
    // 1. Analisis Jurnal
    doc.setFontSize(14);
    doc.text('1. Analisis Jurnal', 14, yPos);
    yPos += 10;
    
    const journalData = journals.map((j, i) => [
      i + 1,
      j.judul || '-',
      j.peneliti || '-',
      j.masalah || '-',
      j.tujuan || '-',
      j.hasil || '-',
      j.researchGap || j.pesanKesesuaian || '-'
    ]);
    
    autoTable(doc, {
      startY: yPos,
      head: [['No', 'Judul', 'Peneliti', 'Masalah', 'Tujuan', 'Hasil', 'Gap/Kesesuaian']],
      body: journalData,
      theme: 'grid',
      styles: { fontSize: 8, cellPadding: 2 },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 35 },
        2: { cellWidth: 20 },
        3: { cellWidth: 30 },
        4: { cellWidth: 30 },
        5: { cellWidth: 30 },
        6: { cellWidth: 30 }
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // 2. Komponen Penelitian
    if (yPos > 250) {
      doc.addPage();
      yPos = 20;
    }
    
    doc.setFontSize(14);
    doc.text('2. Komponen Penelitian', 14, yPos);
    yPos += 10;
    
    const componentsData = [
      ['Topik Penelitian', formData.areaStudi || '-'],
      ['Masalah Nyata (Gap)', formData.masalahNyata || '-'],
      ['Tujuan Penelitian', formData.tujuanPenelitian || '-'],
      ['Metode / Pendekatan', formData.metodePenelitian || '-'],
      ['Nilai Kebaruan (Novelty)', formData.nilaiKebaruan || '-'],
      ['Teori Pendukung', formData.teoriPendukung || '-']
    ];
    
    autoTable(doc, {
      startY: yPos,
      body: componentsData,
      theme: 'grid',
      styles: { fontSize: 10, cellPadding: 3 },
      columnStyles: {
        0: { cellWidth: 50, fontStyle: 'bold' },
        1: { cellWidth: 130 }
      }
    });
    
    yPos = (doc as any).lastAutoTable.finalY + 15;
    
    // 3. Rekomendasi Judul
    if (results.length > 0) {
      if (yPos > 250) {
        doc.addPage();
        yPos = 20;
      }
      
      doc.setFontSize(14);
      doc.text('3. Rekomendasi Judul', 14, yPos);
      yPos += 10;
      
      const titleData = results.map((r, i) => [
        i + 1,
        r.title,
        `Kejelasan: ${r.scores.clarity}\nSpesifik: ${r.scores.specificity}\nAkademik: ${r.scores.strength}`
      ]);
      
      autoTable(doc, {
        startY: yPos,
        head: [['No', 'Judul Rekomendasi', 'Skor']],
        body: titleData,
        theme: 'grid',
        styles: { fontSize: 10, cellPadding: 3 },
        columnStyles: {
          0: { cellWidth: 15 },
          1: { cellWidth: 120 },
          2: { cellWidth: 45 }
        }
      });
    }
    
    doc.save('Analisis_Jurnal_Rekomendasi_Judul.pdf');
  };

  const exportToWord = async () => {
    const doc = new Document({
      sections: [{
        properties: {},
        children: [
          new Paragraph({
            text: 'Hasil Analisis Jurnal & Rekomendasi Judul',
            heading: HeadingLevel.HEADING_1,
          }),
          new Paragraph({
            text: `Tema Utama: ${temaUtama || 'Tidak ditentukan'}`,
            spacing: { after: 400 },
          }),
          
          new Paragraph({
            text: '1. Analisis Jurnal',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              new TableRow({
                children: [
                  'No', 'Judul', 'Peneliti', 'Masalah', 'Tujuan', 'Hasil', 'Gap/Kesesuaian'
                ].map(text => new TableCell({
                  children: [new Paragraph({ text, style: 'Strong' })],
                  shading: { fill: 'E2E8F0' },
                  margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }))
              }),
              ...journals.map((j, i) => new TableRow({
                children: [
                  (i + 1).toString(),
                  j.judul || '-',
                  j.peneliti || '-',
                  j.masalah || '-',
                  j.tujuan || '-',
                  j.hasil || '-',
                  j.researchGap || j.pesanKesesuaian || '-'
                ].map(text => new TableCell({
                  children: [new Paragraph({ text })],
                  margins: { top: 100, bottom: 100, left: 100, right: 100 }
                }))
              }))
            ]
          }),
          
          new Paragraph({
            text: '2. Komponen Penelitian',
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 600, after: 200 },
          }),
          
          new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            rows: [
              ['Topik Penelitian', formData.areaStudi || '-'],
              ['Masalah Nyata (Gap)', formData.masalahNyata || '-'],
              ['Tujuan Penelitian', formData.tujuanPenelitian || '-'],
              ['Metode / Pendekatan', formData.metodePenelitian || '-'],
              ['Nilai Kebaruan (Novelty)', formData.nilaiKebaruan || '-'],
              ['Teori Pendukung', formData.teoriPendukung || '-']
            ].map(([label, value]) => new TableRow({
              children: [
                new TableCell({
                  children: [new Paragraph({ text: label, style: 'Strong' })],
                  shading: { fill: 'E2E8F0' },
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  width: { size: 30, type: WidthType.PERCENTAGE }
                }),
                new TableCell({
                  children: [new Paragraph({ text: value })],
                  margins: { top: 100, bottom: 100, left: 100, right: 100 },
                  width: { size: 70, type: WidthType.PERCENTAGE }
                })
              ]
            }))
          }),
          
          ...(results.length > 0 ? [
            new Paragraph({
              text: '3. Rekomendasi Judul',
              heading: HeadingLevel.HEADING_2,
              spacing: { before: 600, after: 200 },
            }),
            new Table({
              width: { size: 100, type: WidthType.PERCENTAGE },
              rows: [
                new TableRow({
                  children: [
                    'No', 'Judul Rekomendasi', 'Skor'
                  ].map(text => new TableCell({
                    children: [new Paragraph({ text, style: 'Strong' })],
                    shading: { fill: 'E2E8F0' },
                    margins: { top: 100, bottom: 100, left: 100, right: 100 }
                  }))
                }),
                ...results.map((r, i) => new TableRow({
                  children: [
                    new TableCell({
                      children: [new Paragraph({ text: (i + 1).toString() })],
                      margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    }),
                    new TableCell({
                      children: [new Paragraph({ text: r.title })],
                      margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    }),
                    new TableCell({
                      children: [
                        new Paragraph({ text: `Kejelasan: ${r.scores.clarity}` }),
                        new Paragraph({ text: `Spesifik: ${r.scores.specificity}` }),
                        new Paragraph({ text: `Akademik: ${r.scores.strength}` })
                      ],
                      margins: { top: 100, bottom: 100, left: 100, right: 100 }
                    })
                  ]
                }))
              ]
            })
          ] : [])
        ]
      }]
    });

    const blob = await Packer.toBlob(doc);
    saveAs(blob, 'Analisis_Jurnal_Rekomendasi_Judul.docx');
  };

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-emerald-600 bg-emerald-50';
    if (score >= 80) return 'text-blue-600 bg-blue-50';
    if (score >= 70) return 'text-amber-600 bg-amber-50';
    return 'text-red-600 bg-red-50';
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-blue-200 pb-20">
      {/* Header */}
      <header className="bg-blue-900 text-white py-12 px-4 shadow-md relative overflow-hidden">
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={() => setShowSettings(true)}
            className="p-2 bg-white/10 hover:bg-white/20 rounded-full transition-colors backdrop-blur-sm border border-white/20"
            title="Pengaturan API"
          >
            <Settings className="w-5 h-5 text-blue-100" />
          </button>
        </div>
        <div className="absolute top-0 left-0 w-full h-full opacity-10 pointer-events-none">
          <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-blue-400 blur-3xl"></div>
          <div className="absolute top-12 right-12 w-64 h-64 rounded-full bg-indigo-400 blur-3xl"></div>
        </div>
        <div className="max-w-5xl mx-auto relative z-10 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-white/10 rounded-2xl mb-6 backdrop-blur-sm border border-white/20">
            <BookOpen className="w-8 h-8 text-blue-200" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold tracking-tight mb-4">
            Smart Research Title Builder
          </h1>
          <p className="text-blue-100 text-lg md:text-xl max-w-2xl mx-auto font-light">
            Membantu mahasiswa merumuskan judul penelitian skripsi, tesis, atau akademik yang kuat menggunakan metode Research Builder Framework.
          </p>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">
        {showSettings && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center justify-between p-4 border-b border-slate-100">
                <h3 className="text-lg font-semibold text-slate-800 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-slate-500" />
                  Pengaturan API
                </h3>
                <button 
                  onClick={() => setShowSettings(false)}
                  className="p-1 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-6 space-y-6">
                <div className="space-y-3">
                  <label className="block text-sm font-medium text-slate-700">Penyedia AI (API Provider)</label>
                  <div className="grid grid-cols-2 gap-3">
                    <label className={`flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all ${apiProvider === 'default' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <input 
                        type="radio" 
                        name="apiProvider" 
                        value="default" 
                        checked={apiProvider === 'default'}
                        onChange={() => setApiProvider('default')}
                        className="sr-only"
                      />
                      <span className="font-medium text-sm">Gemini (Bawaan)</span>
                    </label>
                    <label className={`flex items-center justify-center p-3 border rounded-xl cursor-pointer transition-all ${apiProvider === 'openrouter' ? 'border-blue-500 bg-blue-50 text-blue-700 ring-1 ring-blue-500' : 'border-slate-200 hover:border-slate-300 text-slate-600'}`}>
                      <input 
                        type="radio" 
                        name="apiProvider" 
                        value="openrouter" 
                        checked={apiProvider === 'openrouter'}
                        onChange={() => setApiProvider('openrouter')}
                        className="sr-only"
                      />
                      <span className="font-medium text-sm">OpenRouter</span>
                    </label>
                  </div>
                </div>

                {apiProvider === 'openrouter' && (
                  <div className="space-y-4 animate-in slide-in-from-top-2">
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">OpenRouter API Key</label>
                      <input
                        type="password"
                        value={openRouterKey}
                        onChange={(e) => setOpenRouterKey(e.target.value)}
                        placeholder="sk-or-v1-..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-slate-700">Model OpenRouter</label>
                      <input
                        type="text"
                        value={openRouterModel}
                        onChange={(e) => setOpenRouterModel(e.target.value)}
                        placeholder="google/gemini-2.5-flash"
                        className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                      />
                      <p className="text-xs text-slate-500">Contoh: google/gemini-2.5-flash, anthropic/claude-3-haiku</p>
                    </div>
                  </div>
                )}
              </div>
              <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
                <button
                  onClick={() => setShowSettings(false)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm transition-colors"
                >
                  Selesai
                </button>
              </div>
            </div>
          </div>
        )}

        {!ai && apiProvider === 'default' && (
          <div className="bg-red-50 border border-red-200 rounded-2xl p-6 flex gap-4 items-start shadow-sm">
            <AlertCircle className="w-6 h-6 text-red-500 shrink-0 mt-0.5" />
            <div>
              <h3 className="text-red-800 font-semibold mb-1">Konfigurasi API Key Diperlukan</h3>
              <p className="text-red-700 text-sm leading-relaxed">
                Aplikasi ini membutuhkan <strong>Gemini API Key</strong> untuk dapat berfungsi. Karena Anda melihat pesan ini, kemungkinan aplikasi sedang dijalankan di environment produksi (seperti Vercel) tanpa konfigurasi yang tepat.
              </p>
              <div className="mt-3 bg-white/60 rounded-lg p-3 text-sm text-red-800 border border-red-100">
                <strong>Cara memperbaiki di Vercel:</strong>
                <ol className="list-decimal ml-5 mt-1 space-y-1">
                  <li>Buka dashboard Vercel project Anda.</li>
                  <li>Masuk ke menu <strong>Settings</strong> &gt; <strong>Environment Variables</strong>.</li>
                  <li>Tambahkan variable baru dengan Key: <code className="bg-red-100 px-1.5 py-0.5 rounded text-red-900 font-mono text-xs">GEMINI_API_KEY</code> dan Value: <em>[API Key Gemini Anda]</em>.</li>
                  <li>Lakukan <strong>Redeploy</strong> (Deployments &gt; Redeploy) agar perubahan diterapkan.</li>
                </ol>
              </div>
            </div>
          </div>
        )}

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-start gap-3 animate-in fade-in">
            <div className="mt-0.5">⚠️</div>
            <p>{error}</p>
          </div>
        )}

        {/* Step 1: Journal Matrix */}
        <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">1</span>
              <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                <Database className="w-6 h-6 text-blue-600" />
                Matriks Jurnal Terdahulu
              </h2>
            </div>
            <p className="text-slate-500 ml-11">Masukkan 10 jurnal dengan tema yang sama untuk menemukan Research Gap dan Topik Penelitian secara otomatis menggunakan AI.</p>
          </div>

          <div className="p-6 md:p-8">
            <div className="mb-6 p-5 bg-blue-50 border border-blue-100 rounded-xl">
              <label className="block text-sm font-semibold text-blue-900 mb-2">
                Tema Utama Penelitian (Opsional)
              </label>
              <p className="text-xs text-blue-700 mb-3">
                Masukkan tema utama yang ingin Anda teliti. AI akan mengecek apakah topik dari masing-masing jurnal di bawah ini sesuai dengan tema utama Anda.
              </p>
              <input
                type="text"
                value={temaUtama}
                onChange={(e) => setTemaUtama(e.target.value)}
                placeholder="Contoh: Pengaruh AI terhadap Produktivitas Kerja..."
                className="w-full px-4 py-2.5 rounded-lg border border-blue-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none text-sm bg-white"
              />
            </div>

            <div className="space-y-4">
              {journals.map((journal, index) => (
                <div key={index} className="border border-slate-200 rounded-xl overflow-hidden transition-all">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => setExpandedJournal(expandedJournal === index ? null : index)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpandedJournal(expandedJournal === index ? null : index);
                      }
                    }}
                    className="w-full flex items-center justify-between p-4 bg-slate-50 hover:bg-slate-100 transition-colors text-left cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-slate-500 w-6">#{index + 1}</span>
                      <span className="font-medium text-slate-700 truncate max-w-[200px] md:max-w-md">
                        {journal.judul || 'Jurnal belum diisi'}
                      </span>
                      {journal.isTopikSesuai === true && (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                          ✓ Topik Sesuai
                        </span>
                      )}
                      {journal.isTopikSesuai === false && (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
                          ⚠️ Topik Kurang Sesuai
                        </span>
                      )}
                      {journal.researchGap && journal.isTopikSesuai === undefined && (
                        <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-indigo-100 text-indigo-800">
                          Gap Ditemukan
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {journals.length > 1 && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            removeJournal(index);
                          }}
                          className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                          title="Hapus Jurnal"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                      {expandedJournal === index ? <ChevronUp className="w-5 h-5 text-slate-400" /> : <ChevronDown className="w-5 h-5 text-slate-400" />}
                    </div>
                  </div>
                  
                  {expandedJournal === index && (
                    <div className="p-4 md:p-6 grid grid-cols-1 md:grid-cols-2 gap-4 bg-white border-t border-slate-200 animate-in slide-in-from-top-2 duration-200">
                      <div className="col-span-1 md:col-span-2 mb-2">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-blue-50/50 border border-blue-100 rounded-xl gap-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-blue-100 text-blue-600 rounded-lg shrink-0">
                              <UploadCloud className="w-5 h-5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-semibold text-blue-900">Ekstrak Otomatis dari PDF</h4>
                              <p className="text-xs text-blue-700 mt-0.5">Upload file jurnal (PDF) dan biarkan AI mengisi form ini.</p>
                            </div>
                          </div>
                          <div className="shrink-0">
                            <input
                              type="file"
                              accept="application/pdf"
                              id={`pdf-upload-${index}`}
                              className="hidden"
                              onChange={(e) => handleFileUpload(index, e)}
                              disabled={extractingIndex === index}
                            />
                            <label
                              htmlFor={`pdf-upload-${index}`}
                              className={`cursor-pointer px-4 py-2.5 rounded-lg text-sm font-medium transition-all flex items-center justify-center gap-2 w-full sm:w-auto ${
                                extractingIndex === index
                                  ? 'bg-blue-200 text-blue-600 cursor-not-allowed'
                                  : 'bg-blue-600 hover:bg-blue-700 text-white shadow-sm hover:shadow'
                              }`}
                            >
                              {extractingIndex === index ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Mengekstrak...
                                </>
                              ) : (
                                <>
                                  <UploadCloud className="w-4 h-4" />
                                  Upload PDF
                                </>
                              )}
                            </label>
                          </div>
                        </div>
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Peneliti / Tahun</label>
                        <textarea
                          value={journal.peneliti}
                          onChange={(e) => handleJournalChange(index, 'peneliti', e.target.value)}
                          onInput={handleTextareaResize}
                          placeholder="Contoh: Smith et al. (2023)"
                          rows={1}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-sm resize-none overflow-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Judul Penelitian</label>
                        <textarea
                          value={journal.judul}
                          onChange={(e) => handleJournalChange(index, 'judul', e.target.value)}
                          onInput={handleTextareaResize}
                          placeholder="Judul lengkap jurnal..."
                          rows={1}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-sm resize-none overflow-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Masalah</label>
                        <textarea
                          value={journal.masalah}
                          onChange={(e) => handleJournalChange(index, 'masalah', e.target.value)}
                          onInput={handleTextareaResize}
                          placeholder="Masalah yang diangkat..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-sm resize-none overflow-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tujuan</label>
                        <textarea
                          value={journal.tujuan}
                          onChange={(e) => handleJournalChange(index, 'tujuan', e.target.value)}
                          onInput={handleTextareaResize}
                          placeholder="Tujuan penelitian..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-sm resize-none overflow-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Teori</label>
                        <textarea
                          value={journal.teori}
                          onChange={(e) => handleJournalChange(index, 'teori', e.target.value)}
                          onInput={handleTextareaResize}
                          placeholder="Teori yang digunakan..."
                          rows={1}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-sm resize-none overflow-hidden"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Variabel (X & Y) & Hasil Signifikansi</label>
                        <textarea
                          value={journal.hasil}
                          onChange={(e) => handleJournalChange(index, 'hasil', e.target.value)}
                          onInput={handleTextareaResize}
                          placeholder="Contoh: X1 (Harga) dan X2 (Promosi) berpengaruh signifikan terhadap Y (Keputusan Pembelian)..."
                          rows={2}
                          className="w-full px-3 py-2 rounded-lg border border-slate-200 focus:border-blue-500 focus:ring-1 focus:ring-blue-200 outline-none text-sm resize-none overflow-hidden"
                        />
                      </div>
                      {journal.topik !== undefined && (
                        <div className="col-span-1 md:col-span-2 mt-2 p-4 bg-indigo-50 border border-indigo-100 rounded-xl space-y-4">
                          <div className="flex items-center gap-2 border-b border-indigo-100 pb-2">
                            <Sparkles className="w-5 h-5 text-indigo-600" />
                            <h4 className="text-sm font-semibold text-indigo-900">Hasil Analisis AI untuk Jurnal Ini</h4>
                          </div>
                          
                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Topik Jurnal</label>
                            <input
                              type="text"
                              value={journal.topik}
                              onChange={(e) => handleJournalChange(index, 'topik', e.target.value)}
                              className="w-full px-3 py-2 rounded-lg border border-indigo-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-200 outline-none text-sm bg-white"
                            />
                            {journal.isTopikSesuai === false && journal.pesanKesesuaian && (
                              <div className="flex items-start gap-2 mt-2 text-amber-700 bg-amber-50 p-3 rounded-lg border border-amber-200 text-sm">
                                <span className="mt-0.5">⚠️</span>
                                <p>{journal.pesanKesesuaian}</p>
                              </div>
                            )}
                          </div>

                          <div className="space-y-2">
                            <label className="text-xs font-semibold text-indigo-800 uppercase tracking-wider">Research Gap Spesifik</label>
                            <p className="text-sm text-indigo-900 leading-relaxed bg-white p-3 rounded-lg border border-indigo-100">
                              {journal.researchGap}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-4 flex justify-center">
              <button
                onClick={addJournal}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors border border-blue-200"
              >
                + Tambah Jurnal
              </button>
            </div>

            {journals.some(j => j.topik) && (
              <div className="mt-8 overflow-x-auto border border-slate-200 rounded-xl shadow-sm">
                <table className="w-full text-left text-sm border-collapse">
                  <thead>
                    <tr className="bg-blue-900 text-white">
                      <th className="p-3 border border-blue-800 font-semibold w-12 text-center">No</th>
                      <th className="p-3 border border-blue-800 font-semibold whitespace-nowrap w-auto">Nama (Peneliti)</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[200px]">Judul</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[200px]">Masalah</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[150px]">Tujuan</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[150px]">Teori</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[200px]">Variabel (X & Y) & Hasil Signifikansi</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[150px] bg-indigo-800">Topik Analisis</th>
                      <th className="p-3 border border-blue-800 font-semibold min-w-[200px] bg-indigo-800">{GAP_TYPES.find(g => g.id === selectedGapType)?.name || 'Research Gap'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white">
                    {journals.map((journal, index) => (
                      <tr key={index} className="hover:bg-slate-50 transition-colors">
                        <td className="p-3 border border-slate-200 text-center text-slate-500 font-medium">{index + 1}</td>
                        <td className="p-3 border border-slate-200 whitespace-nowrap">{journal.peneliti || '-'}</td>
                        <td className="p-3 border border-slate-200">{journal.judul || '-'}</td>
                        <td className="p-3 border border-slate-200">{journal.masalah || '-'}</td>
                        <td className="p-3 border border-slate-200">{journal.tujuan || '-'}</td>
                        <td className="p-3 border border-slate-200">{journal.teori || '-'}</td>
                        <td className="p-3 border border-slate-200">{journal.hasil || '-'}</td>
                        <td className="p-3 border border-slate-200 bg-indigo-50/30">
                          {journal.topik || '-'}
                          {journal.isTopikSesuai === false && (
                            <div className="mt-1 text-xs text-amber-600">⚠️ Kurang Sesuai</div>
                          )}
                        </td>
                        <td className="p-3 border border-slate-200 bg-indigo-50/30">{journal.researchGap || '-'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-8 flex flex-col sm:flex-row items-center justify-end gap-4">
              <div className="flex items-center gap-3 w-full sm:w-auto">
                <label className="text-sm font-medium text-slate-700 whitespace-nowrap">Jenis Gap:</label>
                <select
                  value={selectedGapType}
                  onChange={(e) => setSelectedGapType(e.target.value)}
                  className="w-full sm:w-auto px-3 py-2.5 rounded-lg border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-200 outline-none text-sm bg-white"
                >
                  {GAP_TYPES.map(gap => (
                    <option key={gap.id} value={gap.id}>{gap.name}</option>
                  ))}
                </select>
              </div>
              <button
                onClick={analyzeJournals}
                disabled={loadingAnalysis}
                className="w-full sm:w-auto bg-indigo-600 hover:bg-indigo-700 text-white font-medium py-3 px-6 rounded-xl shadow-md shadow-indigo-600/20 transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
              >
                {loadingAnalysis ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Sparkles className="w-5 h-5" />
                )}
                Analisis Jurnal dengan AI
              </button>
            </div>
          </div>
        </section>

        {/* Step 2: Research Components */}
        <section id="research-form" className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
          <div className="p-6 md:p-8 border-b border-slate-100 bg-slate-50/50">
            <div className="flex items-center gap-3 mb-2">
              <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">2</span>
              <h2 className="text-2xl font-semibold text-slate-800 flex items-center gap-2">
                <Target className="w-6 h-6 text-blue-600" />
                Komponen Penelitian
              </h2>
            </div>
            <p className="text-slate-500 ml-11">Lengkapi komponen di bawah ini. Komponen-komponen ini dapat diisi otomatis dari analisis jurnal di atas.</p>
          </div>

          <div className="p-6 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Topik Penelitian */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Search className="w-4 h-4 text-blue-500" />
                  Topik Penelitian
                </label>
                <textarea
                  name="areaStudi"
                  value={formData.areaStudi}
                  onChange={handleInputChange}
                  onInput={handleTextareaResize}
                  placeholder="Contoh: Pemasaran Digital, Kecerdasan Buatan..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white resize-none overflow-hidden"
                />
                {topikOptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Pilih rekomendasi Topik Penelitian dari AI:</p>
                    <div className="flex flex-wrap gap-2">
                      {topikOptions.map((topik, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFormData(prev => ({ ...prev, areaStudi: topik }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                            formData.areaStudi === topik 
                              ? 'bg-blue-100 border-blue-300 text-blue-800 font-medium' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {topik}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Masalah Nyata */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Target className="w-4 h-4 text-red-500" />
                  Masalah Nyata (Gap Penelitian)
                </label>
                <textarea
                  name="masalahNyata"
                  value={formData.masalahNyata}
                  onChange={handleInputChange}
                  onInput={handleTextareaResize}
                  placeholder="Contoh: Terdapat perbedaan hasil penelitian terdahulu (Edivance Gap)..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white resize-none overflow-hidden"
                />
              </div>

              {/* Tujuan Penelitian */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Target className="w-4 h-4 text-emerald-500" />
                  Tujuan Penelitian
                </label>
                <textarea
                  name="tujuanPenelitian"
                  value={formData.tujuanPenelitian}
                  onChange={handleInputChange}
                  onInput={handleTextareaResize}
                  placeholder="Contoh: Menguji pengaruh X terhadap Y..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white resize-none overflow-hidden"
                />
                {tujuanOptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Pilih rekomendasi Tujuan Penelitian dari AI:</p>
                    <div className="flex flex-wrap gap-2">
                      {tujuanOptions.map((tujuan, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFormData(prev => ({ ...prev, tujuanPenelitian: tujuan }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors text-left ${
                            formData.tujuanPenelitian === tujuan 
                              ? 'bg-emerald-100 border-emerald-300 text-emerald-800 font-medium' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {tujuan}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Metode Penelitian */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Beaker className="w-4 h-4 text-purple-500" />
                  Metode / Pendekatan
                </label>
                <textarea
                  name="metodePenelitian"
                  value={formData.metodePenelitian}
                  onChange={handleInputChange}
                  onInput={handleTextareaResize}
                  placeholder="Contoh: Kuantitatif, Algoritma CNN, Studi Kasus..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white resize-none overflow-hidden"
                />
                {metodeOptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Pilih rekomendasi Metode Penelitian dari AI:</p>
                    <div className="flex flex-wrap gap-2">
                      {metodeOptions.map((metode, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFormData(prev => ({ ...prev, metodePenelitian: metode }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors text-left ${
                            formData.metodePenelitian === metode 
                              ? 'bg-purple-100 border-purple-300 text-purple-800 font-medium' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {metode}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Nilai Kebaruan */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <Lightbulb className="w-4 h-4 text-amber-500" />
                  Nilai Kebaruan (Novelty)
                </label>
                <textarea
                  name="nilaiKebaruan"
                  value={formData.nilaiKebaruan}
                  onChange={handleInputChange}
                  onInput={handleTextareaResize}
                  placeholder="Contoh: Menambahkan variabel moderasi Z..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white resize-none overflow-hidden"
                />
                {kebaruanOptions.length > 0 && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-2">Pilih rekomendasi Nilai Kebaruan dari AI:</p>
                    <div className="flex flex-wrap gap-2">
                      {kebaruanOptions.map((kebaruan, idx) => (
                        <button
                          key={idx}
                          onClick={() => setFormData(prev => ({ ...prev, nilaiKebaruan: kebaruan }))}
                          className={`text-xs px-3 py-1.5 rounded-full border transition-colors text-left ${
                            formData.nilaiKebaruan === kebaruan 
                              ? 'bg-amber-100 border-amber-300 text-amber-800 font-medium' 
                              : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                          }`}
                        >
                          {kebaruan}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Teori Pendukung */}
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-sm font-medium text-slate-700">
                  <FileText className="w-4 h-4 text-indigo-500" />
                  Teori Pendukung
                </label>
                <textarea
                  name="teoriPendukung"
                  value={formData.teoriPendukung}
                  onChange={handleInputChange}
                  onInput={handleTextareaResize}
                  placeholder="Contoh: Technology Acceptance Model (TAM)..."
                  rows={2}
                  className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all bg-slate-50 focus:bg-white resize-none overflow-hidden"
                />
              </div>
            </div>

            <div className="mt-10 flex justify-center">
              <button
                onClick={generateTitles}
                disabled={loadingTitles}
                className="bg-blue-600 hover:bg-blue-700 text-white font-medium py-4 px-8 rounded-xl shadow-lg shadow-blue-600/20 transition-all flex items-center gap-3 disabled:opacity-70 disabled:cursor-not-allowed hover:-translate-y-0.5 active:translate-y-0 w-full md:w-auto justify-center text-lg"
              >
                {loadingTitles ? (
                  <>
                    <Loader2 className="w-6 h-6 animate-spin" />
                    Menganalisis & Membuat Judul...
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-6 h-6" />
                    Generate Judul Penelitian
                  </>
                )}
              </button>
            </div>
          </div>
        </section>

        {/* Step 3: Results Section */}
        {results.length > 0 && (
          <section id="results-section" className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4">
              <div className="flex items-center gap-3">
                <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-600 text-white font-bold text-sm">3</span>
                <div>
                  <h2 className="text-2xl font-bold text-slate-800">Rekomendasi Judul</h2>
                  <p className="text-slate-500">10 variasi judul berdasarkan input Anda.</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={exportToPDF}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-red-600 transition-colors font-medium text-sm shadow-sm"
                >
                  <FileText className="w-4 h-4" />
                  Export PDF
                </button>
                <button
                  onClick={exportToWord}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium text-sm shadow-sm"
                >
                  <FileDown className="w-4 h-4" />
                  Export Word
                </button>
                <button
                  onClick={generateTitles}
                  disabled={loadingTitles}
                  className="flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-colors font-medium text-sm shadow-sm"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingTitles ? 'animate-spin' : ''}`} />
                  Generate Judul Baru
                </button>
              </div>
            </div>

            <div className="grid gap-4">
              {results.map((result, index) => (
                <div 
                  key={index} 
                  className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200 hover:border-blue-300 hover:shadow-md transition-all group"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex flex-wrap items-center gap-3 mb-3">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-sm shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex flex-wrap gap-2">
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getScoreColor(result.scores.clarity)}`}>
                            Kejelasan: {result.scores.clarity}
                          </span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getScoreColor(result.scores.specificity)}`}>
                            Spesifik: {result.scores.specificity}
                          </span>
                          <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getScoreColor(result.scores.strength)}`}>
                            Akademik: {result.scores.strength}
                          </span>
                        </div>
                      </div>
                      <h3 className="text-lg md:text-xl font-semibold text-slate-800 leading-snug pr-8">
                        {result.title}
                      </h3>
                    </div>
                    <button
                      onClick={() => copyToClipboard(result.title, index)}
                      className="p-2.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-colors shrink-0"
                      title="Salin judul"
                    >
                      {copiedIndex === index ? (
                        <Check className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <Copy className="w-5 h-5" />
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
