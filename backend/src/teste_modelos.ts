import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

const API_KEY = process.env.GEMINI_API_KEY || "";

async function listarModelos() {
    console.log("🔍 Consultando modelos disponíveis no seu plano...");
    
    // Testamos na v1beta que é onde os modelos novos (como 2.0) costumam aparecer primeiro
    const url = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

    try {
        const response = await axios.get(url);
        const modelos = (response.data as any)?.models || [];

        console.log("\n✅ Modelos encontrados:");
        modelos.forEach((m: any) => {
            console.log(`- Nome: ${m.name}`);
            console.log(`  Métodos: ${m.supportedGenerationMethods.join(', ')}`);
            console.log(`  Versão: ${m.version}\n`);
        });

        console.log("--- FIM DA LISTA ---");
        console.log("Dica: Use o nome completo que aparece acima (ex: models/gemini-1.5-flash)");

    } catch (error: any) {
        console.error("❌ Erro ao listar modelos:", error.response?.data || error.message);
    }
}

listarModelos();
