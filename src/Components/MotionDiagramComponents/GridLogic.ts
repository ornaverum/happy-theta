import type {Point} from '../kinematicsTypes';

type GridLine = {
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    strokeColor?: string,
    strokeWidth?: number,


}

export default class GridLogic {
    size?: Point;
    margin?: Point;
    numCells?: Point;
    origin?: Point;
    cellSize?: number;
    stageCenter?: Point;
    gridCenter?: Point;
    offSet?: Point;
    gridList?: GridLine[];

    constructor(size:Point, margin:Point, numCells:Point, origin:Point){
        this.size = size;
        this.margin = margin;
        this.numCells = numCells;
        this.origin = origin;
        this.cellSize = Math.min((size.x-2*margin.x)/(numCells.x+1), (size.y-2*margin.y)/(numCells.y+1));
        this.stageCenter = {x: size.x/2.0, y: size.y/2.0};
        this.gridCenter = {x: origin.x + this.numCells.x*this.cellSize/2.0, y: origin.y + this.numCells.y*this.cellSize/2.0};
        this.offSet = this.calculateOffset(this.gridCenter, this.stageCenter);
        this.gridList = this.buildGridLines(this.numCells, this.cellSize, this.origin);
    }

    range(start:number, end:number, step:number = 1) {
        const length = Math.ceil((end - start) / step);
        return Array.from({ length }, (_, i) => start + i * step);
    }

    calculateOffset:Function= (gridCenter: Point, stageCenter: Point)=>{
		return {x: -gridCenter.x + stageCenter.x, y: -gridCenter.y + stageCenter.y};
	}

    getStageFromPoint:Function = (point: Point, cellSize:number, offSet:Point)=>{
        return {x: point.x*cellSize + offSet.x, y: point.y*cellSize + offSet.y};
    }

    getPointFromStage:Function = (point: Point, cellSize:number, offSet:Point)=>{
        return {x: (point.x - offSet.x)/cellSize, y: (point.y - offSet.y)/cellSize};
    }

    getGridList:Function = ()=>{
        return this.gridList;
    }

    buildGridLines:Function = (numCells:Point, cellSize:number, origin:Point)=>{
        // gridlines for x (i.e., parallel to y-axis)
        let gridList:GridLine[] = [];
        for (let i = 0; i <= numCells.x; i++) {
            let xVal = i*cellSize;
            let yVali = numCells.y==0 ? -cellSize : 0;
            let yValf = numCells.y*cellSize | cellSize;
            gridList.push({
                x0: xVal,
                y0: yVali,
                x1: xVal,
                y1: yValf,
                strokeColor: 'gray',
                strokeWidth: i%5==0?4:2,
            });
        }
    
        // gridlines for y (i.e., parallel to x-axis)
    
        for (let i = 0; i <= numCells.y; i++) {
            let startParallel = i * cellSize;
            let startPerp = 0;
            let endPerp = numCells.x * cellSize;
            gridList.push({
                x0: startPerp,
                y0: startParallel,
                x1: endPerp,
                y1: startParallel,
                strokeColor: 'gray',
                strokeWidth: i%5==0?4:2,
            });
        }
    
        // y axis
        gridList.push({
            x0: origin.x * cellSize,
            y0: numCells.y==0?cellSize * 1.5:numCells.y*cellSize,
            x1: origin.x * cellSize,
            y1: numCells.y==0?-cellSize * 1.5:0-2.5,
            strokeColor: 'black',
                strokeWidth: 5,
        });
    
        // x axis
        gridList.push({
            x0: -2.5,
            y0: (numCells.y - origin.y) * cellSize,
            x1: numCells.x*cellSize +2.5,
            y1: (numCells.y - origin.y) * cellSize,
            strokeColor: 'black',
                strokeWidth: 5,
        });
        return gridList;
    }
} 
