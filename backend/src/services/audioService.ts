import Groq from 'groq-sdk';
import { Readable } from 'stream';

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

export async function transcreverAudio(audioBuffer: Buffer): Promise<string | null> {
  try {
    console.log('🎙️ Transcrevendo áudio via Groq...');
    
    // Converter Buffer para Readable Stream para o Groq
    const stream = new Readable();
    stream.push(audioBuffer);
    stream.push(null);

    // O Groq espera um objeto File-like ou um stream com propriedades específicas
    // Para simplificar, usamos a API de áudio do Groq
    // Whisper-large-v3 é excelente para português
    const response = await groq.audio.transcriptions.create({
      file: await Groq.toFile(audioBuffer, 'audio.ogg'),
      model: 'whisper-large-v3',
      language: 'pt',
      response_format: 'json'
    });

    console.log('✅ Transcrição concluída:', response.text);
    return response.text;
  } catch (error) {
    console.error('❌ Erro na transcrição Groq:', error);
    return null;
  }
}
