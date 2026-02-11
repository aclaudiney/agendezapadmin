/**
 * AUDIO SERVICE - AGENDEZAP
 * Converte áudio do WhatsApp para texto usando Groq Whisper API
 */

import axios from 'axios';
import FormData from 'form-data';
import fs from 'fs';
import path from 'path';

// ============================================
// 1️⃣ CONVERTER ÁUDIO PARA TEXTO (GROQ WHISPER)
// ============================================

export const converterAudioParaTexto = async (
  audioPath: string
): Promise<{ sucesso: boolean; texto?: string; erro?: string }> => {
  try {
    console.log(`🎙️ [AUDIO] Convertendo áudio para texto...`);
    console.log(`   Arquivo: ${audioPath}`);

    // Verificar se arquivo existe
    if (!fs.existsSync(audioPath)) {
      console.error(`❌ [AUDIO] Arquivo não encontrado: ${audioPath}`);
      return {
        sucesso: false,
        erro: 'Arquivo de áudio não encontrado'
      };
    }

    // Preparar FormData
    const formData = new FormData();
    formData.append('file', fs.createReadStream(audioPath));
    formData.append('model', 'whisper-large-v3'); // Modelo Groq Whisper
    formData.append('language', 'pt'); // Português
    formData.append('response_format', 'json');

    console.log(`   🔄 Chamando Groq API...`);

    // Chamar Groq API
    const response = await axios.post(
      'https://api.groq.com/openai/v1/audio/transcriptions',
      formData,
      {
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          ...formData.getHeaders()
        },
        timeout: 30000 // 30 segundos
      }
    );

    const texto = (response.data as any)?.text;

    if (!texto) {
      console.error(`❌ [AUDIO] Resposta vazia da API`);
      return {
        sucesso: false,
        erro: 'Não foi possível transcrever o áudio'
      };
    }

    console.log(`   ✅ Texto transcrito: "${texto.substring(0, 50)}..."`);

    // Deletar arquivo temporário
    try {
      fs.unlinkSync(audioPath);
      console.log(`   🗑️ Arquivo temporário deletado`);
    } catch (e) {
      console.log(`   ⚠️ Não foi possível deletar arquivo temporário`);
    }

    return {
      sucesso: true,
      texto: texto.trim()
    };

  } catch (error: any) {
    console.error(`❌ [AUDIO] Erro ao converter:`, error.message);

    // Tentar deletar arquivo mesmo em caso de erro
    try {
      if (fs.existsSync(audioPath)) {
        fs.unlinkSync(audioPath);
      }
    } catch (e) {
      // Ignore
    }

    return {
      sucesso: false,
      erro: error.message || 'Erro ao processar áudio'
    };
  }
};

// ============================================
// 2️⃣ VALIDAR CHAVE API GROQ
// ============================================

export const validarGroqAPI = (): boolean => {
  if (!process.env.GROQ_API_KEY) {
    console.error(`❌ [AUDIO] GROQ_API_KEY não configurada no .env`);
    return false;
  }

  console.log(`✅ [AUDIO] GROQ_API_KEY configurada`);
  return true;
};
