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
    <div className="w-72 bg-slate-900 border-r border-slate-800 text-white h-screen flex flex-col shadow-2xl relative overflow-hidden">
      {/* Decoração de fundo para Glassmorphism */}
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 blur-[80px] rounded-full -mr-16 -mt-16"></div>
      <div className="absolute bottom-0 left-0 w-32 h-32 bg-purple-500/10 blur-[80px] rounded-full -ml-16 -mb-16"></div>

      {/* Header */}
      <div className="p-8 pb-6 relative z-10">
        <div className="flex flex-col items-center">
          <div className="relative group cursor-pointer transition-transform duration-300 hover:scale-110">
            <div className="absolute -inset-1 bg-gradient-to-r from-blue-600 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
            <div className="relative bg-slate-900 rounded-2xl p-2 border border-slate-700">
              <img src="/images/logo.png" alt="AgendeZap" className="h-12 w-auto object-contain" />
            </div>
          </div>
          <div className="mt-4 text-center">
            <p className="text-xs font-bold tracking-[0.2em] text-blue-400 uppercase">SuperAdmin</p>
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
                  w-full flex items-center gap-4 px-5 py-4 rounded-xl transition-all duration-300 relative group
                  ${isActive
                    ? 'bg-gradient-to-r from-blue-600/90 to-purple-600/90 shadow-lg backdrop-blur-md border border-white/10'
                    : isDisabled
                      ? 'text-slate-600 cursor-not-allowed opacity-40'
                      : 'text-slate-400 hover:text-white hover:bg-white/5 hover:translate-x-1'
                  }
                `}
              >
                <div className={`p-2 rounded-lg transition-colors ${isActive ? 'bg-white/20' : 'bg-slate-800 group-hover:bg-slate-700'}`}>
                  <Icon size={18} className={isActive ? 'text-white' : 'text-slate-400 group-hover:text-blue-400'} />
                </div>
                <div className="flex-1 text-left">
                  <p className={`text-sm font-semibold tracking-wide ${isActive ? 'text-white' : 'group-hover:text-white'}`}>
                    {item.label}
                  </p>
                </div>
                {item.badge && (
                  <span className="px-2 py-1 bg-green-500 text-[10px] font-black tracking-tighter text-white rounded-md animate-pulse">
                    {item.badge}
                  </span>
                )}
                {isDisabled && (
                  <span className="text-[10px] font-medium text-slate-600 uppercase tracking-widest whitespace-nowrap">
                    Breve
                  </span>
                )}
                {isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-white rounded-r-full shadow-white shadow-sm"></div>
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
