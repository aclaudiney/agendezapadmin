import React from 'react';
import {
  LayoutDashboard,
  Calendar,
  Scissors,
  Users,
  Settings,
  MessageSquare,
  UserCircle,
  HelpCircle,
  LogOut,
  TrendingUp,
  CheckCircle2,
  Clock,
  XCircle,
  Phone,
  Link as LinkIcon,
  Bot,
  Palette,
  DollarSign
} from 'lucide-react';

export const MENU_ITEMS = [
  { id: 'dashboard', label: 'Dashboard', icon: <LayoutDashboard size={20} /> },
  { id: 'appointments', label: 'Agendamentos', icon: <Calendar size={20} /> },
  { id: 'services', label: 'Serviços', icon: <Scissors size={20} /> },
  { id: 'professionals', label: 'Profissionais', icon: <UserCircle size={20} /> },
  { id: 'clients', label: 'Clientes', icon: <Users size={20} /> },
  { id: 'agents', label: 'Agente AI', icon: <Bot size={20} /> },
  { id: 'pagina-loja', label: 'Perfil da Loja', icon: <Palette size={20} /> },
  { id: 'financeiro', label: 'Financeiro', icon: <DollarSign size={20} /> },

  // Alterado de 'broadcast' para 'whatsapp' para bater com o seu App.tsx
  { id: 'whatsapp', label: 'Conectar WhatsApp', icon: <MessageSquare size={20} /> },

  { id: 'follow-up', label: 'Follow Up (Avisos)', icon: <Clock size={20} /> }, // ✅ NOVO ITEM

  { id: 'settings', label: 'Configurações', icon: <Settings size={20} /> },
];

export const APP_NAME = "AgendeZap";

export const MOCK_SERVICES = [
  { id: 's1', name: 'Corte de Cabelo Masculino', description: 'Corte clássico ou moderno com acabamento.', price: 45, duration_minutes: 30, active: true },
  { id: 's2', name: 'Barba Completa', description: 'Design de barba com toalha quente.', price: 35, duration_minutes: 30, active: true },
  { id: 's3', name: 'Coloração', description: 'Cobertura de fios brancos ou mudança de cor.', price: 120, duration_minutes: 90, active: true },
];

export const MOCK_PROFESSIONALS = [
  {
    id: 'p1',
    name: 'João Silva',
    specialty: 'Cabelos e Barbas',
    email: 'joao@example.com',
    photo_url: 'https://picsum.photos/seed/joao/200',
    active: true,
    working_hours: [
      { dayOfWeek: 1, start: '09:00', end: '18:00' },
      { dayOfWeek: 2, start: '09:00', end: '18:00' },
      { dayOfWeek: 3, start: '09:00', end: '18:00' },
      { dayOfWeek: 4, start: '09:00', end: '18:00' },
      { dayOfWeek: 5, start: '09:00', end: '18:00' },
    ]
  },
  {
    id: 'p2',
    name: 'Maria Santos',
    specialty: 'Colorista',
    email: 'maria@example.com',
    photo_url: 'https://picsum.photos/seed/maria/200',
    active: true,
    working_hours: [
      { dayOfWeek: 2, start: '10:00', end: '20:00' },
      { dayOfWeek: 3, start: '10:00', end: '20:00' },
      { dayOfWeek: 4, start: '10:00', end: '20:00' },
      { dayOfWeek: 5, start: '10:00', end: '20:00' },
      { dayOfWeek: 6, start: '09:00', end: '14:00' },
    ]
  },
];