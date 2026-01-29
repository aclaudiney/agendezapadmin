// ✅ DETECTA AUTOMATICAMENTE O AMBIENTE
const getApiUrl = (): string => {
  // 1️⃣ Usa variável de ambiente se existir (Vercel/Produção)
  if (import.meta.env.VITE_API_URL) {
    console.log('🌐 Usando API URL da Vercel:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }

  // 2️⃣ Se estiver em localhost (desenvolvimento), usa localhost
  if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    console.log('💻 Ambiente LOCAL - usando localhost:3001');
    return 'http://localhost:3001';
  }

  // 3️⃣ Se nenhuma das acima, tenta URL padrão de produção
  console.warn('⚠️ Nenhuma configuração de API encontrada, usando fallback');
  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();

// ✅ LOG PARA DEBUG
console.log('📡 API configurada para:', API_URL);
console.log('🏠 Hostname atual:', window.location.hostname);
console.log('🌍 Environment:', import.meta.env.MODE);