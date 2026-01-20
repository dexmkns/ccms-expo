// DIRECTORY LOCATION: types/expo.ts

export interface Competition {
  competition_id: number;
  title: string;
  status: 'setup' | 'live' | 'ended';
}

export interface Participant {
  participant_id: number;
  competition_id: number;
  real_name: string;
  alias?: string;
  booth_code: string;
}

export interface Judge {
  judge_id: number;
  competition_id: number;
  name: string;
  pin_code: string;
}

export interface Criteria {
  criteria_id: number;
  competition_id: number;
  name: string;
  weight_percentage: number;
  type?: 'slider' | 'likert';
  description?: string; // <--- ADDED THIS FIELD
}

export interface Score {
  score_id: number;
  judge_id: number;
  participant_id: number;
  criteria_id: number;
  competition_id: number;
  score_value: number;
  // New Fields for Locking Logic
  is_locked?: boolean;
  unlock_request?: boolean;
}

export interface MatrixRow {
  participant: Participant;
  judgeScores: Record<number, number>;
  // We add this to track which judge has a pending request for this row
  judgeRequests?: Record<number, boolean>; 
  finalAverage: number;
  variance: number;
}