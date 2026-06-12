// Paleta do Aspis — idêntica ao CoMentor (src/theme/colors.ts), trocando a
// coruja pelo escudo da Medusa. Não editar valores sem comparar lado a lado.
export const colors = {
  bg: {
    primary: '#1B1F3B',
    gradientEnd: '#2D2B55',
    surface: 'rgba(255,255,255,0.06)',
    surfaceStrong: 'rgba(255,255,255,0.10)',
    overlay: 'rgba(0,0,0,0.55)',
  },
  accent: {
    gold: '#F4C553',
    goldDim: '#C99A3A',
    lavender: '#A78BFA',
    success: '#7DD3A8',
    warning: '#F59E5C',
    danger: '#E47878',
  },
  text: {
    primary: 'rgba(255,255,255,0.92)',
    secondary: 'rgba(255,255,255,0.55)',
    tertiary: 'rgba(255,255,255,0.35)',
    onGold: '#1B1F3B',
  },
  border: 'rgba(255,255,255,0.08)',
  star: 'rgba(255,255,255,0.6)',
} as const;

// Espectro de alinhamento (do Aspis desktop): 0=vermelho (pior) → 5=violeta (melhor).
export const ALIGN_COLORS = [
  '#e0443e',
  '#e8803a',
  '#e8c13a',
  '#5bb24a',
  '#3a86c8',
  '#8a5cc8',
] as const;

export const ALIGN_LABELS = ['mínimo', 'baixo', 'médio', 'bom', 'alto', 'máximo'] as const;

export function alignColor(stars: number): string {
  return ALIGN_COLORS[Math.max(0, Math.min(5, Math.round(stars)))];
}

// Cores dos pills de pilar (paleta do desktop adaptada ao tema escuro:
// fundo translúcido do acento + texto no acento).
export const PILLAR_PALETTE = [
  '#A78BFA', // lavender
  '#7DD3A8', // success
  '#F59E5C', // warning
  '#F4C553', // gold
  '#E47878', // danger
  '#7CB8E8', // azul
] as const;

export function pillarColor(index: number): string {
  return PILLAR_PALETTE[index % PILLAR_PALETTE.length];
}
