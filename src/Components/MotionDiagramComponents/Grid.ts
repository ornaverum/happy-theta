export class Grid {
    height: number;
    width: number;
    margin: number;
    axes: {x: number, y:number}
    tickCoords: {x: number[], y:number[]};
    numCells:{x:number, y:number};

    origin: {x: number, y:number};
    gridSize: {x: number, y:number};

    constructor(height:number, width:number, margin:number, numCells:{x:number, y:number}){
        this.height = height;
        this. width = width;
        this.margin = margin;
        this.numCells = numCells;
    }

	export const getPointFromStage:Function = (pt:Point)=>{
		return {x: (pt.x - offSet.x)/cellSize, y: (pt.y - offSet.y)/cellSize};
	}

	export const getStageFromPoint:Function = (pt:Point)=>{
		return {x: pt.x*cellSize + offSet.x, y: pt.y*cellSize + offSet.y};
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