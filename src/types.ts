export interface Point {
  x: number;
  y: number;
}

export interface StrokeTransform {
  tx: number;
  ty: number;
  scale: number;
  rotation: number;
}

export interface Stroke {
  id: string;
  points: Point[];
  color: string;
  width: number;
  transform: StrokeTransform;
}

export type GestureType = 
  | 'NONE'
  | 'DRAW'
  | 'ERASE'
  | 'CLEAR'
  | 'MOVE'
  | 'SCALE'
  | 'ROTATE';

export interface HandState {
  isActive: boolean;
  gesture: GestureType;
  position: Point; // Normalized 0-1
  rawLandmarks: any[];
}

export interface AppState {
  strokes: Stroke[];
  rightHand: HandState;
  leftHand: HandState;
  activeStrokeId: string | null;
}
