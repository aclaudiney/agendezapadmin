// ✅ DETECTA AUTOMATICAMENTE O AMBIENTE
const getApiUrl = (): string => {
  const isLocal = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

  // 1️⃣ Se estiver em localhost, SEMPRE tenta falar com o backend local primeiro
  if (isLocal) {
    console.log('💻 Ambiente LOCAL detectado - Priorizando localhost:3001');
    return 'http://localhost:3001';
  }

  // 2️⃣ Se não for local, usa a variável de ambiente (Produção)
  if (import.meta.env.VITE_API_URL) {
    console.log('🌐 Usando API URL de Produção:', import.meta.env.VITE_API_URL);
    return import.meta.env.VITE_API_URL;
  }

  return 'http://localhost:3001';
};

export const API_URL = getApiUrl();

// ✅ LOG PARA DEBUG
console.log('📡 API configurada para:', API_URL);
console.log('🏠 Hostname atual:', window.location.hostname);
console.log('🌍 Environment:', import.meta.env.MODE);