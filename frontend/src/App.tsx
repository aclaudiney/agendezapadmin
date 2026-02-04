import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

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

// ✅ PÁGINAS ADMIN (COM SIDEBAR!)
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminCRMPage from './pages/admin/AdminCRMPage';
import AdminSidebar from './components/AdminSidebar'; // ✅ NOVO!

// ============================================
// APP PRINCIPAL - ✅ COM SIDEBAR ADMIN
// ============================================
const App: React.FC = () => {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [userRole, setUserRole] = useState<'admin' | 'empresa' | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [adminActivePage, setAdminActivePage] = useState('dashboard'); // ✅ NOVO!
  const [showTester, setShowTester] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clienteLogado, setClienteLogado] = useState<any>(null);

  // ✅ CARREGAR DADOS DO LOCALSTORAGE
  useEffect(() => {
    const verificarECarregar = async () => {
      try {
        console.log('🔍 [APP] Verificando autenticação...');

        const usuarioSalvo = localStorage.getItem('usuario');
        const autenticadoSalvo = localStorage.getItem('autenticado');
        const roleStoraged = localStorage.getItem('userRole') as 'admin' | 'empresa' | null;

        if (usuarioSalvo && autenticadoSalvo === 'true') {
          try {
            const usuario = JSON.parse(usuarioSalvo);
            
            if (usuario && usuario.email && roleStoraged) {
              console.log('✅ [APP] Sessão válida encontrada');
              setUsuario(usuario);
              setAutenticado(true);
              setUserRole(roleStoraged);
            } else {
              console.warn('⚠️ [APP] Dados incompletos - limpando...');
              localStorage.clear();
            }
          } catch (parseError) {
            console.error('❌ [APP] Erro ao parsear usuário - limpando cache');
            localStorage.clear();
          }
        }

        const clienteSalvo = localStorage.getItem('clienteLogado');
        if (clienteSalvo) {
          try {
            setClienteLogado(JSON.parse(clienteSalvo));
          } catch (e) {
            console.error('❌ [APP] Erro ao parsear cliente');
            localStorage.removeItem('clienteLogado');
          }
        }
      } catch (error) {
        console.error('❌ [APP] Erro crítico ao carregar dados:', error);
        localStorage.clear();
      } finally {
        setLoading(false);
      }
    };

    verificarECarregar();
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
    setAdminActivePage('dashboard');
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

  // ✅ RENDERIZAR PÁGINA DE EMPRESA
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

  // ✅ RENDERIZAR PÁGINA DE ADMIN (NOVO!)
  const renderAdminPage = () => {
    switch (adminActivePage) {
      case 'dashboard':
      case 'empresas':
        return <AdminDashboard />;
      case 'crm':
        return <AdminCRMPage />;
      default:
        return (
          <div className="flex items-center justify-center h-96">
            <div className="text-center">
              <p className="text-2xl font-bold text-slate-800 mb-2">Em breve!</p>
              <p className="text-slate-600">Esta funcionalidade está em desenvolvimento</p>
            </div>
          </div>
        );
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-slate-50">
        <div className="text-center">
          <div className="inline-block w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
          <p className="text-slate-500">Carregando...</p>
        </div>
      </div>
    );
  }

  const pathname = window.location.pathname;

  // ============================================
  // ROTAS PÚBLICAS
  // ============================================

  const isPublicBooking = pathname.startsWith('/agendar/') || 
                          (pathname !== '/' && 
                           pathname !== '/login' && 
                           pathname !== '/login-cliente' && 
                           pathname !== '/meu-agendamento' && 
                           pathname !== '/admin/dashboard' &&
                           pathname !== '/admin/crm' &&
                           pathname !== '/dashboard' &&
                           /^\/[a-z0-9-]+$/.test(pathname));

  if (isPublicBooking) {
    let slug = pathname.replace('/agendar/', '').replace(/^\//,'').replace(/\/$/,'');
    console.log('📱 Abrindo PublicBooking com slug:', slug);
    return <PublicBooking slug={slug} />;
  }

  if (pathname === '/login-cliente') {
    if (clienteLogado) {
      window.location.href = '/meu-agendamento';
      return null;
    }
    return <ClientLogin onLoginSuccess={handleClientLoginSuccess} />;
  }

  if (pathname === '/meu-agendamento') {
    const clienteSalvo = localStorage.getItem('clienteLogado');
    
    if (!clienteSalvo) {
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
  // AUTENTICAÇÃO
  // ============================================

  if (!autenticado) {
    return <Login onLoginSuccess={handleLoginSuccess} />;
  }

  // ✅ ADMIN - COM SIDEBAR!
  if (userRole === 'admin') {
    return (
      <div className="flex min-h-screen bg-slate-50">
        {/* ✅ SIDEBAR ADMIN */}
        <AdminSidebar 
          activePage={adminActivePage}
          onNavigate={setAdminActivePage}
          onLogout={handleAdminLogout}
        />

        {/* ✅ CONTEÚDO PRINCIPAL */}
        <main className="flex-1 overflow-y-auto">
          <div className="p-8">
            {renderAdminPage()}
          </div>
        </main>
      </div>
    );
  }

  // ✅ EMPRESA - DASHBOARD NORMAL
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

  // ============================================
  // FALLBACK
  // ============================================
  console.error('🚨 [APP] Estado inválido detectado - limpando cache');
  localStorage.clear();
  sessionStorage.clear();

  setTimeout(() => {
    window.location.href = '/login';
  }, 100);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-50">
      <div className="text-center">
        <div className="inline-block w-12 h-12 border-4 border-slate-200 border-t-blue-500 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500">Limpando cache e redirecionando...</p>
      </div>
    </div>
  );
};

export default App;