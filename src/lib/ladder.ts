// Escada de exercícios: 1 reconhecer → 2 lembrar → 3 produzir.
// Sobe com 2 acertos seguidos (Bom ou Fácil); Difícil mantém o nível; erro desce um nível.
import { Rating } from 'ts-fsrs';

export interface LadderState {
  level: number;
  streak: number;
}

export function nextLadder(s: LadderState, rating: Rating): LadderState {
  if (rating === Rating.Again) return { level: Math.max(1, s.level - 1), streak: 0 };
  if (rating === Rating.Hard) return { level: s.level, streak: 0 };
  const streak = s.streak + 1;
  if (streak >= 2 && s.level < 3) return { level: s.level + 1, streak: 0 };
  return { level: s.level, streak: Math.min(streak, 2) };
}
