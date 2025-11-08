export type DetResult = {
  label: string;
  score: number;
  bbox: [number, number, number, number]; // [x,y,width,height]
};

