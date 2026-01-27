import { createClient } from '@supabase/supabase-js';
import { Appointment, Service, Professional, Client, Agent, AppointmentStatus } from '../types';
import { MOCK_SERVICES, MOCK_PROFESSIONALS } from '../constants';

class DatabaseService {
  private appointments: Appointment[] = [];
  private services: Service[] = [...MOCK_SERVICES];
  private professionals: Professional[] = [...MOCK_PROFESSIONALS];
  private clients: Client[] = [];
  private agents: Agent[] = [{ id: 'a1', name: 'Atendente Virtual', active: true, system_instructions: 'Você é um assistente simpático de uma barbearia.' }];

  constructor() {
    this.loadFromStorage();
  }

  private loadFromStorage() {
    const saved = localStorage.getItem('agendezap_data');
    if (saved) {
      const parsed = JSON.parse(saved);
      this.appointments = parsed.appointments || [];
      this.services = parsed.services || [...MOCK_SERVICES];
      this.professionals = parsed.professionals || [...MOCK_PROFESSIONALS];
      this.clients = parsed.clients || [];
      this.agents = parsed.agents || this.agents;
    }
  }

  private saveToStorage() {
    localStorage.setItem('agendezap_data', JSON.stringify({
      appointments: this.appointments,
      services: this.services,
      professionals: this.professionals,
      clients: this.clients,
      agents: this.agents
    }));
  }

  getAppointments() { return this.appointments; }
  
  addAppointment(apt: Omit<Appointment, 'id' | 'created_at'>) {
    const newApt: Appointment = {
      ...apt,
      id: Math.random().toString(36).substr(2, 9),
      created_at: new Date().toISOString()
    };
    this.appointments.push(newApt);
    this.updateClient(newApt.client_phone, newApt.client_name);
    this.saveToStorage();
    return newApt;
  }

  updateAppointmentStatus(id: string, status: AppointmentStatus) {
    const apt = this.appointments.find(a => a.id === id);
    if (apt) apt.status = status;
    this.saveToStorage();
  }

  getServices() { return this.services.filter(s => s.active); }
  getProfessionals() { return this.professionals.filter(p => p.active); }
  getClients() { return this.clients; }
  getAgents() { return this.agents; }

  private updateClient(phone: string, name: string) {
    const existing = this.clients.find(c => c.phone === phone);
    if (existing) {
      existing.total_appointments += 1;
      existing.last_visit = new Date().toISOString();
    } else {
      this.clients.push({
        id: Math.random().toString(36).substr(2, 9),
        name,
        phone,
        total_appointments: 1,
        last_visit: new Date().toISOString()
      });
    }
  }
  
  getAvailability(professionalId: string, serviceId: string, startDate: Date = new Date()) {
    const service = this.services.find(s => s.id === serviceId);
    const professional = this.professionals.find(p => p.id === professionalId);
    if (!service || !professional) return null;

    let searchDate = new Date(startDate);
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = searchDate.getDay();
      const hours = professional.working_hours.find(h => h.dayOfWeek === dayOfWeek);
      
      if (hours) {
        const dateStr = searchDate.toISOString().split('T')[0];
        const dayAppointments = this.appointments.filter(a => a.professional_id === professionalId && a.date === dateStr && a.status !== AppointmentStatus.CANCELLED);
        
        let [startH, startM] = hours.start.split(':').map(Number);
        let [endH, endM] = hours.end.split(':').map(Number);
        
        let current = new Date(searchDate);
        current.setHours(startH, startM, 0, 0);
        let endLimit = new Date(searchDate);
        endLimit.setHours(endH, endM, 0, 0);

        while (current < endLimit) {
          const timeStr = current.toTimeString().substring(0, 5);
          const isOccupied = dayAppointments.some(a => a.time === timeStr);
          const now = new Date();
          if (current > now && !isOccupied) {
            return { date: dateStr, time: timeStr, availableToday: i === 0 };
          }
          current.setMinutes(current.getMinutes() + 30);
        }
      }
      searchDate.setDate(searchDate.getDate() + 1);
      searchDate.setHours(0, 0, 0, 0);
    }
    return null;
  }
}

// Exporta a instância do banco local
export const db = new DatabaseService();

// --- CONEXÃO COM SUPABASE ---
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

// Exporta o cliente do Supabase para ser usado nas páginas
export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');