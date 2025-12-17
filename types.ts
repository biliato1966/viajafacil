export interface TripDetails {
  origin: string; // Novo campo: Local de partida
  destination: string;
  startDate: string; // ISO string
  notes: string;
  distance?: string; // Ex: "520 km" (Texto formatado)
  duration?: string; // Ex: "6h 30min" (Texto formatado)
  durationValue?: number; // Segundos totais estimados
  
  // Novos campos para GPS
  totalDistanceValue?: number; // Metros totais da viagem (calculado na criação)
  remainingDistanceValue?: number; // Metros restantes (atualizado pelo GPS)
  lastGpsUpdate?: number; // Timestamp da última atualização
}

export interface ChecklistItem {
  id: string;
  text: string;
  isCompleted: boolean;
  category: string;
}

export interface Expense {
  id: string;
  description: string;
  amount: number;
  category: ExpenseCategory;
  date: string;
}

export enum ExpenseCategory {
  FUEL = 'Combustível',
  FOOD = 'Alimentação',
  LODGING = 'Hospedagem',
  TOLL = 'Pedágio',
  OTHER = 'Outros',
}

export interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
}

// Interface para uma viagem individual
export interface Trip {
  id: string;
  createdAt: number;
  details: TripDetails;
  checklist: ChecklistItem[];
  expenses: Expense[];
  markers: MapMarker[];
}

// O estado global agora gerencia a lista de viagens e qual está ativa
export interface AppData {
  trips: Trip[];
  activeTripId: string | null;
}

// Deprecated: Mantido apenas para migração de dados antigos se necessário
export interface AppState {
  details: TripDetails;
  checklist: ChecklistItem[];
  expenses: Expense[];
  markers: MapMarker[];
}