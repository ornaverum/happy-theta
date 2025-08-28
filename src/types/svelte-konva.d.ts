declare module 'svelte-konva' {
  // Konva Event Types
  export interface KonvaEventObject<EventType extends Event> {
    type: string;
    target: any;
    evt: EventType;
    currentTarget: any;
    cancelBubble: boolean;
  }

  export interface KonvaMouseEvent extends KonvaEventObject<MouseEvent> {
    evt: MouseEvent;
  }

  export interface KonvaPointerEvent extends KonvaEventObject<PointerEvent> {
    evt: PointerEvent;
  }

  export interface KonvaTouchEvent extends KonvaEventObject<TouchEvent> {
    evt: TouchEvent;
  }

  export interface KonvaWheelEvent extends KonvaEventObject<WheelEvent> {
    evt: WheelEvent;
  }

  export interface KonvaDragEvent extends KonvaEventObject<DragEvent> {
    evt: DragEvent;
  }

  // Simple component exports - let Svelte handle the typing
  export const Stage: any;
  export const Layer: any;
  export const Group: any;
  export const Rect: any;
  export const Circle: any;
  export const Line: any;
  export const Arrow: any;
  export const Text: any;
  export const Image: any;
  export const Ellipse: any;
  export const Path: any;
  export const RegularPolygon: any;
  export const Star: any;
  export const Ring: any;
  export const Arc: any;
  export const Wedge: any;
  export const Transformer: any;
}
