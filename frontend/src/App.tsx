import React, { useState, useEffect } from 'react';
import { X, LogOut } from 'lucide-react';

// ✅ PÁGINAS ANTIGAS
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
import WhatsappConfig from './pages/WhatsappConfig';

// ✅ PÁGINA ADMIN (NOVO)
import AdminDashboard from './pages/admin/AdminDashboard';

// ============================================
// APP PRINCIPAL
// ============================================
const App: React.FC = () => {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'empresa' | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [showTester, setShowTester] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clienteLogado, setClienteLogado] = useState<any>(null);

  // ✅ CARREGAR DADOS DO LOCALSTORAGE UMA ÚNICA VEZ
  useEffect(() => {
    try {
      const usuarioSalvo = localStorage.getItem('usuario');
      const autenticadoSalvo = localStorage.getItem('autenticado');
      const roleStoraged = localStorage.getItem('userRole') as 'admin' | 'empresa' | null;

      if (usuarioSalvo && autenticadoSalvo === 'true') {
        setUsuario(JSON.parse(usuarioSalvo));
        setAutenticado(true);
        setUserRole(roleStoraged);
      }

      const clienteSalvo = localStorage.getItem('clienteLogado');
      if (clienteSalvo) {
        setClienteLogado(JSON.parse(clienteSalvo));
      }
    } catch (error) {
      console.error('Erro ao carregar dados:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  const handleLoginSuccess = () => {
    try {
      const usuarioSalvo = localStorage.getItem('usuario');
      const userRoleFromStorage = localStorage.getItem('userRole') as 'admin' | 'empresa' | null;
      
      if (usuarioSalvo) {
        setUsuario(JSON.parse(usuarioSalvo));
      }
      setAutenticado(true);
      setUserRole(userRoleFromStorage);
    } catch (error) {
      console.error('Erro no login:', error);
    }
  };

  const handleAdminLogout = () => {
    localStorage.removeItem('usuario');
    localStorage.removeItem('autenticado');
    localStorage.removeItem('userRole');
    localStorage.removeItem('companyId');
    setAutenticado(false);
    setUsuario(null);
    setUserRole(null);
    setActivePage('dashboard');
  };

  const handleClientLoginSuccess = (clienteId: string, nome: string, telefone: string, email: string) => {
    setClienteLogado({ id: clienteId, nome, telefone, email });
    window.location.href = '/meu-agendamento';
  };

  const handleClientLogout = () => {
    localStorage.removeItem('clienteLogado');
    setClienteLogado(null);
    window.location.href = '/login-cliente';
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
      case 'whatsapp': return <WhatsappConfig />;
      case 'settings': return <Settings />;
      default: return <Dashboard />;
    }
  };

  // ✅ MOSTRAR CARREGAMENTO
  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <p className="text-slate-500">Carregando...</p>
      </div>
    );
  }

  // ✅ OBTER PATHNAME
  const pathname = window.location.pathname;

  // ============================================
  // 🔴 VERIFICAR ROTAS PÚBLICAS PRIMEIRO!
  // ============================================

  // ✅ DETECTAR ROTA PÚBLICA: /studio-takata, /agendar/studio-takata, etc
  // ✅ EXCLUIR ROTAS ADMINISTRATIVAS: /dashboard, /admin/dashboard, /login, /login-cliente, /meu-agendamento, etc
  const isPublicBooking = pathname.startsWith('/agendar/') || 
                          (pathname !== '/' && 
                           pathname !== '/login' && 
                           pathname !== '/login-cliente' && 
                           pathname !== '/meu-agendamento' && 
                           pathname !== '/admin/dashboard' &&
                           pathname !== '/dashboard' &&
                           /^\/[a-z0-9-]+$/.test(pathname));

  if (isPublicBooking) {
    let slug = pathname.replace('/agendar/', '').replace(/^\//,'').replace(/\/$/,'');
    console.log('📱 Abrindo PublicBooking com slug:', slug);
    return <PublicBooking slug={slug} />;
  }

  // ✅ ROTA: /login-cliente
  if (pathname === '/login-cliente') {
    if (clienteLogado) {
      window.location.href = '/meu-agendamento';
      return null;
    }
    return <ClientLogin onLoginSuccess={handleClientLoginSuccess} />;
  }

  // ✅ ROTA: /meu-agendamento
  if (pathname === '/meu-agendamento') {
    const clienteSalvo = localStorage.getItem('clienteLogado');
    
    if (!clienteSalvo) {
      // Não tem cliente no localStorage, redireciona para login
      console.warn('❌ Sem cliente no localStorage, redirecionando para login');
      window.location.href = '/login-cliente';
      return null;
    }

    try {
      const clienteData = JSON.parse(clienteSalvo);
      console.log('✅ ClientDashboard carregando com cliente:', clienteData.nome);
      return <ClientDashboard clienteId={clienteData.id} onLogout={handleClientLogout} />;
    } catch (error) {
      console.error('Erro ao parsear cliente:', error);
      window.location.href = '/login-cliente';
      return null;
    }
  }

  // ============================================
  // 🔐 DEPOIS VERIFICAR AUTENTICAÇÃO
  // ============================================

  // ✅ NÃO AUTENTICADO - MOSTRAR LOGIN
  if (!autenticado) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // ✅ ADMIN - MOSTRAR ADMIN DASHBOARD
  if (userRole === 'admin' && pathname === '/admin/dashboard') {
    return (
      <div className="flex min-h-screen">
        <div className="flex-1 p-8 bg-slate-50">
          <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200">
            <div>
              <h1 className="text-3xl font-bold text-slate-800">AgendeZap Admin</h1>
              <p className="text-slate-500 text-sm">Painel de controle do sistema</p>
            </div>
            <button
              onClick={handleAdminLogout}
              className="flex items-center gap-2 bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-colors"
            >
              <LogOut size={18} />
              <span>Sair</span>
            </button>
          </div>

          <div className="max-w-7xl mx-auto">
            <AdminDashboard />
          </div>
        </div>
      </div>
    );
  }

  // ✅ EMPRESA - MOSTRAR DASHBOARD EMPRESA
  if (userRole === 'empresa') {
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
  }

  // ✅ FALLBACK - REDIRECIONAR
  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <p className="text-slate-500">Redirecionando...</p>
    </div>
  );
};

export default App;
