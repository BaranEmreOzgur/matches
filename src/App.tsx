import React, { useEffect, useState } from 'react';
import { Trophy, Activity, TrendingUp, History, Home } from 'lucide-react';
import { Match, PredictionResult } from './types';
import { getMatches, getHistoricalMatchups } from './api';

function App() {
  const [matches, setMatches] = useState<Match[]>([]);
  const [selectedMatch, setSelectedMatch] = useState<Match | null>(null);
  const [prediction, setPrediction] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchMatches = async () => {
      try {
        const data = await getMatches();
        setMatches(data);
      } catch (error) {
        console.error('Failed to fetch matches:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchMatches();
  }, []);

  const generatePrediction = (match: Match) => {
    const homeTeam = match.homeTeam;
    const awayTeam = match.awayTeam;

    // Get historical matchups
    const historicalMatches = getHistoricalMatchups(homeTeam.id, awayTeam.id);
    const h2hStats = {
      totalMatches: historicalMatches.length,
      homeTeamWins: 0,
      awayTeamWins: 0,
      draws: 0
    };

    historicalMatches.forEach(m => {
      if (m.homeTeamId === homeTeam.id) {
        if (m.score.home > m.score.away) h2hStats.homeTeamWins++;
        else if (m.score.home < m.score.away) h2hStats.awayTeamWins++;
        else h2hStats.draws++;
      } else {
        if (m.score.home < m.score.away) h2hStats.homeTeamWins++;
        else if (m.score.home > m.score.away) h2hStats.awayTeamWins++;
        else h2hStats.draws++;
      }
    });

    // Calculate base scores with safety checks
    const positionScore = Math.max((20 - (homeTeam.position || 20)) / (20 - (awayTeam.position || 20)), 0.1);
    const pointsScore = Math.max((homeTeam.points || 0) / Math.max(awayTeam.points || 1, 1), 0.1);
    
    const getFormScore = (form: string[] = []) => 
      form.reduce((acc, result) => acc + (result === 'W' ? 1 : result === 'D' ? 0.5 : 0), 0) + 0.1;
    
    const homeFormScore = getFormScore(homeTeam.form);
    const awayFormScore = getFormScore(awayTeam.form);
    
    // Add home advantage factor (typically around 15-20% in football)
    const homeAdvantage = 1.15;
    
    // Calculate h2h factor with home advantage consideration
    const h2hFactor = h2hStats.totalMatches > 0 
      ? ((h2hStats.homeTeamWins * homeAdvantage - h2hStats.awayTeamWins) / h2hStats.totalMatches)
      : 0;

    // Calculate draw likelihood
    const positionDiff = Math.abs((homeTeam.position || 20) - (awayTeam.position || 20));
    const pointsDiff = Math.abs((homeTeam.points || 0) - (awayTeam.points || 0));
    const formDiff = Math.abs(homeFormScore - awayFormScore);
    
    // Calculate draw factor with safety checks
    const drawFactor = Math.min(
      (1 - (positionDiff / 19)) * 0.3 +
      (1 - (pointsDiff / 30)) * 0.3 +
      (1 - (formDiff / 5)) * 0.2 +
      (h2hStats.draws / Math.max(h2hStats.totalMatches, 1)) * 0.2,
      0.8
    );

    // Calculate initial probabilities with home advantage
    const baseHomeChance = (
      (positionScore * 0.3 * homeAdvantage) +
      (pointsScore * 0.3 * homeAdvantage) +
      ((homeFormScore / (homeFormScore + awayFormScore)) * 0.2 * homeAdvantage) +
      (Math.max(h2hFactor, 0) * 0.2)
    );
    
    const baseAwayChance = (
      (1 / positionScore * 0.3) +
      (1 / pointsScore * 0.3) +
      (awayFormScore / (homeFormScore + awayFormScore) * 0.2) +
      (Math.max(-h2hFactor, 0) * 0.2)
    );

    const totalBaseChance = baseHomeChance + baseAwayChance;
    
    // Calculate final probabilities
    const baseDrawChance = Math.round(drawFactor * 30); // Max 30% chance of draw
    const remainingProb = 100 - baseDrawChance;
    
    const homeTeamChance = Math.round(remainingProb * (baseHomeChance / totalBaseChance));
    const awayTeamChance = Math.round(remainingProb * (baseAwayChance / totalBaseChance));
    const drawChance = 100 - homeTeamChance - awayTeamChance;

    let recommendation = '';
    if (homeTeamChance > Math.max(awayTeamChance, drawChance)) {
      recommendation = `${match.homeTeam.name} has a higher chance to win with home advantage${
        h2hStats.homeTeamWins > h2hStats.awayTeamWins ? ' and better head-to-head record' :
        (homeTeam.position || 20) < (awayTeam.position || 20) ? ' and better league position' : ' and better recent form'
      }`;
    } else if (awayTeamChance > Math.max(homeTeamChance, drawChance)) {
      recommendation = `Despite playing away, ${match.awayTeam.name} is likely to win based on their superior ${
        h2hStats.awayTeamWins > h2hStats.homeTeamWins ? 'head-to-head record' :
        (awayTeam.position || 20) < (homeTeam.position || 20) ? 'league position' : 'recent form'
      }`;
    } else {
      recommendation = `A draw is likely as both teams are closely matched in ${
        h2hStats.draws > Math.max(h2hStats.homeTeamWins, h2hStats.awayTeamWins) ? 'previous encounters' :
        positionDiff < 3 ? 'league position' : 
        pointsDiff < 5 ? 'points' : 'recent form'
      }`;
    }

    const result: PredictionResult = {
      homeTeamChance,
      awayTeamChance,
      drawChance,
      recommendation,
      h2hStats
    };

    setSelectedMatch(match);
    setPrediction(result);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <Activity className="w-8 h-8 animate-spin text-blue-500" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-4xl mx-auto">
        <header className="flex items-center gap-3 mb-8">
          <Trophy className="w-8 h-8 text-blue-500" />
          <h1 className="text-2xl font-bold text-gray-800">Premier League Match Predictor</h1>
        </header>

        <div className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-lg p-6 shadow-md">
            <h2 className="text-xl font-semibold mb-4">Upcoming Matches</h2>
            <div className="space-y-3">
              {matches.map((match) => (
                <button
                  key={match.id}
                  onClick={() => generatePrediction(match)}
                  className="w-full text-left p-4 rounded-lg border hover:bg-blue-50 transition-colors"
                >
                  <div className="font-medium flex items-center justify-between">
                    <span>{match.homeTeam.name}</span>
                    <span className="text-sm text-gray-500">vs</span>
                    <span>{match.awayTeam.name}</span>
                  </div>
                  <div className="text-sm text-gray-500 mt-2">
                    {new Date(match.utcDate).toLocaleDateString()} at {
                      new Date(match.utcDate).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                    }
                  </div>
                </button>
              ))}
            </div>
          </div>

          {selectedMatch && prediction && (
            <div className="bg-white rounded-lg p-6 shadow-md">
              <h2 className="text-xl font-semibold mb-4">Match Analysis</h2>
              <div className="space-y-4">
                <div className="text-lg font-medium flex items-center justify-between">
                  <span>{selectedMatch.homeTeam.name}</span>
                  <span className="text-sm text-gray-500">vs</span>
                  <span>{selectedMatch.awayTeam.name}</span>
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">Home Team Stats</h3>
                    <p>Position: {selectedMatch.homeTeam.position || 'N/A'}</p>
                    <p>Points: {selectedMatch.homeTeam.points || 'N/A'}</p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="font-medium text-gray-700">Away Team Stats</h3>
                    <p>Position: {selectedMatch.awayTeam.position || 'N/A'}</p>
                    <p>Points: {selectedMatch.awayTeam.points || 'N/A'}</p>
                  </div>
                </div>

                {prediction.h2hStats && prediction.h2hStats.totalMatches > 0 && (
                  <div className="mt-4 p-4 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2 mb-2">
                      <History className="w-4 h-4 text-gray-600" />
                      <h3 className="font-medium text-gray-700">Head-to-Head Record (2023)</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div>
                        <div className="font-semibold text-green-600">{prediction.h2hStats.homeTeamWins}</div>
                        <div className="text-sm text-gray-600">Home Wins</div>
                      </div>
                      <div>
                        <div className="font-semibold text-gray-600">{prediction.h2hStats.draws}</div>
                        <div className="text-sm text-gray-600">Draws</div>
                      </div>
                      <div>
                        <div className="font-semibold text-blue-600">{prediction.h2hStats.awayTeamWins}</div>
                        <div className="text-sm text-gray-600">Away Wins</div>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-2 mt-4">
                  <h3 className="font-medium text-gray-700">Win Probabilities</h3>
                  <div className="relative h-8 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="absolute h-full bg-green-500" 
                      style={{ width: `${prediction.homeTeamChance}%` }}
                    />
                    <div 
                      className="absolute h-full bg-gray-500" 
                      style={{ width: `${prediction.drawChance}%`, left: `${prediction.homeTeamChance}%` }}
                    />
                    <div 
                      className="absolute h-full bg-blue-500" 
                      style={{ width: `${prediction.awayTeamChance}%`, left: `${prediction.homeTeamChance + prediction.drawChance}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-green-500" />
                      <span>{selectedMatch.homeTeam.name} ({prediction.homeTeamChance}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-gray-500" />
                      <span>Draw ({prediction.drawChance}%)</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 rounded-full bg-blue-500" />
                      <span>{selectedMatch.awayTeam.name} ({prediction.awayTeamChance}%)</span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-4 bg-blue-50 rounded-lg flex items-start gap-3">
                  <TrendingUp className="w-5 h-5 text-blue-500 mt-0.5" />
                  <p className="font-medium text-blue-800">
                    {prediction.recommendation}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;