import React, { useState, useEffect, Suspense, lazy } from 'react';
import { X } from 'lucide-react';

const Login = lazy(() => import('./pages/Login'));
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Appointments = lazy(() => import('./pages/Appointments'));
const Agents = lazy(() => import('./pages/Agents'));
const Services = lazy(() => import('./pages/Services'));
const Professionals = lazy(() => import('./pages/Professionals'));
const Clients = lazy(() => import('./pages/Clients'));
const Settings = lazy(() => import('./pages/Settings'));
const PaginaLoja = lazy(() => import('./pages/PaginaLoja'));
const Financeiro = lazy(() => import('./pages/Financeiro'));
const PublicBooking = lazy(() => import('./pages/PublicBooking'));
const ClientLogin = lazy(() => import('./pages/ClientLogin'));
const ClientDashboard = lazy(() => import('./pages/ClientDashboard'));
const WhatsAppSim = lazy(() => import('./components/WhatsAppSim'));
const WhatsappConfig = lazy(() => import('./pages/WhatsappConfig'));
const FollowUpPage = lazy(() => import('./pages/FollowUpPage'));

// ✅ PÁGINAS ADMIN (COM SIDEBAR!)
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'));
const AdminCRMPage = lazy(() => import('./pages/admin/AdminCRMPage'));

// ✅ LAYOUTS
import AdminLayout from './components/layouts/AdminLayout';
import MainLayout from './components/layouts/MainLayout';
import { Toaster } from 'react-hot-toast';
import { supabase } from './services/supabaseClient';
import { dashboardService } from './services/dashboardService';

