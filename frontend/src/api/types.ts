export type GenderFilter = 'any' | 'male' | 'female';
export type EventStatus = 'active' | 'archived' | 'cancelled';
export type ParticipationStatus = 'joined' | 'confirmed' | 'no_show' | 'cancelled';
export type EscrowStatus = 'held' | 'released_to_payer' | 'released_to_poster' | 'refunded';

export interface User {
  id: string;
  name: string | null;
  age: number | null;
  gender: 'male' | 'female' | null;
  city: string | null;
  avatar_url: string | null;
  rating_avg: number;
  meetings_count: number;
  attendance_rate: number;
  interests: string[];
}

export interface EventItem {
  id: string;
  poster_id: string;
  photo_url: string | null;
  activity_type: string;
  datetime: string;
  location_lat: number | null;
  location_lng: number | null;
  location_address: string | null;
  age_min: number;
  age_max: number;
  gender_filter: GenderFilter;
  slots_total: number;
  slots_taken: number;
  description: string;
  deposit_amount: number;
  status: EventStatus;
  city: string;
}

export interface Participation {
  id: string;
  event_id: string;
  user_id: string;
  status: ParticipationStatus;
  deposit_id: string | null;
}

export interface Deposit {
  id: string;
  participation_id: string | null;
  payer_id: string;
  amount: number;
  escrow_status: EscrowStatus;
  yukassa_payment_id: string | null;
}

export interface ChatMessage {
  id: string;
  event_id: string;
  sender_id: string;
  text: string;
  created_at: string;
}

export interface EventDraft {
  photo_url?: string;
  activity_type: string;
  datetime: string;
  location_address?: string;
  age_min: number;
  age_max: number;
  gender_filter: GenderFilter;
  slots_total: number;
  description: string;
  deposit_amount: number;
}
