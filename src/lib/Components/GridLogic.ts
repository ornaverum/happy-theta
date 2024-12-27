import type {Point} from '$lib/types';

type GridLine = {
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    gridLineType?: 'minor' | 'major' | 'axis',

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

    constructor({size={x:500, y:500}, margin={x:5, y:5}, numCells={x:5, y:5}, origin={x:0, y:0}, cellSize=0, stageCenter=undefined, gridCenter=undefined, offSet=undefined, gridList=undefined}) {
        this.size = size;
        this.margin = margin;
        this.numCells = numCells;
        this.origin = origin;
        this.cellSize = cellSize || Math.min((size.x-2*margin.x)/(numCells.x+1), (size.y-2*margin.y)/(numCells.y+1));
        this.stageCenter = stageCenter ||{x: size.x/2.0, y: size.y/2.0};
        this.gridCenter = gridCenter || {x: origin.x + this.numCells.x*this.cellSize/2.0, y: origin.y + this.numCells.y*this.cellSize/2.0};
        this.offSet = offSet || this.calculateOffset(this.gridCenter, this.stageCenter);
        this.gridList = gridList || this.buildGridLines(this.numCells, this.cellSize, this.origin);
    }

    range(start:number, end:number, step:number = 1) {
        const length = Math.ceil((end - start) / step);
        return Array.from({ length }, (_, i) => start + i * step);
    }

    calculateOffset:Function= (gridCenter: Point, stageCenter: Point)=>{
		return {x: -gridCenter.x + stageCenter.x, y: -gridCenter.y + stageCenter.y};
	}


    getPointFromStage:Function = (point: Point)=>{
        return {x: (point.x - this.offSet.x)/this.cellSize, y: (point.y - this.offSet.y)/this.cellSize};
    }

    getSnappedPointFromStage:Function = (point: Point)=>{
        let pt = this.getPointFromStage(point);

        pt.x = Math.min(Math.max(Math.round(pt.x), 0), this.numCells.x);
        pt.y = Math.min(Math.max(Math.round(pt.y), 0), this.numCells.y);
        return pt;
    }

    getStageFromPoint:Function = (point: Point)=>{

        let pt:Point = {x: point.x*this.cellSize + this.offSet.x, 
                        y: point.y*this.cellSize + this.offSet.y};

        return pt;
    }

    getGridList:Function = ()=>{
        return this.gridList;
    }

    rebuildGridLines: Function = ()=>{
        this.gridList = this.buildGridLines(this.numCells, this.cellSize, this.origin);
    }

    buildGridLines:Function = (numCells:Point, cellSize:number, origin:Point)=>{

        // gridlines for x (i.e., parallel to y-axis)
        let gridList:GridLine[] = [];
        for (let i = 0; i <= numCells.x; i++) {
            let xVal = i*cellSize;
            let yVali = numCells.y==0 ? -cellSize : 0;
            let yValf = numCells.y==0 ? cellSize : numCells.y*cellSize;
            gridList.push({
                x0: xVal + this.offSet.x,
                y0: yVali + this.offSet.y,
                x1: xVal + this.offSet.x,
                y1: yValf+ this.offSet.y,
                gridLineType: i%5==0?'major':'minor',
            });
        }
    
        // gridlines for y (i.e., parallel to x-axis)
    
        for (let i = 0; i <= numCells.y; i++) {
            let startParallel = i * cellSize;
            let startPerp = 0;
            let endPerp = numCells.x * cellSize;
            gridList.push({
                x0: startPerp + this.offSet.x,
                y0: startParallel+ this.offSet.y,
                x1: endPerp + this.offSet.x,
                y1: startParallel+ this.offSet.y,
                gridLineType: i%5==0?'major':'minor',
            });
        }
    
        // y axis
        let x_0 = origin.x * cellSize + this.offSet.x;
        gridList.push({
            x0: x_0,
            y0: numCells.y==0?cellSize * 1.5+ this.offSet.y:numCells.y*cellSize+ this.offSet.y,
            x1: x_0,
            y1: numCells.y==0?-cellSize * 1.5 + this.offSet.y:0+ this.offSet.y,
            gridLineType: 'axis',
        });
    
        // x axis
        let y_0 = (numCells.y - origin.y) * cellSize+ this.offSet.y;
        gridList.push({
            x0: -2.5 + this.offSet.x,
            y0: y_0,
            x1: numCells.x*cellSize +2.5 + this.offSet.x,
            y1: y_0,
            gridLineType: 'axis',

        });
        return gridList;
    }
} 
