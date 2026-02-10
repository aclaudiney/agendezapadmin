import React, { useState, useEffect } from 'react';
import { API_URL } from '../config/api';
import { QrCode, MessageSquare, CheckCircle2, RefreshCw, LogOut } from 'lucide-react';

const WhatsappConfig: React.FC = () => {
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [status, setStatus] = useState<'loading' | 'disconnected' | 'connecting' | 'connected'>('loading');
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  // ✅ PEGAR COMPANY_ID DO LOCALSTORAGE
  useEffect(() => {
    const storedCompanyId = localStorage.getItem('companyId');
    console.log('📱 Company ID do localStorage:', storedCompanyId);
    
    if (!storedCompanyId) {
      setErro('❌ Company ID não encontrado. Faça login novamente.');
      setStatus('disconnected');
      return;
    }
    
    setCompanyId(storedCompanyId);
  }, []);

  // 🔄 Função para verificar o status da instância específica
  const checkStatus = async () => {
    if (!companyId) return;
    
    try {
      const response = await fetch(`${API_URL}/whatsapp/status/${companyId}`);
      const data = await response.json();
      
      console.log('📊 Status retornado:', data);
      setStatus(data.status || 'disconnected');
      
      if (data.status === 'connected') {
        setQrCode(null);
        setShowQR(false);
      } else if (data.qr) {
        setQrCode(data.qr);
      }
    } catch (error) {
      console.error("❌ Erro ao conectar com o servidor:", error);
      setStatus('disconnected');
    }
  };

  // 🚀 Inicia a conexão da instância no Backend
  const handleGenerateClick = async () => {
    if (!companyId) {
      setErro('Company ID não encontrado');
      return;
    }

    setLoading(true);
    setShowQR(true);
    setErro(null);
    
    try {
      console.log('🚀 Iniciando conexão para company_id:', companyId);
      
      // Avisa o backend para iniciar o processo para este cliente
      const response = await fetch(`${API_URL}/whatsapp/connect/${companyId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('✅ Resposta do backend:', data);
      
      // Dá um pequeno delay para o backend começar a gerar o QR
      setTimeout(checkStatus, 2000);
    } catch (error) {
      console.error("❌ Erro ao iniciar conexão:", error);
      setErro("Erro ao contatar o servidor.");
    } finally {
      setLoading(false);
    }
  };

  // 🚪 Desconecta e limpa a sessão desta empresa
  const handleLogout = async () => {
    if (!companyId) {
      setErro('Company ID não encontrado');
      return;
    }

    if (!window.confirm("Deseja desconectar o WhatsApp?")) return;
    
    try {
      const response = await fetch(`${API_URL}/whatsapp/logout/${companyId}`, { 
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });
      
      const data = await response.json();
      console.log('✅ Logout:', data);
      
      setShowQR(false);
      setQrCode(null);
      await checkStatus();
    } catch (error) {
      setErro("Erro ao desconectar o dispositivo.");
      console.error(error);
    }
  };

  // Monitoramento constante (polling)
  useEffect(() => {
    if (!companyId) return;
    
    checkStatus();
    const interval = setInterval(checkStatus, 3000);
    return () => clearInterval(interval);
  }, [companyId]);

  if (!companyId) {
    return (
      <div className="animate-in fade-in duration-500">
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-slate-800">WhatsApp</h2>
          <p className="text-slate-500">Conecte o aparelho da empresa</p>
        </div>
        <div className="bg-white border border-red-200 rounded-3xl p-8 shadow-sm">
          <div className="text-center text-red-600">
            <p className="font-bold">❌ {erro}</p>
            <p className="text-sm mt-2">Faça login novamente para continuar</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-in fade-in duration-500">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-slate-800">WhatsApp</h2>
        <p className="text-slate-500">Conecte o aparelho da empresa: <strong>{companyId}</strong></p>
      </div>

      {erro && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-sm text-red-700">{erro}</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Card de Status */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="text-lg font-semibold text-slate-700 mb-6">Status da Conexão</h3>
            
            <div className="inline-flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
              <div className={`w-2.5 h-2.5 rounded-full ${status === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`} />
              <span className="text-sm font-bold text-slate-700 uppercase tracking-wider">
                {status === 'connected' ? 'Dispositivo Conectado' : 
                 status === 'connecting' ? 'Iniciando...' : 'Aguardando Conexão'}
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
                {showQR ? 'Instância Iniciada' : 'Gerar Novo QR Code'}
              </button>
            )}
          </div>
        </div>

        {/* Card do QR Code */}
        <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col items-center justify-center min-h-[350px]">
          {status === 'connected' ? (
            <div className="text-center space-y-4">
              <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center mx-auto border border-green-100">
                <CheckCircle2 size={48} className="text-green-500" />
              </div>
              <div>
                <h4 className="text-xl font-bold text-slate-800">Tudo pronto!</h4>
                <p className="text-slate-500 mt-2">O robô está online.</p>
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
                    <p className="text-sm text-slate-400 font-medium">Aguardando QR Code...</p>
                  </div>
                )}
              </div>
              <p className="text-sm text-slate-400 mt-6 font-medium italic">Escaneie com o WhatsApp da empresa</p>
            </div>
          ) : (
            <div className="text-center text-slate-400">
              <MessageSquare size={64} className="mx-auto mb-4 opacity-20" />
              <p className="font-medium">Clique para conectar a instância</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default WhatsappConfig;