// ============================================
// APP PRINCIPAL - ✅ COM SIDEBAR ADMIN
// ============================================
const App: React.FC = () => {
  const [autenticado, setAutenticado] = useState(false);
  const [usuario, setUsuario] = useState<any>(null);
  const [userRole, setUserRole] = useState<'super_admin' | 'empresa' | null>(null);
  const [activePage, setActivePage] = useState('dashboard');
  const [adminActivePage, setAdminActivePage] = useState('dashboard'); // ✅ NOVO!
  const [showTester, setShowTester] = useState(false);
  const [loading, setLoading] = useState(true);
  const [clienteLogado, setClienteLogado] = useState<any>(null);
  const CACHE_TTL_MS = 120000;

  // ✅ CARREGAR DADOS DO LOCALSTORAGE
  useEffect(() => {
    const verificarECarregar = async () => {
      try {
        console.log('🔍 [APP] Verificando autenticação...');

        const usuarioSalvo = localStorage.getItem('usuario');
        const autenticadoSalvo = localStorage.getItem('autenticado');
        const roleStoraged = localStorage.getItem('userRole') as 'super_admin' | 'empresa' | null;

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
      const userRoleFromStorage = localStorage.getItem('userRole') as 'super_admin' | 'empresa' | null;

      if (usuarioSalvo) {
        setUsuario(JSON.parse(usuarioSalvo));
      }
      setAutenticado(true);
      setUserRole(userRoleFromStorage);
    } catch (error) {
      console.error('Erro no login:', error);
    }
  };

  useEffect(() => {
    const prefetchCommonData = async () => {
      try {
        const companyId = localStorage.getItem('companyId');
        if (!companyId) return;
        const now = Date.now();

        const profKey = `cache_profissionais_${companyId}`;
        const servKey = `cache_servicos_${companyId}`;
        const cliKey = `cache_clientes_${companyId}`;
        const dashKey = `cache_dashboard_${companyId}_30_all`;

        const profCache = localStorage.getItem(profKey);
        const servCache = localStorage.getItem(servKey);
        const cliCache = localStorage.getItem(cliKey);
        const dashCache = localStorage.getItem(dashKey);

        const needProfs = !profCache || now - (JSON.parse(profCache).ts || 0) > CACHE_TTL_MS;
        const needServs = !servCache || now - (JSON.parse(servCache).ts || 0) > CACHE_TTL_MS;
        const needClients = !cliCache || now - (JSON.parse(cliCache).ts || 0) > CACHE_TTL_MS;
        const needDash = !dashCache || now - (JSON.parse(dashCache).ts || 0) > CACHE_TTL_MS;

        await Promise.all([
          needProfs
            ? supabase.from('profissionais').select('id, nome, ativo').eq('company_id', companyId).then(res => {
                localStorage.setItem(profKey, JSON.stringify({ ts: now, data: res.data || [] }));
              })
            : Promise.resolve(),
          needServs
            ? supabase.from('servicos').select('id, nome, preco, duracao, ativo').eq('company_id', companyId).then(res => {
                localStorage.setItem(servKey, JSON.stringify({ ts: now, data: res.data || [] }));
              })
            : Promise.resolve(),
          needClients
            ? supabase.from('clientes').select('id, nome, telefone, data_nascimento, ativo').eq('company_id', companyId).then(res => {
                localStorage.setItem(cliKey, JSON.stringify({ ts: now, data: res.data || [] }));
              })
            : Promise.resolve(),
          needDash
            ? dashboardService.fetchDashboardData(companyId, 30).then(data => {
                localStorage.setItem(dashKey, JSON.stringify({ ts: now, data }));
              })
            : Promise.resolve()
        ]);
      } catch {}
    };
    if (autenticado && userRole === 'empresa') {
      prefetchCommonData();
    }
  }, [autenticado, userRole]);

  const handleLogout = () => {
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
      case 'follow-up': return <FollowUpPage />; // ✅ NOVA ROTA
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
    let slug = pathname.replace('/agendar/', '').replace(/^\//, '').replace(/\/$/, '');
    console.log('📱 Abrindo PublicBooking com slug:', slug);
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
        <PublicBooking slug={slug} />
      </Suspense>
    );
  }

  if (pathname === '/login-cliente') {
    if (clienteLogado) {
      window.location.href = '/meu-agendamento';
      return null;
    }
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
        <ClientLogin onLoginSuccess={handleClientLoginSuccess} />
      </Suspense>
    );
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
      return (
        <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
          <ClientDashboard clienteId={clienteData.id} onLogout={handleClientLogout} />
        </Suspense>
      );
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
    return (
      <Suspense fallback={<div className="flex items-center justify-center h-screen"><div className="w-10 h-10 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
        <Login onLoginSuccess={handleLoginSuccess} />
      </Suspense>
    );
  }

  // ✅ ADMIN - COM SIDEBAR!
  if (userRole === 'super_admin') {
    return (
      <>
        <Toaster position="top-right" />
        <AdminLayout
          activePage={adminActivePage}
          onNavigate={setAdminActivePage}
          onLogout={handleLogout}
        >
          <Suspense fallback={<div className="p-6"><div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
            {renderAdminPage()}
          </Suspense>
        </AdminLayout>
      </>
    );
  }

  // ✅ EMPRESA - DASHBOARD NORMAL
  if (userRole === 'empresa') {
    return (
      <>
        <Toaster position="top-right" />
        <MainLayout
          activePage={activePage}
          onNavigate={setActivePage}
          onLogout={handleLogout}
        >
        <div className="flex justify-between items-center mb-8 pb-6 border-b border-slate-200">
          <div>
            <h1 className="text-3xl font-bold text-slate-800">{usuario?.nome_estabelecimento || 'Estabelecimento'}</h1>
            <p className="text-slate-500 text-sm">Logado como: {usuario?.email}</p>
          </div>
        </div>

        <div className="max-w-6xl mx-auto">
          <Suspense fallback={<div className="p-6"><div className="w-8 h-8 border-4 border-slate-200 border-t-indigo-600 rounded-full animate-spin"></div></div>}>
            {renderPage()}
          </Suspense>
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
      </MainLayout>
      </>
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
