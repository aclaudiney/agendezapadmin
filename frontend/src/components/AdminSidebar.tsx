/**
 * ADMIN SIDEBAR - AGENDEZAP
 * Barra lateral de navegação do SuperAdmin
 */

import React from 'react';
import { 
  LayoutDashboard, 
  Building2, 
  MessageSquare, 
  Settings,
  BarChart3,
  Users,
  LogOut
} from 'lucide-react';

interface AdminSidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onLogout: () => void;
}

function AdminSidebar({ activePage, onNavigate, onLogout }: AdminSidebarProps) {
  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
      description: 'Visão geral'
    },
    {
      id: 'empresas',
      label: 'Empresas',
      icon: Building2,
      description: 'Gerenciar empresas'
    },
    {
      id: 'crm',
      label: 'CRM',
      icon: MessageSquare,
      description: 'Conversas WhatsApp',
      badge: 'NOVO'
    },
    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
      description: 'Estatísticas gerais',
      disabled: true
    },
    {
      id: 'usuarios',
      label: 'Usuários',
      icon: Users,
      description: 'Gerenciar usuários',
      disabled: true
    },
    {
      id: 'configuracoes',
      label: 'Configurações',
      icon: Settings,
      description: 'Sistema',
      disabled: true
    }
  ];

  return (
    <div className="w-72 bg-gradient-to-b from-slate-900 to-slate-800 text-white h-screen flex flex-col shadow-2xl">
      {/* Header */}
      <div className="p-6 border-b border-slate-700">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-xl flex items-center justify-center shadow-lg">
            <LayoutDashboard size={24} className="text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold">AgendeZap</h1>
            <p className="text-xs text-slate-400">SuperAdmin</p>
          </div>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <div className="space-y-1">
          {menuItems.map((item) => {
            const Icon = item.icon;
            const isActive = activePage === item.id;
            const isDisabled = item.disabled;

            return (
              <button
                key={item.id}
                onClick={() => !isDisabled && onNavigate(item.id)}
                disabled={isDisabled}
                className={`
                  w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all duration-200
                  ${isActive 
                    ? 'bg-gradient-to-r from-blue-600 to-purple-600 shadow-lg scale-105' 
                    : isDisabled
                      ? 'text-slate-500 cursor-not-allowed opacity-50'
                      : 'hover:bg-slate-700/50 hover:scale-102'
                  }
                `}
              >
                <Icon size={20} className={isActive ? 'text-white' : ''} />
                <div className="flex-1 text-left">
                  <p className={`text-sm font-medium ${isActive ? 'text-white' : ''}`}>
                    {item.label}
                  </p>
                  <p className={`text-xs ${isActive ? 'text-blue-100' : 'text-slate-400'}`}>
                    {item.description}
                  </p>
                </div>
                {item.badge && (
                  <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded">
                    {item.badge}
                  </span>
                )}
                {isDisabled && (
                  <span className="px-2 py-0.5 bg-slate-600 text-slate-400 text-xs rounded">
                    Em breve
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-700">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-4 py-3 rounded-lg bg-red-600 hover:bg-red-700 transition-all duration-200 hover:scale-105 shadow-lg"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Sair do Sistema</span>
        </button>
      </div>
    </div>
  );
}

export default AdminSidebar;
