export enum ToolType {
  PEN = 'PEN',
  ERASER = 'ERASER'
}

export enum EffectType {
  NORMAL = 'NORMAL',
  RAINBOW = 'RAINBOW',
  FIRE = 'FIRE',
  NEON = 'NEON'
}

export interface Point {
  x: number;
  y: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  size: number;
  color: string;
  effect?: EffectType; // Track which effect created this particle
}

export interface DrawStyle {
  color: string;
  width: number;
}

export interface AIResponse {
  type: 'analysis' | 'image';
  content: string; // Text response or Base64 image
  loading: boolean;
}

export enum GeminiModel {
  VISION = 'gemini-2.5-flash-image',
  TEXT = 'gemini-3-flash-preview'
}
