
import { GoogleGenAI, Type } from "@google/genai";
import { db } from "./dbService";
import { AppointmentStatus } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY || "fallback" });

export async function processChatbotMessage(clientPhone: string, userMessage: string) {
  const services = db.getServices();
  const professionals = db.getProfessionals();
  const currentAppointments = db.getAppointments().filter(a => a.client_phone === clientPhone && a.status === AppointmentStatus.SCHEDULED);
  const agentConfig = db.getAgents()[0];

  const systemInstruction = `
    ${agentConfig.system_instructions}
    
    You are an automated scheduling assistant.
    Available services: ${services.map(s => `${s.name} (R$${s.price}, ${s.duration_minutes}min)`).join(', ')}.
    Available professionals: ${professionals.map(p => p.name).join(', ')}.
    
    The client's phone is: ${clientPhone}.
    
    Current client appointments: ${currentAppointments.length > 0 ? currentAppointments.map(a => `${a.date} at ${a.time}`).join(', ') : 'None'}.

    Rules:
    1. Be brief and professional.
    2. Help users schedule, reschedule, or cancel.
    3. If they want to schedule, ask for the service and professional.
    4. If they give a service but no professional, list professionals who do that service.
    5. When everything is chosen, say you're checking availability and then "confirm" the choice.
    
    You MUST respond with a JSON object:
    {
      "reply": "your text response to the user",
      "action": "none" | "list_services" | "list_professionals" | "schedule" | "cancel",
      "data": { "serviceId": "...", "professionalId": "...", "date": "...", "time": "...", "name": "..." }
    }
  `;

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: userMessage,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            reply: { type: Type.STRING },
            action: { type: Type.STRING },
            data: {
              type: Type.OBJECT,
              properties: {
                serviceId: { type: Type.STRING },
                professionalId: { type: Type.STRING },
                date: { type: Type.STRING },
                time: { type: Type.STRING },
                name: { type: Type.STRING }
              }
            }
          },
          required: ["reply", "action"]
        }
      }
    });

    const result = JSON.parse(response.text);

    // Auto-execute actions in our simulation
    if (result.action === 'schedule' && result.data?.serviceId && result.data?.professionalId && result.data?.date && result.data?.time) {
      db.addAppointment({
        service_id: result.data.serviceId,
        professional_id: result.data.professionalId,
        date: result.data.date,
        time: result.data.time,
        client_phone: clientPhone,
        client_name: result.data.name || "Cliente WhatsApp",
        status: AppointmentStatus.SCHEDULED
      });
      result.reply = "✅ Perfeito! Seu agendamento foi confirmado para " + result.data.date + " às " + result.data.time + ".";
    }

    return result;
  } catch (error) {
    console.error("Gemini Error:", error);
    return { reply: "Desculpe, estou tendo dificuldades técnicas. Pode tentar novamente?", action: "none" };
  }
}
