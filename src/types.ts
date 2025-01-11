export interface Match {
  id: number;
  homeTeam: Team;
  awayTeam: Team;
  utcDate: string;
  status: string;
}

export interface Team {
  id: number;
  name: string;
  position?: number;
  points?: number;
  form?: string[];
}

export interface PredictionResult {
  homeTeamChance: number;
  awayTeamChance: number;
  drawChance: number;
  recommendation: string;
  h2hStats?: HeadToHeadStats;
}

export interface HistoricalMatch {
  homeTeamId: number;
  awayTeamId: number;
  score: {
    home: number;
    away: number;
  };
  season: number;
}

export interface HeadToHeadStats {
  totalMatches: number;
  homeTeamWins: number;
  awayTeamWins: number;
  draws: number;
}