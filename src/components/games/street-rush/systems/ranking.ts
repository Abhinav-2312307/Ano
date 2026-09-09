import { RacerState, RankItem } from '../types';

export function computeLiveRankings(racers: RacerState[], localUserId: string): RankItem[] {
  // Sort racers by progress descending
  const sorted = [...racers].sort((a, b) => {
    // Finished racers are always ahead, ordered by finishPosition / finishTime
    if (a.isFinished && b.isFinished) {
      if (a.finishPosition && b.finishPosition) {
        return a.finishPosition - b.finishPosition;
      }
      return (a.finishTime || 0) - (b.finishTime || 0);
    }
    if (a.isFinished && !b.isFinished) return -1;
    if (!a.isFinished && b.isFinished) return 1;

    return b.progress - a.progress;
  });

  const rankItems: RankItem[] = [];

  for (let i = 0; i < sorted.length; i++) {
    const r = sorted[i];
    const rank = i + 1;
    r.rank = rank;

    rankItems.push({
      userId: r.userId,
      nickname: r.nickname,
      avatar: r.avatar,
      rank,
      completedLaps: r.completedLaps,
      currentCheckpoint: r.currentCheckpoint,
      isFinished: r.isFinished,
      finishTime: r.finishTime,
      speed: Math.round(Math.abs(r.speed) * 3.6), // km/h
      isLocal: r.userId === localUserId,
    });
  }

  return rankItems;
}
