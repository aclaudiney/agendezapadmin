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
    <div className="w-72 bg-white border-r border-slate-200 h-screen flex flex-col z-30 transform transition-transform duration-300 ease-in-out">
      {/* Header */}
      <div className="p-6 border-b border-slate-100 flex flex-col items-center gap-4">
        <img 
          src="/images/logo1.png" 
          alt="AgendeZap" 
          className="h-16 w-auto object-contain" 
        />
        <div className="px-3 py-1 bg-indigo-50 rounded-full">
          <p className="text-[10px] font-bold tracking-wider text-indigo-600 uppercase">SuperAdmin</p>
        </div>
      </div>

      {/* Menu Items */}
      <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
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
                w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors relative group
                ${isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : isDisabled
                    ? 'text-slate-300 cursor-not-allowed'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }
              `}
            >
              <Icon size={20} className={isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'} />
              <div className="flex-1 text-left">
                {item.label}
              </div>
              {item.badge && (
                <span className="px-1.5 py-0.5 bg-green-100 text-green-700 text-[10px] font-bold rounded">
                  {item.badge}
                </span>
              )}
              {isDisabled && (
                <span className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                  Breve
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100">
        <button
          onClick={onLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
        >
          <LogOut size={20} />
          <span>Sair do Sistema</span>
        </button>
      </div>
    </div>
  );
}

export default AdminSidebar;
