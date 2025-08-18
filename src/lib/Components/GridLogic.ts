import type {Point} from '$lib/types';
import {tick} from 'svelte';

type GridLine = {
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    gridLineType?: 'minor' | 'major' | 'axis',

}

export default class GridLogic {
    size?: Point;
    numCells?: Point;
    origin?: Point;
    cellSize?: number;
    stageCenter?: Point;
    gridCenter?: Point;
    offSet?: Point;
    gridList?: GridLine[];

    constructor({numCells={x:10, y:10}, origin={x:0, y:0}, 
            cellSize=20, stageCenter=undefined, gridList=undefined}) {

        this.numCells = numCells;
        this.cellSize = cellSize;

        this.origin = origin;

        this.size = {x:(this.numCells.x+2)*this.cellSize, y:(this.numCells.y+2)*this.cellSize};

        this.stageCenter = {x: this.size.x/2.0, y: this.size.y/2.0};

        this.gridCenter = {x: this.origin.x + this.numCells.x*this.cellSize/2.0, y: this.origin.y + this.numCells.y*this.cellSize/2.0};
        this.offSet = this.calculateOffset(this.gridCenter, this.stageCenter);
        this.gridList = gridList || this.buildGridLines(this.numCells, this.cellSize, this.origin);
    }

    init = async () => {
        await tick();
    }

    range(start:number, end:number, step:number = 1) {
        const length = Math.ceil((end - start) / step);
        return Array.from({ length }, (_, i) => start + i * step);
    }

    calculateOffset:Function= (gridCenter: Point, stageCenter: Point)=>{
		return {x: -gridCenter.x + stageCenter.x, y: -gridCenter.y + stageCenter.y};
	}


    getPointFromStage:Function = (point: Point)=>{
        console.log('getPointFromStage', point, this.offSet, this.cellSize, this.origin);
        console.log({x: (point.x - this.offSet.x)/this.cellSize - this.origin.x, 
            y: (point.y - this.offSet.y)/this.cellSize - this.origin.y});
            
        return {x: (point.x - this.offSet.x)/this.cellSize - this.origin.x, 
            y: (point.y - this.offSet.y)/this.cellSize - this.origin.y};
    }

    getSnappedPointFromStage:Function = (point: Point)=>{
        let pt = this.getPointFromStage(point);
        pt.x = Math.min(Math.max(Math.round(pt.x), -this.origin.x), this.numCells.x-this.origin.x);
        pt.y = Math.min(Math.max(Math.round(pt.y), -this.origin.y), this.numCells.y-this.origin.y);
        return pt;
    }

    getStageFromPoint:Function = (point: Point)=>{
        let pt:Point = {x: (point.x + this.origin.x)*this.cellSize + this.offSet.x, 
                        y: (point.y + this.origin.y)*this.cellSize + this.offSet.y};
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
                gridLineType: (i-origin.x)%5==0?'major':'minor',
            });
        }
    

        // gridlines for y (i.e., parallel to x-axis)

        for (let i = 0; i <= numCells.y; i++) {
            let yVal = i*cellSize;
            let xVali = numCells.x==0 ? -cellSize : 0;
            let xValf = numCells.x==0 ? cellSize : numCells.x*cellSize;
            gridList.push({
                x0: xVali + this.offSet.x,
                y0: yVal + this.offSet.y,
                x1: xValf + this.offSet.x,
                y1: yVal + this.offSet.y,
                gridLineType: (i-origin.y)%5==0?'major':'minor',
            });
        }
    
    
        // y axis
        let x_0 = origin.x * cellSize + this.offSet.x;
        gridList.push({
            x0: x_0,
            y0: numCells.y==0?cellSize * 1.5+ this.offSet.y :numCells.y*cellSize+ this.offSet.y,
            x1: x_0,
            y1: numCells.y==0?-cellSize * 1.5 + this.offSet.y - cellSize/2.0 : 0+ this.offSet.y - cellSize/2.0,
            gridLineType: 'axis',
        });
    
        // x axis
        let y_0 = (numCells.y - origin.y) * cellSize+ this.offSet.y;
        gridList.push({
            x0: numCells.x==0?-cellSize + this.offSet.x : 0 + this.offSet.x,
            y0: y_0,
            x1: numCells.x==0? cellSize + this.offSet.x : numCells.x*cellSize + this.offSet.x + cellSize/2.0,
            y1: y_0,
            gridLineType: 'axis',

        });
        return gridList;
    }
} 
