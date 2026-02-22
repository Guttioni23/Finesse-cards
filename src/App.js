
import React, { useState, useEffect } from 'react';
import { Trophy, Users, UserCheck, UserX, Plus, Shuffle, Save, LogOut, RefreshCw, ChevronLeft, Calendar, Award, TrendingUp, Mail, RotateCcw } from 'lucide-react';

// ==================== INITIAL DATA ====================
const SEED_PLAYERS = [
  'Osman Latif', 'Hassam Bha', 'Reffik Dada', 'Yacoob Bassa', 'Yunie Omar',
  'Yunus Mohamed', 'Omar Abdulla', 'Yusuf Chothia', 'Ismail Meman', 'Yahya Hashim',
  'Faizal Moosa', 'Ahmed Kadwa', 'Humza Karim', 'Dado Sacoor', 'Din Karim',
  'Iqbal Gutta', 'Aziz Gutta', 'Abdullah Hashim', 'Suliman Tayob', 'Abdul Latif',
  'Abdul Omar', 'Fakhri Shamshoodin', 'Munir Mayat', 'Imran Karim'
].map((name, i) => ({
  id: `player_${i}`,
  name,
  present: true,
  totalPoints: 0,
  absenceCount: 0,
  weeklyHistory: []
}));

const PASSWORDS = {
  admin: 'admin123',
  user: 'user123'
};

const TEAM_LETTERS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
const STORAGE_KEY = 'team_scoring_data';

// Local fallback for offline/initial load
const loadFromStorage = () => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      const migratedPlayers = (parsed.players || []).map((p) => ({
        ...p,
        absenceCount: p.absenceCount || 0,
        weeklyHistory: p.weeklyHistory || []
      }));
      
      return {
        players: migratedPlayers,
        weeklySession: {
          isLocked: parsed.weeklySession?.isLocked || false,
          teams: parsed.weeklySession?.teams || [],
          fixtures: parsed.weeklySession?.fixtures || [],
          teamScores: parsed.weeklySession?.teamScores || [],
          timestamp: parsed.weeklySession?.timestamp || Date.now(),
          weekNumber: parsed.weeklySession?.weekNumber || 1
        },
        weekCounter: parsed.weekCounter || 1
      };
    }
  } catch (error) {
    console.log('No existing local data found');
  }
  
  return null;
};

const getDefaultState = () => ({
  players: SEED_PLAYERS,
  weeklySession: {
    isLocked: false,
    teams: [],
    fixtures: [],
    teamScores: [],
    timestamp: Date.now(),
    weekNumber: 1
  },
  weekCounter: 1
});

const saveToStorage = (state) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.error('Failed to save local data:', error);
  }
};

// Remote state functions
const fetchRemoteState = async () => {
  try {
    const res = await fetch('/api/get-state');
    const data = await res.json();
    if (data.state) {
      // Migrate remote state
      const migratedPlayers = (data.state.players || []).map((p) => ({
        ...p,
        absenceCount: p.absenceCount || 0,
        weeklyHistory: p.weeklyHistory || []
      }));
      return {
        players: migratedPlayers,
        weeklySession: {
          isLocked: data.state.weeklySession?.isLocked || false,
          teams: data.state.weeklySession?.teams || [],
          fixtures: data.state.weeklySession?.fixtures || [],
          teamScores: data.state.weeklySession?.teamScores || [],
          timestamp: data.state.weeklySession?.timestamp || Date.now(),
          weekNumber: data.state.weeklySession?.weekNumber || 1
        },
        weekCounter: data.state.weekCounter || 1
      };
    }
    return null;
  } catch (err) {
    console.log('Could not fetch remote state:', err);
    return null;
  }
};

const saveRemoteState = async (state) => {
  try {
    await fetch('/api/save-state', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ state }),
    });
  } catch (err) {
    console.error('Failed to save remote state:', err);
  }
};

const generateTeams = (players, numTeams) => {
  const presentPlayers = players.filter(p => p.present);
  const shuffled = [...presentPlayers].sort(() => Math.random() - 0.5);
  
  const teams = Array.from({ length: numTeams }, (_, i) => ({
    teamNumber: i + 1,
    teamLetter: TEAM_LETTERS[i],
    players: []
  }));
  
  shuffled.forEach((player, idx) => {
    teams[idx % numTeams].players.push(player);
  });
  
  return teams;
};

const calculateBonusPoints = (totalScore, numTeams) => {
  let thresholds = [];
  
  if (numTeams === 5) {
    thresholds = [
      { score: 13500, bonus: 7 },
      { score: 11500, bonus: 6 },
      { score: 9500, bonus: 5 },
      { score: 7500, bonus: 4 },
      { score: 6500, bonus: 3 },
      { score: 5500, bonus: 2 },
      { score: 3500, bonus: 1 }
    ];
  } else {
    thresholds = [
      { score: 14000, bonus: 7 },
      { score: 12000, bonus: 6 },
      { score: 10000, bonus: 5 },
      { score: 8000, bonus: 4 },
      { score: 7000, bonus: 3 },
      { score: 6000, bonus: 2 },
      { score: 4000, bonus: 1 }
    ];
  }
  
  for (const threshold of thresholds) {
    if (totalScore >= threshold.score) {
      return threshold.bonus;
    }
  }
  
  return 0;
};

const calculateRankPoints = (teamScores) => {
  if (!teamScores || teamScores.length === 0) return [];
  
  const sorted = [...teamScores].sort((a, b) => b.totalScore - a.totalScore);
  const ranksMap = new Map();
  let currentRank = 0;
  let previousScore = -1;
  
  sorted.forEach((team, index) => {
    if (team.totalScore !== previousScore) {
      currentRank = index;
      previousScore = team.totalScore;
    }
    
    const rankPoints = 6 - currentRank;
    ranksMap.set(team.teamNumber, rankPoints);
  });
  
  return teamScores.map(team => {
    const rankPoints = ranksMap.get(team.teamNumber) || 1;
    return {
      ...team,
      rankPoints,
      teamTotalPoints: rankPoints + team.bonusPoints
    };
  });
};

const LoginPage = ({ onLogin }) => {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = () => {
    if (password === PASSWORDS.admin) {
      onLogin('admin');
    } else if (password === PASSWORDS.user) {
      onLogin('user');
    } else {
      setError('Invalid password');
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleSubmit();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-md">
        <div className="flex justify-center mb-6">
          <div className="bg-indigo-600 p-4 rounded-full">
            <Trophy size={40} className="text-white" />
          </div>
        </div>
        <h1 className="text-3xl font-bold text-center text-gray-800 mb-2">Weekly Team Scorer</h1>
        <p className="text-center text-gray-600 mb-8">Enter password to access</p>
        
        <div className="space-y-4">
          <div>
            <input
              type="password"
              placeholder="Enter password"
              value={password}
              onChange={(e) => { setPassword(e.target.value); setError(''); }}
              onKeyPress={handleKeyPress}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            onClick={handleSubmit}
            className="w-full bg-indigo-600 text-white py-3 rounded-lg font-semibold hover:bg-indigo-700 transition"
          >
            Login
          </button>
        </div>
        
        <div className="mt-6 p-4 bg-gray-50 rounded-lg text-sm text-gray-600">
          <p className="font-semibold mb-2">Demo Passwords:</p>
          <p>Admin: <code className="bg-gray-200 px-2 py-1 rounded">admin123</code></p>
          <p>User: <code className="bg-gray-200 px-2 py-1 rounded">user123</code></p>
        </div>
      </div>
    </div>
  );
};

const Leaderboard = ({ players, isAdmin, onUpdateWeeklyScore, onUpdateAbsences, onResetAll }) => {
  const [editingAbsencesId, setEditingAbsencesId] = useState(null);
  const [editAbsences, setEditAbsences] = useState('');
  const [editingWeekKey, setEditingWeekKey] = useState(null);
  const [editWeekPoints, setEditWeekPoints] = useState('');
  const [showResetModal, setShowResetModal] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetError, setResetError] = useState('');
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  
  const sortedPlayers = [...(players || [])].sort((a, b) => b.totalPoints - a.totalPoints);
  
  const allWeeks = new Set();
  sortedPlayers.forEach(player => {
    (player.weeklyHistory || []).forEach(record => {
      allWeeks.add(record.weekNumber);
    });
  });
  const sortedWeeks = Array.from(allWeeks).sort((a, b) => a - b);
  
  const handleStartEditAbsences = (player) => {
    setEditingAbsencesId(player.id);
    setEditAbsences((player.absenceCount || 0).toString());
  };
  
  const handleSaveAbsences = (playerId) => {
    const absences = Math.max(0, Math.min(15, parseInt(editAbsences) || 0));
    if (onUpdateAbsences) {
      onUpdateAbsences(playerId, absences);
    }
    setEditingAbsencesId(null);
  };
  
  const handleCancelAbsences = () => {
    setEditingAbsencesId(null);
    setEditAbsences('');
  };
  
  const handleStartEditWeek = (playerId, weekNumber, currentPoints) => {
    setEditingWeekKey(`${playerId}-${weekNumber}`);
    setEditWeekPoints(currentPoints.toString());
  };
  
  const handleSaveWeekPoints = (playerId, weekNumber) => {
    const points = parseInt(editWeekPoints) || 0;
    if (onUpdateWeeklyScore) {
      onUpdateWeeklyScore(playerId, weekNumber, points);
    }
    setEditingWeekKey(null);
  };
  
  const handleCancelWeekEdit = () => {
    setEditingWeekKey(null);
    setEditWeekPoints('');
  };
  
  const getWeekPoints = (player, weekNumber) => {
    const record = (player.weeklyHistory || []).find(r => r.weekNumber === weekNumber);
    if (!record) return { points: 0, isAbsent: false };
    return { points: record.pointsEarned, isAbsent: !record.isPresent };
  };

  const handleResetClick = () => {
    setShowResetModal(true);
    setResetPassword('');
    setResetError('');
  };

  const handleResetPasswordSubmit = () => {
    if (resetPassword !== '1111') {
      setResetError('Incorrect password.');
      return;
    }
    setShowResetModal(false);
    setResetPassword('');
    setResetError('');
    setShowResetConfirm(true);
  };

  const handleResetConfirm = () => {
    if (onResetAll) {
      onResetAll();
    }
    setShowResetConfirm(false);
  };

  const handleResetCancel = () => {
    setShowResetModal(false);
    setShowResetConfirm(false);
    setResetPassword('');
    setResetError('');
  };
  
  return (
    <div>
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
          <Trophy size={24} className="text-yellow-500" />
          Leaderboard
          {isAdmin && (
            <span className="text-sm font-normal text-gray-600 ml-2">(Click weekly scores or absences to edit)</span>
          )}
        </h2>
        
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b-2 border-gray-300">
                <th className="sticky left-0 z-20 bg-white border-r-2 border-gray-300 text-left py-3 px-4 font-semibold text-gray-700 min-w-[60px]">
                  Rank
                </th>
                <th className="sticky left-[60px] z-20 bg-white border-r-2 border-gray-300 text-left py-3 px-4 font-semibold text-gray-700 min-w-[180px]">
                  Player
                </th>
                <th className="sticky left-[240px] z-20 bg-white border-r-2 border-gray-300 text-center py-3 px-4 font-semibold text-gray-700 min-w-[100px]">
                  Total
                </th>
                <th className="sticky left-[340px] z-20 bg-white border-r-2 border-gray-300 text-center py-3 px-4 font-semibold text-gray-700 min-w-[100px]">
                  Absences
                </th>
                {sortedWeeks.map(week => (
                  <th key={week} className="text-center py-3 px-4 font-semibold text-gray-700 bg-indigo-50 border-r border-gray-200 min-w-[80px]">
                    Week {week}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedPlayers.map((player, idx) => (
                <tr 
                  key={player.id} 
                  className="border-b border-gray-100 hover:bg-indigo-50 transition"
                >
                  <td className="sticky left-0 z-10 bg-white border-r-2 border-gray-300 py-3 px-4">
                    {idx === 0 && <span className="text-2xl">🥇</span>}
                    {idx === 1 && <span className="text-2xl">🥈</span>}
                    {idx === 2 && <span className="text-2xl">🥉</span>}
                    {idx > 2 && <span className="text-gray-600 font-medium">{idx + 1}</span>}
                  </td>
                  <td className="sticky left-[60px] z-10 bg-white border-r-2 border-gray-300 py-3 px-4">
                    <span className="font-medium text-indigo-600">{player.name}</span>
                  </td>
                  <td className="sticky left-[240px] z-10 bg-white border-r-2 border-gray-300 py-3 px-4 text-center">
                    <span className="inline-block bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full font-semibold">
                      {player.totalPoints}
                    </span>
                  </td>
                  <td className="sticky left-[340px] z-10 bg-white border-r-2 border-gray-300 py-3 px-4 text-center">
                    {isAdmin && editingAbsencesId === player.id ? (
                      <div className="flex items-center justify-center gap-2">
                        <input
                          type="number"
                          min="0"
                          max="15"
                          value={editAbsences}
                          onChange={(e) => setEditAbsences(e.target.value)}
                          onKeyPress={(e) => {
                            if (e.key === 'Enter') handleSaveAbsences(player.id);
                            if (e.key === 'Escape') handleCancelAbsences();
                          }}
                          className="w-16 px-2 py-1 border border-red-300 rounded text-center focus:ring-2 focus:ring-red-500"
                          autoFocus
                        />
                        <button
                          onClick={() => handleSaveAbsences(player.id)}
                          className="bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 text-xs"
                        >
                          ✓
                        </button>
                        <button
                          onClick={handleCancelAbsences}
                          className="bg-gray-400 text-white px-2 py-1 rounded hover:bg-gray-500 text-xs"
                        >
                          ✕
                        </button>
                      </div>
                    ) : (
                      <span 
                        className={`inline-block bg-red-100 text-red-800 px-3 py-1 rounded text-sm font-semibold ${
                          isAdmin ? 'cursor-pointer hover:bg-red-200' : ''
                        }`}
                        onClick={() => isAdmin && handleStartEditAbsences(player)}
                      >
                        {player.absenceCount || 0}
                      </span>
                    )}
                  </td>
                  {sortedWeeks.map(week => {
                    const { points, isAbsent } = getWeekPoints(player, week);
                    const weekKey = `${player.id}-${week}`;
                    const isEditing = editingWeekKey === weekKey;
                    
                    return (
                      <td 
                        key={week} 
                        className={`text-center py-3 px-4 border-r border-gray-200 ${
                          isAbsent ? 'bg-red-50' : points > 0 ? 'bg-green-50' : 'bg-gray-50'
                        }`}
                      >
                        {isAdmin && isEditing ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min="0"
                              value={editWeekPoints}
                              onChange={(e) => setEditWeekPoints(e.target.value)}
                              onKeyPress={(e) => {
                                if (e.key === 'Enter') handleSaveWeekPoints(player.id, week);
                                if (e.key === 'Escape') handleCancelWeekEdit();
                              }}
                              className="w-16 px-1 py-1 border border-indigo-300 rounded text-center focus:ring-2 focus:ring-indigo-500 text-sm"
                              autoFocus
                            />
                            <button
                              onClick={() => handleSaveWeekPoints(player.id, week)}
                              className="bg-green-600 text-white px-1 py-1 rounded hover:bg-green-700 text-xs"
                            >
                              ✓
                            </button>
                            <button
                              onClick={handleCancelWeekEdit}
                              className="bg-gray-400 text-white px-1 py-1 rounded hover:bg-gray-500 text-xs"
                            >
                              ✕
                            </button>
                          </div>
                        ) : points > 0 ? (
                          <span 
                            className={`font-semibold ${isAbsent ? 'text-red-700' : 'text-green-700'} ${
                              isAdmin ? 'cursor-pointer hover:underline' : ''
                            }`}
                            onClick={() => isAdmin && handleStartEditWeek(player.id, week, points)}
                          >
                            {points}
                          </span>
                        ) : (
                          <span 
                            className={`text-gray-400 ${isAdmin ? 'cursor-pointer hover:text-gray-600' : ''}`}
                            onClick={() => isAdmin && handleStartEditWeek(player.id, week, 0)}
                          >
                            —
                          </span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        
        <p className="text-sm text-gray-500 mt-4 text-center">
          Scroll horizontally to see all weeks • Green cells = present • Red cells = absent • {isAdmin ? 'Click any weekly score to edit' : ''}
        </p>
      </div>

      {/* Reset Leaderboard Button */}
      {isAdmin && onResetAll && (
        <div className="mt-4 flex justify-center">
          <button
            onClick={handleResetClick}
            className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 transition flex items-center gap-2 font-semibold shadow-lg"
          >
            <RotateCcw size={20} />
            Reset Leaderboard
          </button>
        </div>
      )}

      {/* Reset Password Modal */}
      {showResetModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleResetCancel}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-2">Reset Leaderboard</h3>
            <p className="text-sm text-gray-600 mb-4">
              Enter the reset password to proceed. This will clear all player scores, weekly history, and absences.
            </p>
            
            <input
              type="password"
              value={resetPassword}
              onChange={(e) => { setResetPassword(e.target.value); setResetError(''); }}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handleResetPasswordSubmit();
                if (e.key === 'Escape') handleResetCancel();
              }}
              placeholder="Enter reset password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500 focus:border-transparent mb-2"
              autoFocus
            />
            
            {resetError && <p className="text-red-500 text-sm mb-3">{resetError}</p>}
            
            <div className="flex gap-3 mt-4">
              <button
                onClick={handleResetPasswordSubmit}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold"
              >
                Continue
              </button>
              <button
                onClick={handleResetCancel}
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {showResetConfirm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handleResetCancel}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex justify-center mb-4">
              <div className="bg-red-100 p-3 rounded-full">
                <RotateCcw size={32} className="text-red-600" />
              </div>
            </div>
            <h3 className="text-xl font-bold text-gray-800 mb-2 text-center">Are you absolutely sure?</h3>
            <p className="text-sm text-red-600 font-semibold mb-4 text-center">
              This will permanently reset ALL player scores, weekly history, absence counts, and the week counter back to Week 1. This cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={handleResetConfirm}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold"
              >
                Yes, Reset Everything
              </button>
              <button
                onClick={handleResetCancel}
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};


const Scoreboard = ({ teams, fixtures, teamScores, onFixtureChange, onBonusChange, isLocked, userView }) => {
  
  const updateFixture = (fixtureId, field, value) => {
    const updated = (fixtures || []).map(f => 
      f.id === fixtureId ? { ...f, [field]: parseInt(value) || 0 } : f
    );
    onFixtureChange(updated);
  };

  const numTeams = teams.length;
  let totalRounds;
  let roundsPerTeam;
  
  if (numTeams === 4) {
    totalRounds = 3;
    roundsPerTeam = 3;
  } else if (numTeams === 5) {
    totalRounds = 5;
    roundsPerTeam = 4;
  } else {
    totalRounds = 5;
    roundsPerTeam = 5;
  }
  
  const fixturesPerRound = numTeams === 5 ? 2 : numTeams / 2;

  return (
    <div className="bg-white rounded-xl shadow-lg p-6">
      <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
        <Award size={20} className="text-purple-600" />
        Weekly Scoreboard
        {numTeams === 5 && (
          <span className="text-sm font-normal text-gray-600 ml-2">
            (5 rounds, each team plays 4 - one team sits out per round)
          </span>
        )}
      </h2>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="lg:col-span-1">
          <h3 className="font-semibold text-gray-700 mb-3">Fixtures ({totalRounds} Rounds)</h3>
          <div className="space-y-4">
            {Array.from({ length: totalRounds }).map((_, round) => {
              const roundFixtures = (fixtures || []).filter((_, idx) => 
                Math.floor(idx / fixturesPerRound) === round
              );
              
              let byeTeam = null;
              if (numTeams === 5) {
                const teamsInRound = new Set();
                roundFixtures.forEach(f => {
                  teamsInRound.add(f.teamA);
                  teamsInRound.add(f.teamB);
                });
                byeTeam = teams.find(t => !teamsInRound.has(t.teamNumber));
              }
              
              return (
                <div key={round} className="border-2 border-purple-200 rounded-lg p-3 bg-purple-50">
                  <div className="font-bold text-purple-700 mb-2">Round {round + 1}</div>
                  <div className="space-y-2">
                    {roundFixtures.map((fixture) => {
                      const teamA = (teams || []).find(t => t.teamNumber === fixture.teamA);
                      const teamB = (teams || []).find(t => t.teamNumber === fixture.teamB);
                      return (
                        <div key={fixture.id} className="bg-white rounded p-2">
                          <div className="text-xs font-semibold text-gray-600 mb-1 text-center">
                            Team {teamA?.teamLetter} vs Team {teamB?.teamLetter}
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <input
                              type="number"
                              min="0"
                              value={fixture.scoreA || ''}
                              onChange={(e) => updateFixture(fixture.id, 'scoreA', e.target.value)}
                              disabled={isLocked}
                              placeholder="0"
                              className="px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100"
                            />
                            <input
                              type="number"
                              min="0"
                              value={fixture.scoreB || ''}
                              onChange={(e) => updateFixture(fixture.id, 'scoreB', e.target.value)}
                              disabled={isLocked}
                              placeholder="0"
                              className="px-2 py-1 border border-gray-300 rounded text-center text-sm disabled:bg-gray-100"
                            />
                          </div>
                        </div>
                      );
                    })}
                    {byeTeam && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded p-2 text-center text-xs text-yellow-800 font-semibold">
                        Team {byeTeam.teamLetter} - BYE
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="lg:col-span-1">
          <h3 className="font-semibold text-gray-700 mb-3">Round Scores & Points</h3>
          <div className="overflow-x-auto">
            <table className="w-full border-2 border-gray-200">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 px-2 py-2 text-sm">Team</th>
                  {Array.from({ length: roundsPerTeam }).map((_, idx) => (
                    <th key={idx} className="border border-gray-300 px-2 py-2 text-sm">R{idx + 1}</th>
                  ))}
                  <th className="border border-gray-300 px-2 py-2 text-sm font-bold">Total</th>
                  <th className="border border-gray-300 px-2 py-2 text-sm font-bold bg-blue-100">Rank</th>
                  <th className="border border-gray-300 px-2 py-2 text-sm font-bold bg-green-100">Bonus</th>
                  <th className="border border-gray-300 px-2 py-2 text-sm font-bold bg-indigo-100">Points</th>
                </tr>
              </thead>
              <tbody>
                {(teamScores || []).map(ts => (
                  <tr key={ts.teamNumber}>
                    <td className="border border-gray-300 px-2 py-2 text-center font-bold text-indigo-600">
                      {ts.teamLetter}
                    </td>
                    {(ts.roundScores || []).map((score, idx) => (
                      <td key={idx} className="border border-gray-300 px-2 py-2 text-center">
                        {score || 0}
                      </td>
                    ))}
                    <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-blue-50">
                      {ts.totalScore}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-blue-50">
                      {ts.rankPoints}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-green-50">
                      {userView ? (
                        ts.bonusPoints
                      ) : (
                        <input
                          type="number"
                          min="0"
                          value={ts.bonusPoints || ''}
                          onChange={(e) => onBonusChange(ts.teamNumber, parseInt(e.target.value) || 0)}
                          disabled={isLocked}
                          placeholder="0"
                          className="w-14 px-1 py-1 border border-gray-300 rounded text-center disabled:bg-gray-100 bg-green-50"
                          title="Auto-calculated, but editable"
                        />
                      )}
                    </td>
                    <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-indigo-50">
                      {ts.teamTotalPoints}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
            <strong>Rank Points:</strong> 1st=6, 2nd=5, 3rd=4, 4th=3, 5th=2, 6th=1 • 
            <strong> Bonus Points:</strong> {userView ? 'Based on Total Score' : 'Auto-calculated (editable)'} • 
            <strong> Points:</strong> Rank + Bonus
          </div>
        </div>
      </div>
    </div>
  );
};

const EMAIL_STORAGE_KEY = 'team_scoring_emails';

const loadEmails = () => {
  try {
    const stored = localStorage.getItem(EMAIL_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
  } catch { return []; }
};

const saveEmails = (emails) => {
  try {
    localStorage.setItem(EMAIL_STORAGE_KEY, JSON.stringify(emails));
  } catch (e) { console.error('Failed to save emails:', e); }
};

const AdminDashboard = ({ appState, onUpdate }) => {
  const [newPlayerName, setNewPlayerName] = useState('');
  const [numTeams, setNumTeams] = useState(4);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [playerToDelete, setPlayerToDelete] = useState(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [savedEmails, setSavedEmails] = useState(() => loadEmails());
  const [newEmail, setNewEmail] = useState('');
  const [emailSending, setEmailSending] = useState(false);
  const [emailError, setEmailError] = useState('');
  const [emailSuccess, setEmailSuccess] = useState('');

  const { players, weeklySession, weekCounter } = appState;
  const presentCount = (players || []).filter(p => p.present).length;
  const awayCount = (players || []).filter(p => !p.present).length;
  const maxAbsencesCount = (players || []).filter(p => (p.absenceCount || 0) >= 15).length;

  const buildCsvContent = () => {
    const dateStr = new Date(weeklySession.timestamp).toLocaleDateString();
    const numRounds = weeklySession.teamScores[0]?.roundScores?.length || 0;
    
    let csv = `Weekly Team Scorer - Week ${weekCounter}\n`;
    csv += `Date: ${dateStr}\n\n`;
    
    csv += 'Team,';
    for (let i = 1; i <= numRounds; i++) {
      csv += `R${i},`;
    }
    csv += 'Total,Rank,Bonus,Points\n';
    
    (weeklySession.teamScores || []).forEach(ts => {
      csv += `${ts.teamLetter},`;
      ts.roundScores.forEach(score => {
        csv += `${score || 0},`;
      });
      csv += `${ts.totalScore},${ts.rankPoints},${ts.bonusPoints},${ts.teamTotalPoints}\n`;
    });
    
    // Add team rosters
    csv += '\n\nTeam Rosters\n';
    (weeklySession.teams || []).forEach(team => {
      csv += `\nTeam ${team.teamLetter}\n`;
      (team.players || []).forEach(player => {
        csv += `${player.name}\n`;
      });
    });
    
    return csv;
  };

  const handleAddEmail = () => {
    const trimmed = newEmail.trim().toLowerCase();
    if (!trimmed) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setEmailError('Invalid email format');
      return;
    }
    if (savedEmails.includes(trimmed)) {
      setEmailError('Email already in list');
      return;
    }
    const updated = [...savedEmails, trimmed];
    setSavedEmails(updated);
    saveEmails(updated);
    setNewEmail('');
    setEmailError('');
  };

  const handleRemoveEmail = (email) => {
    const updated = savedEmails.filter(e => e !== email);
    setSavedEmails(updated);
    saveEmails(updated);
  };

  const handleSendEmail = async () => {
    if (savedEmails.length === 0) {
      setEmailError('Add at least one recipient');
      return;
    }

    setEmailSending(true);
    setEmailError('');
    setEmailSuccess('');

    try {
      const csvContent = buildCsvContent();
      
      const res = await fetch('/api/send-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          to: savedEmails,
          subject: `Week ${weekCounter} Scorecard`,
          text: `Hi everyone,\n\nAttached is the scorecard for Week ${weekCounter}.\n\nRegards,\nWeekly Team Scorer`,
          attachments: [
            {
              filename: `Week_${weekCounter}_Scorecard.csv`,
              content: btoa(csvContent),
            },
          ],
        }),
      });

      const data = await res.json();

      if (res.ok) {
        setEmailSuccess(`Scorecard emailed to ${savedEmails.length} recipient(s)!`);
        setTimeout(() => {
          setShowEmailModal(false);
          setEmailSuccess('');
          setSuccess(`Week ${weekCounter} scorecard emailed successfully!`);
          setTimeout(() => setSuccess(''), 4000);
        }, 2000);
      } else {
        setEmailError(data.message || data.error || 'Failed to send email');
      }
    } catch (err) {
      setEmailError('Failed to send email. Please try again.');
    } finally {
      setEmailSending(false);
    }
  };

  const togglePresence = (playerId) => {
    const player = (players || []).find(p => p.id === playerId);
    
    if (player && player.present && (player.absenceCount || 0) >= 15) {
      setError(`${player.name} has reached the maximum of 15 absences and cannot be marked as away.`);
      setTimeout(() => setError(''), 5000);
      return;
    }
    
    const updated = (players || []).map(p =>
      p.id === playerId ? { ...p, present: !p.present } : p
    );
    onUpdate({ ...appState, players: updated });
  };

  const addPlayer = () => {
    const trimmed = newPlayerName.trim();
    if (!trimmed) {
      setError('Player name cannot be empty');
      return;
    }
    if ((players || []).some(p => p.name.toLowerCase() === trimmed.toLowerCase())) {
      setError('Player already exists');
      return;
    }
    
    const newPlayer = {
      id: `player_${Date.now()}`,
      name: trimmed,
      present: true,
      totalPoints: 0,
      absenceCount: 0,
      weeklyHistory: []
    };
    
    onUpdate({ ...appState, players: [...(players || []), newPlayer] });
    setNewPlayerName('');
    setError('');
    setSuccess('Player added successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleEditMode = () => {
    setShowPasswordModal(true);
  };

  const handlePasswordSubmit = () => {
    if (passwordInput !== '54321') {
      setError('Incorrect password. Access denied.');
      setPasswordInput('');
      setShowPasswordModal(false);
      setTimeout(() => setError(''), 3000);
      return;
    }
    
    setEditMode(true);
    setPasswordInput('');
    setShowPasswordModal(false);
    setSuccess('Edit mode enabled. You can now add or remove players.');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handlePasswordCancel = () => {
    setPasswordInput('');
    setShowPasswordModal(false);
  };

  const deletePlayer = (playerId) => {
    setPlayerToDelete(playerId);
    setShowDeleteConfirm(true);
  };

  const confirmDelete = () => {
    if (!playerToDelete) return;
    
    const player = (players || []).find(p => p.id === playerToDelete);
    if (!player) return;
    
    const updatedPlayers = (players || []).filter(p => p.id !== playerToDelete);
    onUpdate({ ...appState, players: updatedPlayers });
    setSuccess(`${player.name} has been removed`);
    setTimeout(() => setSuccess(''), 3000);
    
    setShowDeleteConfirm(false);
    setPlayerToDelete(null);
  };

  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setPlayerToDelete(null);
  };

  const handleGenerateTeams = () => {
    if (presentCount === 0) {
      setError('No players marked as present');
      return;
    }
    
    const minPlayersRequired = numTeams * 3;
    if (presentCount < minPlayersRequired) {
      setError(`Need at least ${minPlayersRequired} present players for ${numTeams} teams (3 players per team minimum). Currently have ${presentCount} present.`);
      return;
    }
    
    const teams = generateTeams(players, numTeams);
    
    let totalRounds;
    let roundsPerTeam;
    
    if (numTeams === 4) {
      totalRounds = 3;
      roundsPerTeam = 3;
    } else if (numTeams === 5) {
      totalRounds = 5;
      roundsPerTeam = 4;
    } else {
      totalRounds = 5;
      roundsPerTeam = 5;
    }
    
    const fixtures = [];
    const teamNumbers = teams.map(t => t.teamNumber);
    
    if (numTeams === 5) {
      for (let round = 0; round < totalRounds; round++) {
        const rotated = [...teamNumbers];
        for (let i = 0; i < round; i++) {
          const temp = rotated[rotated.length - 1];
          for (let j = rotated.length - 1; j > 1; j--) {
            rotated[j] = rotated[j - 1];
          }
          rotated[1] = temp;
        }
        
        for (let i = 0; i < Math.floor(rotated.length / 2); i++) {
          fixtures.push({
            id: `fixture_r${round}_${i}`,
            teamA: rotated[i],
            teamB: rotated[rotated.length - 1 - i],
            scoreA: 0,
            scoreB: 0
          });
        }
      }
    } else {
      for (let round = 0; round < totalRounds; round++) {
        const rotated = [...teamNumbers];
        for (let i = 0; i < round; i++) {
          const temp = rotated[rotated.length - 1];
          for (let j = rotated.length - 1; j > 1; j--) {
            rotated[j] = rotated[j - 1];
          }
          rotated[1] = temp;
        }
        
        for (let i = 0; i < rotated.length / 2; i++) {
          fixtures.push({
            id: `fixture_r${round}_${i}`,
            teamA: rotated[i],
            teamB: rotated[rotated.length - 1 - i],
            scoreA: 0,
            scoreB: 0
          });
        }
      }
    }
    
    const teamScores = teams.map(t => ({
      teamNumber: t.teamNumber,
      teamLetter: t.teamLetter,
      roundScores: new Array(roundsPerTeam).fill(0),
      totalScore: 0,
      rankPoints: 0,
      bonusPoints: 0,
      teamTotalPoints: 0
    }));
    
    const newSession = {
      isLocked: false,
      teams,
      fixtures,
      teamScores,
      timestamp: Date.now(),
      weekNumber: weekCounter
    };
    
    onUpdate({ ...appState, weeklySession: newSession });
    setError('');
    setSuccess('Teams generated successfully');
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleFixtureChange = (updatedFixtures) => {
    const numTeams = weeklySession.teams.length;
    
    let totalRounds;
    let roundsPerTeam;
    
    if (numTeams === 4) {
      totalRounds = 3;
      roundsPerTeam = 3;
    } else if (numTeams === 5) {
      totalRounds = 5;
      roundsPerTeam = 4;
    } else {
      totalRounds = 5;
      roundsPerTeam = 5;
    }
    
    const fixturesPerRound = numTeams === 5 ? 2 : numTeams / 2;
    
    const teamScores = (weeklySession.teamScores || []).map(ts => {
      const roundScores = new Array(roundsPerTeam).fill(0);
      let teamRoundIndex = 0;
      
      for (let round = 0; round < totalRounds; round++) {
        const roundFixtures = (updatedFixtures || []).filter((_, idx) => 
          Math.floor(idx / fixturesPerRound) === round
        );
        
        let teamPlaysThisRound = false;
        let roundScore = 0;
        
        roundFixtures.forEach(fixture => {
          if (fixture.teamA === ts.teamNumber) {
            teamPlaysThisRound = true;
            roundScore += fixture.scoreA;
          } else if (fixture.teamB === ts.teamNumber) {
            teamPlaysThisRound = true;
            roundScore += fixture.scoreB;
          }
        });
        
        if (teamPlaysThisRound && teamRoundIndex < roundsPerTeam) {
          roundScores[teamRoundIndex] = roundScore;
          teamRoundIndex++;
        }
      }
      
      const totalScore = roundScores.reduce((sum, score) => sum + score, 0);
      const bonusPoints = calculateBonusPoints(totalScore, numTeams);
      
      return { ...ts, roundScores, totalScore, bonusPoints };
    });

    const withRankPoints = calculateRankPoints(teamScores);

    onUpdate({
      ...appState,
      weeklySession: {
        ...weeklySession,
        fixtures: updatedFixtures,
        teamScores: withRankPoints
      }
    });
  };

  const handleBonusChange = (teamNumber, bonus) => {
    const teamScores = (weeklySession.teamScores || []).map(ts =>
      ts.teamNumber === teamNumber
        ? { ...ts, bonusPoints: bonus, teamTotalPoints: ts.rankPoints + bonus }
        : ts
    );

    onUpdate({
      ...appState,
      weeklySession: { ...weeklySession, teamScores }
    });
  };

  const handleSaveSession = () => {
    if (weeklySession.isLocked) {
      setError('Session already saved. Start a new week to score again.');
      return;
    }
    
    if (!weeklySession.teams || weeklySession.teams.length === 0) {
      setError('Generate teams first');
      return;
    }

    const updatedPlayers = (players || []).map(player => {
      if (player.present) {
        const team = (weeklySession.teams || []).find(t =>
          t.players.some(p => p.id === player.id)
        );
        if (team) {
          const teamScore = (weeklySession.teamScores || []).find(ts => ts.teamNumber === team.teamNumber);
          if (teamScore) {
            const pointsEarned = teamScore.teamTotalPoints;
            const historyRecord = {
              weekNumber: weeklySession.weekNumber,
              date: weeklySession.timestamp,
              isPresent: true,
              teamNumber: team.teamNumber,
              teamLetter: team.teamLetter,
              teamTotalScore: teamScore.totalScore,
              rankPoints: teamScore.rankPoints,
              bonusPoints: teamScore.bonusPoints,
              pointsEarned
            };
            return {
              ...player,
              totalPoints: player.totalPoints + pointsEarned,
              weeklyHistory: [...(player.weeklyHistory || []), historyRecord]
            };
          }
        }
      } else {
        const historyRecord = {
          weekNumber: weeklySession.weekNumber,
          date: weeklySession.timestamp,
          isPresent: false,
          pointsEarned: 3
        };
        return {
          ...player,
          totalPoints: player.totalPoints + 3,
          absenceCount: (player.absenceCount || 0) + 1,
          weeklyHistory: [...(player.weeklyHistory || []), historyRecord]
        };
      }
      return player;
    });

    const lockedSession = {
      ...weeklySession,
      isLocked: true
    };

    onUpdate({
      players: updatedPlayers,
      weeklySession: lockedSession,
      weekCounter
    });

    setError('');
    setSuccess('Weekly session saved! Points applied to all players.');
    setTimeout(() => setSuccess(''), 5000);
  };

  const downloadSpreadsheet = () => {
    const csv = buildCsvContent();
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `Week_${weekCounter}_Scorecard.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    setSuccess(`Scorecard downloaded as Week_${weekCounter}_Scorecard.csv`);
    setTimeout(() => setSuccess(''), 3000);
  };

  const handleStartNewWeek = () => {
    if (!weeklySession.isLocked) {
      if (!window.confirm('Current session not saved. Start new week anyway?')) return;
    }
    
    const resetPlayers = (players || []).map(p => ({ ...p, present: true }));
    const newSession = {
      isLocked: false,
      teams: [],
      fixtures: [],
      teamScores: [],
      timestamp: Date.now(),
      weekNumber: weekCounter + 1
    };
    
    onUpdate({
      players: resetPlayers,
      weeklySession: newSession,
      weekCounter: weekCounter + 1
    });
    
    setError('');
    setSuccess(`New week started (Week ${weekCounter + 1})! All players reset to present.`);
    setTimeout(() => setSuccess(''), 3000);
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <Calendar size={32} className="text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Current Week</p>
              <p className="text-2xl font-bold text-gray-800">{weekCounter}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <Users size={32} className="text-indigo-600" />
            <div>
              <p className="text-sm text-gray-600">Total Players</p>
              <p className="text-2xl font-bold text-gray-800">{(players || []).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <UserCheck size={32} className="text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-2xl font-bold text-gray-800">{presentCount}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl shadow-lg p-6">
          <div className="flex items-center gap-3">
            <UserX size={32} className="text-red-600" />
            <div>
              <p className="text-sm text-gray-600">Away</p>
              <p className="text-2xl font-bold text-gray-800">{awayCount}</p>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg">
          {success}
        </div>
      )}
      {maxAbsencesCount > 0 && (
        <div className="bg-orange-50 border border-orange-300 text-orange-800 px-4 py-3 rounded-lg flex items-center gap-2">
          <span className="text-xl">⚠️</span>
          <span>
            <strong>{maxAbsencesCount} player{maxAbsencesCount > 1 ? 's have' : ' has'}</strong> reached the maximum of 15 absences and cannot be marked as away.
          </span>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">Player Management</h2>
          {!editMode ? (
            <button
              onClick={handleEditMode}
              className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 font-semibold"
            >
              Edit Players
            </button>
          ) : (
            <button
              onClick={() => setEditMode(false)}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 font-semibold"
            >
              Done Editing
            </button>
          )}
        </div>
        
        <div className="flex gap-2 mb-6">
          <input
            type="text"
            placeholder="New player name"
            value={newPlayerName}
            onChange={(e) => setNewPlayerName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && addPlayer()}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          <button
            onClick={addPlayer}
            className="bg-indigo-600 text-white px-6 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2"
          >
            <Plus size={20} />
            Add
          </button>
        </div>

        <p className="text-xs text-gray-600 mb-3">
          Absence indicators: <span className="bg-gray-200 text-gray-700 px-2 py-0.5 rounded">0-11</span> Normal • 
          <span className="bg-orange-500 text-white px-2 py-0.5 rounded ml-1">12-14</span> Warning • 
          <span className="bg-red-600 text-white px-2 py-0.5 rounded ml-1">15</span> Max (cannot mark away)
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 overflow-y-auto" style={{ maxHeight: '500px' }}>
          {(players || []).map(player => {
            const absences = player.absenceCount || 0;
            const isAtMax = absences >= 15;
            const isNearMax = absences >= 12 && absences < 15;
            
            return (
              <div
                key={player.id}
                className={`flex items-center justify-between p-3 rounded-lg border-2 transition ${
                  player.present
                    ? 'border-green-200 bg-green-50'
                    : 'border-red-200 bg-red-50'
                }`}
              >
                <div className="flex-1">
                  <span className="font-medium text-gray-800">{player.name}</span>
                  <div className="flex items-center gap-2 mt-1">
                    <span className={`text-xs px-2 py-0.5 rounded ${
                      isAtMax ? 'bg-red-600 text-white font-bold' :
                      isNearMax ? 'bg-orange-500 text-white font-semibold' :
                      'bg-gray-200 text-gray-700'
                    }`}>
                      {absences}/15 absences
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {editMode && (
                    <button
                      onClick={() => deletePlayer(player.id)}
                      className="px-3 py-1 rounded-full text-sm font-semibold bg-red-600 text-white hover:bg-red-700 transition"
                    >
                      Delete
                    </button>
                  )}
                  <button
                    onClick={() => togglePresence(player.id)}
                    disabled={player.present && isAtMax}
                    className={`px-3 py-1 rounded-full text-sm font-semibold transition ${
                      player.present
                        ? isAtMax 
                          ? 'bg-gray-400 text-gray-700 cursor-not-allowed'
                          : 'bg-green-600 text-white hover:bg-green-700'
                        : 'bg-red-600 text-white hover:bg-red-700'
                    }`}
                  >
                    {player.present ? 'Present' : 'Away'}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Team Generation</h2>
        
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Number of Teams (4-6)
            </label>
            <input
              type="number"
              min="4"
              max="6"
              value={numTeams}
              onChange={(e) => setNumTeams(parseInt(e.target.value) || 4)}
              className="px-4 py-2 border border-gray-300 rounded-lg w-32"
            />
            <p className="text-xs text-gray-500 mt-1">
              4 teams = 3 rounds | 5 teams = 4 rounds each | 6 teams = 5 rounds
            </p>
          </div>
          
          <div className="flex items-end">
            <button
              onClick={handleGenerateTeams}
              disabled={weeklySession.isLocked}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700 transition flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <Shuffle size={20} />
              Generate Teams
            </button>
          </div>
        </div>

        {weeklySession.teams && weeklySession.teams.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {weeklySession.teams.map(team => (
              <div key={team.teamNumber} className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                <h3 className="font-bold text-lg text-indigo-600 mb-3">
                  Team {team.teamLetter}
                </h3>
                <ul className="space-y-1">
                  {(team.players || []).map(player => (
                    <li key={player.id} className="text-indigo-700 font-bold text-lg">
                      • {player.name}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </div>

      {weeklySession.teams && weeklySession.teams.length > 0 && (
        <>
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl shadow-lg p-6 border-2 border-purple-200">
            <h3 className="text-lg font-bold text-gray-800 mb-3 flex items-center gap-2">
              <Award size={24} className="text-purple-600" />
              Bonus Points Reference ({weeklySession.teams.length} Teams)
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
              {weeklySession.teams.length === 5 ? (
                <>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">3,500+</div>
                    <div className="font-bold text-purple-600">1 pt</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">5,500+</div>
                    <div className="font-bold text-purple-600">2 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">6,500+</div>
                    <div className="font-bold text-purple-600">3 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">7,500+</div>
                    <div className="font-bold text-purple-600">4 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">9,500+</div>
                    <div className="font-bold text-purple-600">5 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">11,500+</div>
                    <div className="font-bold text-purple-600">6 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">13,500+</div>
                    <div className="font-bold text-purple-600">7 pts</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">4,000+</div>
                    <div className="font-bold text-purple-600">1 pt</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">6,000+</div>
                    <div className="font-bold text-purple-600">2 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">7,000+</div>
                    <div className="font-bold text-purple-600">3 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">8,000+</div>
                    <div className="font-bold text-purple-600">4 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">10,000+</div>
                    <div className="font-bold text-purple-600">5 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">12,000+</div>
                    <div className="font-bold text-purple-600">6 pts</div>
                  </div>
                  <div className="bg-white p-2 rounded text-center">
                    <div className="text-xs text-gray-600">14,000+</div>
                    <div className="font-bold text-purple-600">7 pts</div>
                  </div>
                </>
              )}
            </div>
            <p className="text-xs text-gray-600 mt-3 text-center">
              Bonus points are automatically calculated based on team total score. You can override manually if needed.
            </p>
          </div>
          
          <Scoreboard
            teams={weeklySession.teams}
            fixtures={weeklySession.fixtures}
            teamScores={weeklySession.teamScores}
            onFixtureChange={handleFixtureChange}
            onBonusChange={handleBonusChange}
            isLocked={weeklySession.isLocked}
          />
        </>
      )}

      <div className="bg-white rounded-xl shadow-lg p-6">
        <h2 className="text-xl font-bold text-gray-800 mb-4">Weekly Session</h2>
        
        <div className="flex flex-wrap gap-4">
          <button
            onClick={handleSaveSession}
            disabled={weeklySession.isLocked || !weeklySession.teams || weeklySession.teams.length === 0}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition flex items-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed font-semibold"
          >
            <Save size={20} />
            {weeklySession.isLocked ? 'Session Saved ✓' : 'Save Weekly Session'}
          </button>
          
          <button
            onClick={handleStartNewWeek}
            className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition flex items-center gap-2 font-semibold"
          >
            <RefreshCw size={20} />
            Start New Week
          </button>
          
          {weeklySession.teams && weeklySession.teams.length > 0 && (
            <>
              <button
                onClick={downloadSpreadsheet}
                className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition flex items-center gap-2 font-semibold"
              >
                <Award size={20} />
                Download Scorecard (CSV)
              </button>
              <button
                onClick={() => { setShowEmailModal(true); setEmailError(''); setEmailSuccess(''); }}
                className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 font-semibold"
              >
                <Mail size={20} />
                Email Scorecard
              </button>
            </>
          )}
        </div>

        {weeklySession.isLocked && (
          <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
            <p className="text-green-800 font-medium">
              ✓ Session locked. Points have been applied. Start a new week to continue scoring.
            </p>
          </div>
        )}

        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Points System:</strong> Away players receive +3 only. Present players receive Team Total Points (Rank Points + Bonus Points).
            <br />
            <strong>Rank Points:</strong> Fixed system - 1st place: 6 pts, 2nd: 5 pts, 3rd: 4 pts, 4th: 3 pts, 5th: 2 pts, 6th: 1 pt.
            <br />
            <strong>Ties:</strong> Teams with the same total score receive the same rank points. Next team skips ranks (e.g., two 1st place teams both get 6 pts, next team gets 4 pts for 3rd place).
            <br />
            <strong>Bonus Points:</strong> Auto-calculated based on Total Score. Different thresholds for 5 teams vs 4/6 teams.
            <br />
            <strong>Max Absences:</strong> Players can have a maximum of 15 absences. After 15, they cannot be marked as away.
            <br />
            <strong>Manual Editing:</strong> Admins can click on any player's weekly scores or absences in the Leaderboard view to manually adjust them. Total points are automatically recalculated from weekly scores.
            <br />
            <strong>Download Scorecard:</strong> Click "Download Scorecard (CSV)" to download a spreadsheet file. Open it in Excel, Google Sheets, or Numbers. You can then attach it to an email in Resend or any email service.
          </p>
        </div>
      </div>
      
      {showPasswordModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={handlePasswordCancel}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">Enter Password</h3>
            <p className="text-sm text-gray-600 mb-4">
              Password required to edit players
            </p>
            
            <input
              type="password"
              value={passwordInput}
              onChange={(e) => setPasswordInput(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') handlePasswordSubmit();
                if (e.key === 'Escape') handlePasswordCancel();
              }}
              placeholder="Enter password"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent mb-4"
              autoFocus
            />
            
            <div className="flex gap-3">
              <button
                onClick={handlePasswordSubmit}
                className="flex-1 bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 font-semibold"
              >
                Submit
              </button>
              <button
                onClick={handlePasswordCancel}
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showDeleteConfirm && playerToDelete && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={cancelDelete}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-xl font-bold text-gray-800 mb-4">Confirm Deletion</h3>
            <p className="text-gray-700 mb-6">
              Are you sure you want to remove <strong>{(players || []).find(p => p.id === playerToDelete)?.name}</strong>? 
              This will delete all their history and cannot be undone.
            </p>
            
            <div className="flex gap-3">
              <button
                onClick={confirmDelete}
                className="flex-1 bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 font-semibold"
              >
                Yes, Delete
              </button>
              <button
                onClick={cancelDelete}
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-semibold"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      
      {showEmailModal && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
          onClick={() => !emailSending && setShowEmailModal(false)}
        >
          <div 
            className="bg-white rounded-xl shadow-2xl p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-indigo-100 p-2 rounded-full">
                <Mail size={24} className="text-indigo-600" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-gray-800">Email Scorecard</h3>
                <p className="text-sm text-gray-500">Week {weekCounter} — CSV attachment</p>
              </div>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-semibold text-gray-700 mb-2">Recipients</label>
              <div className="flex gap-2">
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => { setNewEmail(e.target.value); setEmailError(''); }}
                  onKeyPress={(e) => e.key === 'Enter' && handleAddEmail()}
                  placeholder="email@example.com"
                  className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                />
                <button
                  onClick={handleAddEmail}
                  className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold text-sm"
                >
                  Add
                </button>
              </div>
            </div>

            {savedEmails.length > 0 ? (
              <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden">
                <div className="bg-gray-50 px-3 py-2 text-xs font-semibold text-gray-600 border-b border-gray-200">
                  {savedEmails.length} recipient{savedEmails.length !== 1 ? 's' : ''} (saved for next time)
                </div>
                <div className="max-h-40 overflow-y-auto">
                  {savedEmails.map((email, idx) => (
                    <div key={idx} className="flex items-center justify-between px-3 py-2 border-b border-gray-100 last:border-b-0 hover:bg-gray-50">
                      <span className="text-sm text-gray-700">{email}</span>
                      <button
                        onClick={() => handleRemoveEmail(email)}
                        className="text-red-500 hover:text-red-700 text-xs font-semibold px-2 py-1 rounded hover:bg-red-50"
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="mb-4 p-3 bg-gray-50 border border-gray-200 rounded-lg text-center text-sm text-gray-500">
                No recipients yet. Add email addresses above.
              </div>
            )}

            {emailError && (
              <div className="mb-3 p-2 bg-red-50 border border-red-200 rounded text-sm text-red-700">
                {emailError}
              </div>
            )}
            {emailSuccess && (
              <div className="mb-3 p-2 bg-green-50 border border-green-200 rounded text-sm text-green-700">
                {emailSuccess}
              </div>
            )}

            <div className="flex gap-3 mt-4">
              <button
                onClick={handleSendEmail}
                disabled={emailSending || savedEmails.length === 0}
                className="flex-1 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 font-semibold flex items-center justify-center gap-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
              >
                {emailSending ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail size={16} />
                    Send to {savedEmails.length} recipient{savedEmails.length !== 1 ? 's' : ''}
                  </>
                )}
              </button>
              <button
                onClick={() => setShowEmailModal(false)}
                disabled={emailSending}
                className="flex-1 bg-gray-400 text-white px-4 py-2 rounded-lg hover:bg-gray-500 font-semibold disabled:cursor-not-allowed"
              >
                Cancel
              </button>
            </div>

            <p className="text-xs text-gray-400 mt-3 text-center">
              Emails are sent via Resend. Make sure the backend server is running.
            </p>
          </div>
        </div>
      )}
      
    </div>
  );
};

const Sidebar = ({ isOpen, onClose, role, view, setView, handleLogout }) => {
  return (
    <>
      {isOpen && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 z-40"
          onClick={onClose}
        />
      )}
      
      <div 
        className={`fixed top-0 left-0 h-full w-64 bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-6">
          <button
            onClick={onClose}
            className="absolute top-4 left-4 text-gray-600 hover:text-gray-800"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>

          <div className="mb-8 mt-4">
            <h3 className="text-lg font-bold text-gray-800">
              {role === 'admin' ? '🔧 Admin Mode' : '👤 User Mode'}
            </h3>
          </div>

          <div className="space-y-4">
            {role === 'admin' && (
              <>
                <button
                  onClick={() => { setView('admin'); onClose(); }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
                    view === 'admin'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Users size={20} />
                    <span>Admin Dashboard</span>
                  </div>
                </button>
                
                <button
                  onClick={() => { setView('leaderboard'); onClose(); }}
                  className={`w-full text-left px-4 py-3 rounded-lg font-medium transition ${
                    view === 'leaderboard'
                      ? 'bg-indigo-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <Trophy size={20} />
                    <span>Leaderboard</span>
                  </div>
                </button>
              </>
            )}

            <div className="border-t border-gray-200 pt-4 mt-4">
              <button
                onClick={() => { handleLogout(); onClose(); }}
                className="w-full text-left px-4 py-3 rounded-lg font-medium bg-red-100 text-red-700 hover:bg-red-200 transition"
              >
                <div className="flex items-center gap-3">
                  <LogOut size={20} />
                  <span>Logout</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

function App() {
  const [role, setRole] = useState(null);
  const [appState, setAppState] = useState(null);
  const [view, setView] = useState('admin');
  const [isLoading, setIsLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [syncStatus, setSyncStatus] = useState('');

  useEffect(() => {
    document.title = 'Weekly Team Scorer';
  }, []);

  // Initial load: try remote first, fall back to local, then defaults
  useEffect(() => {
    const loadState = async () => {
      try {
        const remote = await fetchRemoteState();
        if (remote && remote.players && remote.players.length > 0) {
          setAppState(remote);
          saveToStorage(remote);
          setIsLoading(false);
          return;
        }
      } catch (err) {
        console.log('Remote load failed, trying local:', err);
      }

      const local = loadFromStorage();
      if (local && local.players && local.players.length > 0) {
        setAppState(local);
        saveRemoteState(local);
      } else {
        const defaults = getDefaultState();
        setAppState(defaults);
        saveRemoteState(defaults);
        saveToStorage(defaults);
      }
      setIsLoading(false);
    };
    loadState();
  }, []);

  // Save to both local and remote whenever state changes
  useEffect(() => {
    if (appState) {
      saveToStorage(appState);
      // Only admin saves to remote to avoid conflicts
      if (role === 'admin') {
        saveRemoteState(appState);
      }
    }
  }, [appState, role]);

  // Polling: user view refreshes from remote every 5 seconds
  useEffect(() => {
    if (role !== 'user') return;

    const interval = setInterval(async () => {
      try {
        const remote = await fetchRemoteState();
        if (remote && remote.players && remote.players.length > 0) {
          setAppState(remote);
          saveToStorage(remote);
        }
      } catch (err) {
        console.log('Polling failed:', err);
      }
    }, 5000);

    return () => clearInterval(interval);
  }, [role]);

  // Admin: manual sync button handler
  const handleSyncNow = async () => {
    setSyncStatus('syncing');
    try {
      await saveRemoteState(appState);
      setSyncStatus('saved');
      setTimeout(() => setSyncStatus(''), 2000);
    } catch {
      setSyncStatus('error');
      setTimeout(() => setSyncStatus(''), 3000);
    }
  };

  const handleLogout = () => {
    setRole(null);
    setView('admin');
  };
  
  useEffect(() => {
    if (role === 'admin') {
      setView('admin');
    }
  }, [role]);

  const handleResetAll = () => {
    const resetPlayers = (appState.players || []).map(p => ({
      ...p,
      totalPoints: 0,
      absenceCount: 0,
      weeklyHistory: [],
      present: true
    }));

    const freshState = {
      players: resetPlayers,
      weeklySession: {
        isLocked: false,
        teams: [],
        fixtures: [],
        teamScores: [],
        timestamp: Date.now(),
        weekNumber: 1
      },
      weekCounter: 1
    };

    setAppState(freshState);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  if (!role) {
    return <LoginPage onLogin={setRole} />;
  }

  if (!appState) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 bg-white rounded-lg shadow-lg hover:bg-gray-100 transition"
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      >
        <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* Sync indicator */}
      <div className="fixed top-4 right-4 z-30 flex items-center gap-2">
        {role === 'user' && (
          <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
            ● Live sync
          </span>
        )}
        {role === 'admin' && (
          <button
            onClick={handleSyncNow}
            className="text-xs bg-white text-gray-700 px-3 py-1 rounded-full shadow hover:bg-gray-50 flex items-center gap-1"
          >
            <RefreshCw size={12} className={syncStatus === 'syncing' ? 'animate-spin' : ''} />
            {syncStatus === 'syncing' ? 'Syncing...' : syncStatus === 'saved' ? 'Synced ✓' : syncStatus === 'error' ? 'Sync failed' : 'Sync'}
          </button>
        )}
      </div>

      <Sidebar
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        role={role}
        view={view}
        setView={setView}
        handleLogout={handleLogout}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {role === 'user' ? (
          <div className="space-y-6">
            {appState.weeklySession.teams && appState.weeklySession.teams.length > 0 ? (
              <>
                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Users size={24} className="text-indigo-600" />
                    Current Week Teams
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    {appState.weeklySession.teams.map(team => (
                      <div key={team.teamNumber} className="border-2 border-indigo-200 rounded-lg p-4 bg-indigo-50">
                        <h3 className="font-bold text-lg text-indigo-600 mb-3">
                          Team {team.teamLetter}
                        </h3>
                        <ul className="space-y-1">
                          {(team.players || []).map(player => (
                            <li key={player.id} className="text-indigo-700 font-bold text-lg">
                              • {player.name}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white rounded-xl shadow-lg p-6">
                  <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                    <Award size={24} className="text-purple-600" />
                    This Week's Scores
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full border-2 border-gray-200">
                      <thead>
                        <tr className="bg-gray-100">
                          <th className="border border-gray-300 px-2 py-2 text-sm">Team</th>
                          {Array.from({ length: appState.weeklySession.teamScores[0]?.roundScores?.length || 0 }).map((_, idx) => (
                            <th key={idx} className="border border-gray-300 px-2 py-2 text-sm">R{idx + 1}</th>
                          ))}
                          <th className="border border-gray-300 px-2 py-2 text-sm font-bold">Total</th>
                          <th className="border border-gray-300 px-2 py-2 text-sm font-bold bg-blue-100">Rank</th>
                          <th className="border border-gray-300 px-2 py-2 text-sm font-bold bg-green-100">Bonus</th>
                          <th className="border border-gray-300 px-2 py-2 text-sm font-bold bg-indigo-100">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {appState.weeklySession.teamScores.map(ts => (
                          <tr key={ts.teamNumber}>
                            <td className="border border-gray-300 px-2 py-2 text-center font-bold text-indigo-600">
                              {ts.teamLetter}
                            </td>
                            {(ts.roundScores || []).map((score, idx) => (
                              <td key={idx} className="border border-gray-300 px-2 py-2 text-center">
                                {score || 0}
                              </td>
                            ))}
                            <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-blue-50">
                              {ts.totalScore}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-blue-50">
                              {ts.rankPoints}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-green-50">
                              {ts.bonusPoints}
                            </td>
                            <td className="border border-gray-300 px-2 py-2 text-center font-bold bg-indigo-50">
                              {ts.teamTotalPoints}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                    <strong>Rank Points:</strong> 1st=6, 2nd=5, 3rd=4, 4th=3, 5th=2, 6th=1 • 
                    <strong> Bonus Points:</strong> Based on Total Score • 
                    <strong> Points:</strong> Rank + Bonus
                  </div>
                </div>
              </>
            ) : (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <div className="text-center py-12 text-gray-500">
                  <p className="text-lg">No teams generated for this week yet.</p>
                  <p className="text-sm mt-2">Check back once the admin has set up the teams and fixtures.</p>
                </div>
              </div>
            )}

            <Leaderboard 
              players={appState.players}
              isAdmin={false}
              onUpdateWeeklyScore={() => {}}
              onUpdateAbsences={() => {}}
            />
          </div>
        ) : view === 'leaderboard' ? (
          <Leaderboard 
            players={appState.players}
            isAdmin={role === 'admin'}
            onResetAll={handleResetAll}
            onUpdateWeeklyScore={(playerId, weekNumber, newPoints) => {
              const updatedPlayers = appState.players.map(p => {
                if (p.id !== playerId) return p;
                
                const updatedHistory = (p.weeklyHistory || []).map(record =>
                  record.weekNumber === weekNumber
                    ? { ...record, pointsEarned: newPoints }
                    : record
                );
                
                const newTotal = updatedHistory.reduce((sum, record) => sum + (record.pointsEarned || 0), 0);
                
                return {
                  ...p,
                  weeklyHistory: updatedHistory,
                  totalPoints: newTotal
                };
              });
              
              setAppState({ ...appState, players: updatedPlayers });
            }}
            onUpdateAbsences={(playerId, newAbsences) => {
              const updatedPlayers = appState.players.map(p =>
                p.id === playerId ? { ...p, absenceCount: newAbsences } : p
              );
              setAppState({ ...appState, players: updatedPlayers });
            }}
          />
        ) : (
          <AdminDashboard appState={appState} onUpdate={setAppState} />
        )}
      </main>
    </div>
  );
}

export default App;