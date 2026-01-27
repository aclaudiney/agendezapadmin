import React, { useState, useEffect } from 'react';
import { QrCode, MessageSquare, CheckCircle2, RefreshCw, LogOut } from 'lucide-react';

// CONFIGURAÇÃO AUTOMÁTICA:
// 1. Na Vercel: vai ler a variável VITE_API_URL que você configurou.
// 2. No seu PC: como a variável não existe localmente, ele usará o localhost:3001.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const WhatsappConfig: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'disconnected' | 'connected'>('loading');
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  // Função para verificar o status do WhatsApp
  const checkStatus = async () => {
    try {
      const response = await fetch(`${API_URL}/whatsapp/status`);
      const data = await response.json();
      
      setStatus(data.status);
      
      if (data.status === 'connected') {
        setQrCode(null);
        setShowQR(false);
      } else {
        setQrCode(data.qr);
      }
    } catch (error) {
      console.error("Erro ao conectar com o servidor:", error);
      setStatus('disconnected');
    }
  };

  // Função para simular o carregamento ao clicar no botão
  const handleGenerateClick = () => {
    setLoading(true);
    setShowQR(true);
    setTimeout(() => setLoading(false), 1500);
  };

  // Função para desconectar o WhatsApp
  const handleLogout = async () => {
    if (!window.confirm("Deseja desconectar o WhatsApp?")) return;
    try {
      await fetch(`${API_URL}/whatsapp/logout`, { method: 'POST' });
      setShowQR(false);
      setQrCode(null);
      await checkStatus();
    } catch (error) {
      alert("Erro ao desconectar o dispositivo.");
    }
  };

  // Monitoramento constante do status (a cada 3 segundos)
  useEffect(() => {
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">WhatsApp</h2>
        <p className="text-slate-500">Conecte seu aparelho para automatizar seus agendamentos</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card de Status da Conexão */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-6">Status da Conexão</h3>
            
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
              <div className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                {status === 'connected' ? 'Dispositivo Conectado' : 'Aguardando Conexão'}
              </span>
            </div>
          </div>

          <div className="mt-8">
            {status === 'connected' ? (
              <button 
                onClick={handleLogout}
                className="w-full py-4 bg-red-50 text-red-600 hover:bg-red-100 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 border border-red-100"
              >
                <LogOut size={20} /> Desconectar WhatsApp
              </button>
            ) : (
              <button 
                onClick={handleGenerateClick}
                disabled={showQR || loading}
                className={`w-full py-4 rounded-2xl font-bold transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100 ${
                  showQR ? 'bg-slate-100 text-slate-400 cursor-not-allowed' : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {loading ? <RefreshCw className="animate-spin" size={20} /> : <QrCode size={20} />}
                {showQR ? 'QR Code Gerado' : 'Gerar Novo QR Code'}
              </button>
            )}
          </div>
        </div>

        {/* Card do QR Code / Status de Sucesso */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[350px]">
          {status === 'connected' ? (
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-800">Tudo pronto!</h4>
                <p className="text-slate-500 mt-2">Seu robô de mensagens está operando normalmente.</p>
              </div>
            </div>
          ) : showQR ? (
            <div className="text-center w-full animate-in zoom-in-95 duration-300">
              <div className="bg-slate-50 p-6 rounded-3xl inline-block border border-slate-100 shadow-inner">
                {qrCode ? (
                  <img src={qrCode} alt="WhatsApp QR Code" className="w-64 h-64 rounded-xl shadow-sm" />
                ) : (
                  <div className="w-64 h-64 flex flex-col items-center justify-center gap-3">
                    <RefreshCw className="animate-spin text-indigo-500" size={40} />
                    <p className="text-sm text-slate-400 font-medium">Gerando código...</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-6 font-medium italic">Escaneie com o WhatsApp do seu celular</p>
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">Clique no botão ao lado para<br/>exibir o QR Code de conexão.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsappConfig;