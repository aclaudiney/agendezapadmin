
export enum AppointmentStatus {
  SCHEDULED = 'scheduled',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
  NO_SHOW = 'no_show',
  CONFIRMED = 'confirmed',
  REMINDER_SENT = 'reminder_sent'
}

export interface Establishment {
  id: string;
  name: string;
  description: string;
  phone: string;
  address: string;
  business_hours: string;
  logo_url: string;
}

export interface Service {
  id: string;
  name: string;
  description: string;
  price: number;
  duration_minutes: number;
  active: boolean;
}

export interface Professional {
  id: string;
  name: string;
  specialty: string;
  email: string;
  photo_url: string;
  active: boolean;
  working_hours: ProfessionalWorkingHours[];
}

export interface ProfessionalWorkingHours {
  dayOfWeek: number; // 0-6
  start: string; // HH:mm
  end: string;
}

export interface Appointment {
  id: string;
  professional_id: string;
  service_id: string;
  client_phone: string;
  client_name: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  status: AppointmentStatus;
  created_at: string;
}

export interface Client {
  id: string;
  name: string;
  phone: string;
  total_appointments: number;
  last_visit?: string;
}

export interface Agent {
  id: string;
  name: string;
  system_instructions: string;
  active: boolean;
}

export interface MessageLog {
  id: string;
  client_phone: string;
  content: string;
  direction: 'sent' | 'received';
  timestamp: string;
}
