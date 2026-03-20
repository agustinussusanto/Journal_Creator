import { GoogleGenAI } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function analyzeJournal(journalText: string) {
  const model = "gemini-3.1-pro-preview";
  
  const systemInstruction = `
    Anda adalah seorang ahli akademik dan peneliti senior. 
    Tugas Anda adalah melakukan sintesis dan evaluasi kritis terhadap teks jurnal yang diberikan berdasarkan Research Model Canvas (RMC).
    
    Research Model Canvas (RMC) mencakup:
    1. Masalah Penelitian (Research Problem)
    2. Pertanyaan Penelitian (Research Question)
    3. Kerangka Teoretis (Theoretical Framework)
    4. Metodologi (Methodology)
    5. Pengumpulan Data (Data Collection)
    6. Analisis Data (Data Analysis)
    7. Kontribusi/Hasil yang Diharapkan (Expected Contribution/Results)

    ATURAN OUTPUT:
    - Tuliskan dalam Bahasa Indonesia yang formal namun mengalir dan enak dibaca.
    - Gunakan format PARAGRAF yang terstruktur dengan baik.
    - JANGAN gunakan tabel, garis pembatas, atau poin-poin yang kaku.
    - Buat narasi yang menyatukan elemen-elemen RMC tersebut menjadi satu kesatuan pemikiran.
    - Berikan evaluasi kritis di bagian akhir mengenai kekuatan dan kelemahan penelitian tersebut.
    - Pastikan tulisan mudah dipahami oleh pembaca akademik maupun umum.
  `;

  const prompt = `
    Berikut adalah teks jurnal yang perlu dianalisis:
    
    ${journalText}
    
    Silakan buat sintesis dan evaluasi kritisnya berdasarkan Research Model Canvas dalam bentuk paragraf yang rapi.
  `;

  try {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }],
      config: {
        systemInstruction,
        temperature: 0.7,
      },
    });

    return response.text || "Gagal menghasilkan analisis.";
  } catch (error) {
    console.error("Gemini API Error:", error);
    throw new Error("Terjadi kesalahan saat menganalisis jurnal.");
  }
}
