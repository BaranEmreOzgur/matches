import axios, { AxiosError } from 'axios';
import { Match, Team, HistoricalMatch } from './types';

const API_KEY = '8213c6e3a8524dedb0474c9290f9f8a2';
const BASE_URL = 'https://cors-proxy.fringe.zone/https://api.football-data.org/v4';

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    'X-Auth-Token': API_KEY
  },
  timeout: 30000 // 30 second timeout
});

const fetchWithRetry = async (request: () => Promise<any>, maxRetries = 3) => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await request();
    } catch (error) {
      if (i === maxRetries - 1) throw error;
      // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, Math.min(1000 * Math.pow(2, i), 8000)));
    }
  }
};

// Store historical matches in a plain object instead of using Symbols
const historicalMatchesStore = {
  matches: [] as HistoricalMatch[]
};

const fetchHistoricalMatches = async () => {
  try {
    // Fetch matches for multiple seasons (2023-2025)
    const seasons = [2023, 2024];
    const matchPromises = seasons.map(season => 
      fetchWithRetry(() => api.get(`/competitions/PL/matches?season=${season}&status=FINISHED`))
    );
    
    const responses = await Promise.all(matchPromises);
    const allMatches = responses.flatMap(response => response.data.matches);
    
    historicalMatchesStore.matches = allMatches.map((match: any) => ({
      homeTeamId: match.homeTeam.id,
      awayTeamId: match.awayTeam.id,
      score: {
        home: match.score.fullTime.home,
        away: match.score.fullTime.away
      },
      season: match.season.id
    }));
  } catch (error) {
    if (error instanceof Error) {
      console.error('Failed to fetch historical matches:', error.message);
    }
    // Initialize with empty array on error
    historicalMatchesStore.matches = [];
  }
};

// Initialize historical matches
fetchHistoricalMatches().catch(() => {
  historicalMatchesStore.matches = [];
});

export const getHistoricalMatchups = (homeTeamId: number, awayTeamId: number) => {
  return historicalMatchesStore.matches.filter(match => 
    (match.homeTeamId === homeTeamId && match.awayTeamId === awayTeamId) ||
    (match.homeTeamId === awayTeamId && match.awayTeamId === homeTeamId)
  );
};

export const getMatches = async (): Promise<Match[]> => {
  try {
    // Calculate date range for next 10 days
    const today = new Date();
    const tenDaysFromNow = new Date();
    tenDaysFromNow.setDate(today.getDate() + 10);

    // Format dates for API
    const dateFrom = today.toISOString().split('T')[0];
    const dateTo = tenDaysFromNow.toISOString().split('T')[0];

    const [matchesResponse, standingsResponse] = await Promise.all([
      fetchWithRetry(() => api.get(`/competitions/PL/matches?dateFrom=${dateFrom}&dateTo=${dateTo}&status=SCHEDULED`)),
      fetchWithRetry(() => api.get('/competitions/PL/standings'))
    ]);

    const standings = standingsResponse.data.standings[0].table;
    const teamStats = new Map(standings.map((item: any) => [
      item.team.id,
      {
        position: item.position,
        points: item.points,
        form: item.form?.split(',') || []
      }
    ]));

    return matchesResponse.data.matches.map((match: any) => ({
      id: match.id,
      homeTeam: {
        id: match.homeTeam.id,
        name: match.homeTeam.name,
        ...teamStats.get(match.homeTeam.id)
      },
      awayTeam: {
        id: match.awayTeam.id,
        name: match.awayTeam.name,
        ...teamStats.get(match.awayTeam.id)
      },
      utcDate: match.utcDate,
      status: match.status
    }));
  } catch (error) {
    if (error instanceof AxiosError) {
      console.error('API Error:', error.message);
    } else if (error instanceof Error) {
      console.error('Unexpected error:', error.message);
    }
    return [];
  }
};
