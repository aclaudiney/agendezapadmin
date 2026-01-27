import React, { useState } from 'react';
import { MENU_ITEMS, APP_NAME } from '../constants';
import { LogOut, Menu, X, Bot, Link as LinkIcon, MessageSquare } from 'lucide-react'; // Adicionei o MessageSquare

interface SidebarProps {
  activePage: string;
  onNavigate: (page: string) => void;
  onShowTester?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activePage, onNavigate, onShowTester }) => {
  const [isOpen, setIsOpen] = useState(false);

  const handleNavigate = (page: string) => {
    onNavigate(page);
    setIsOpen(false);
  };

  return (
    <>
      {/* Botão hambúrguer (Mobile) */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-40 p-2 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition-colors"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {/* Overlay (Mobile) */}
      {isOpen && (
        <div
          className="md:hidden fixed inset-0 bg-black/40 z-20"
          onClick={() => setIsOpen(false)}
        ></div>
      )}

      {/* Sidebar */}
      <div className={`fixed md:sticky top-0 left-0 h-screen w-64 bg-white border-r border-slate-200 flex flex-col z-30 transform transition-transform duration-300 ease-in-out ${
        isOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'
      }`}>
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center gap-3">
          <img 
            src="/images/logo1.png" 
            alt={APP_NAME}
            className="h-16 w-auto"
          />
        </div>

        {/* Menu Principal */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {MENU_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => handleNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                activePage === item.id
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.icon}
              {item.label}
            </button>
          ))}
        </nav>

        {/* Ações Rápidas (AQUI ESTÁ A MUDANÇA) */}
        <div className="p-4 border-t border-slate-100 space-y-2">
          {/* BOTÃO CONECTAR WHATSAPP - NOVO */}
          <button 
            onClick={() => handleNavigate('whatsapp')}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activePage === 'whatsapp'
                ? 'bg-purple-50 text-purple-700'
                : 'text-purple-600 hover:bg-purple-50'
            }`}
          >
            <MessageSquare size={20} />
            Conectar WhatsApp
          </button>

          <button 
            onClick={() => window.open('/agendar', '_blank')}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors"
          >
            <LinkIcon size={20} />
            Ver Link Web
          </button>
          
          <button 
            onClick={() => {
              if (onShowTester) {
                onShowTester();
              }
            }}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-green-600 hover:bg-green-50 transition-colors"
          >
            <Bot size={20} />
            Testar WhatsApp
          </button>
        </div>

        {/* Logout */}
        <div className="p-4 border-t border-slate-100">
          <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50 transition-colors">
            <LogOut size={20} />
            Sair
          </button>
        </div>
      </div>
    </>
  );
};

export default Sidebar;