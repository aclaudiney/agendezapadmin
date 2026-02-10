const axios = require('axios');
require('dotenv').config();

const API_KEY = process.env.GEMINI_API_KEY;
const URL = `https://generativelanguage.googleapis.com/v1beta/models?key=${API_KEY}`;

async function listar() {
  try {
    const res = await axios.get(URL);
    console.log("=== MODELOS DISPONÍVEIS NA SUA CHAVE ===");
    res.data.models.forEach(m => {
      console.log("- " + m.name.replace('models/', ''));
    });
  } catch (e) {
    console.error("Erro ao listar:", e.response?.data || e.message);
  }
}
listar();