export class Grid {
    height: number;
    width: number;
    margin: number;
    axes: {x: number, y:number}
    tickCoords: {x: number[], y:number[]};
    numTicks:{x:number, y:number};

    gridCenter: {x: number, y:number};
    gridSize: {x: number, y:number};

    constructor(height:number, width:number, margin:number, numTicks:{x:number, y:number}){
        this.height = height;
        this. width = width;
        this.margin = margin;
        this.numTicks = numTicks;
    }



} 



function range(start:number, end:number, step:number = 1) {
    const length = Math.ceil((end - start) / step);
    return Array.from({ length }, (_, i) => start + i * step);
  }

export const findClosestGridPoint:Function = ()=>{

}

// size is the height or width, depending
export const generateGridCoords = (size:number, numGrids:number, margin:number = 10)=>{
    return range(margin, size-margin, numGrids);
}