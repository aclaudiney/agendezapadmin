import React, { useState, useEffect } from 'react';
import Login from './pages/Login';
import Sidebar from './components/Sidebar';
import Dashboard from './pages/Dashboard';
import Appointments from './pages/Appointments';
import Agents from './pages/Agents';
import Services from './pages/Services';
import Professionals from './pages/Professionals';
import Clients from './pages/Clients';
import Settings from './pages/Settings';
import PaginaLoja from './pages/PaginaLoja';
import Financeiro from './pages/Financeiro';
import PublicBooking from './pages/PublicBooking';
import ClientLogin from './pages/ClientLogin';
import ClientDashboard from './pages/ClientDashboard';
import WhatsAppSim from './components/WhatsAppSim';
import WhatsappConfig from './pages/WhatsappConfig'; // <-- Nova página importada
import { X, LogOut } from 'lucide-react';

const App: React.FC = () => {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [showTester, setShowTester] = useState(false);
  const [loading, setLoading] = useState(true);
  
  const [clienteLogado, setClienteLogado] = useState<any>(null);

  const isPublicPage = window.location.pathname === '/agendar';
  const isClientDashboard = window.location.pathname === '/meu-agendamento';
  const isClientLogin = window.location.pathname === '/login-cliente';

  useEffect(() => {
    const usuarioSalvo = localStorage.getItem('usuario');
    const autenticadoSalvo = localStorage.getItem('autenticado');

    if (usuarioSalvo && autenticadoSalvo === 'true') {
      setUsuario(JSON.parse(usuarioSalvo));
      setAutenticado(true);
    }

    const clienteSalvo = localStorage.getItem('clienteLogado');
    if (clienteSalvo) {
      setClienteLogado(JSON.parse(clienteSalvo));
    }

    setLoading(false);
  }, []);

  const handleLoginSuccess = () => {
    const usuarioSalvo = localStorage.getItem('usuario');
    if (usuarioSalvo) {
      setUsuario(JSON.parse(usuarioSalvo));
    }
    setAutenticado(true);
  };

  const handleClientLoginSuccess = (clienteId: string, nome: string, telefone: string, email: string) => {
    setClienteLogado({ id: clienteId, nome, telefone, email });
    window.location.pathname = '/meu-agendamento';
  };

  const handleClientLogout = () => {
    localStorage.removeItem('clienteLogado');
    setClienteLogado(null);
    window.location.pathname = '/login-cliente';
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('usuario');
    localStorage.removeItem('autenticado');
    setAutenticado(false);
    setUsuario(null);
    setActivePage('dashboard');
  };

  const renderPage = () => {
    switch (activePage) {
      case 'dashboard': return <Dashboard />;
      case 'appointments': return <Appointments />;
      case 'agents': return <Agents />;
      case 'services': return <Services />;
      case 'professionals': return <Professionals />;
      case 'clients': return <Clients />;
      case 'pagina-loja': return <PaginaLoja />;
      case 'financeiro': return <Financeiro />;
      case 'whatsapp': return <WhatsappConfig />; // <-- Rota atualizada para a página de conexão
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-slate-500">Carregando...</p>
      </div>
    );
  }

  if (isPublicPage) {
    return <PublicBooking />;
  }

  if (isClientLogin) {
    if (clienteLogado) {
      window.location.pathname = '/meu-agendamento';
      return null;
    }
    return <ClientLogin onLoginSuccess={handleClientLoginSuccess} />;
  }

  if (isClientDashboard) {
    if (!clienteLogado) {
      window.location.pathname = '/login-cliente';
      return null;
    }
    return <ClientDashboard clienteId={clienteLogado.id} onLogout={handleClientLogout} />;
  }

  if (!autenticado) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  return (
    <div className="flex min-h-screen">
      <Sidebar 
        activePage={activePage} 
        onNavigate={setActivePage}
        onShowTester={() => setShowTester(true)}
      />
      
      <main className="flex-1 p-8 bg-slate-50 relative">
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{usuario?.nome_estabelecimento || 'Estabelecimento'}</h1>
            <p className="text-slate-500 text-sm">Logado como: {usuario?.email}</p>
          </div>
          <button
            onClick={handleAdminLogout}
            className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
          >
            <LogOut size={18} />
            <span>Sair</span>
          </button>
        </div>

        <div className="max-w-6xl mx-auto">
          {renderPage()}
        </div>

        {showTester && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-300">
            <div className="relative w-full max-w-md">
              <button 
                onClick={() => setShowTester(false)}
                className="absolute -top-12 right-0 text-white hover:text-slate-200"
              >
                <X size={32} />
              </button>
              <WhatsAppSim />
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;