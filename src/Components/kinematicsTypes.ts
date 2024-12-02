export type VectorArrow = {
    id: number,
    pos0: {x: number, y: number},
    pos1: {x: number, y: number},
    stroke: string,
    opacity: number,
};

export type Dot = {
    id: number,
    x: number,
    y: number,
    radius: number,
    fill: string,
    opacity: number,
};

export type Point ={
    x: number,
    y: number,
};

export type MD = {
    id: number,
    title: string,
    width: number,
    height: number,
    gridNum: number,
    marginY: number,
    posList: Dot[],
    velList: VectorArrow[],
    accList: VectorArrow[],
}

export type acceleration = {
    id: number,
    dir: number,
    dot: Dot,
    arrow: VectorArrow,
}

export type GraphPath = {
    id: string,
    points: {x: number, y: number}[],
    data: string,
    curvature: number,
    stroke: string,
    strokeWidth: number,
    opacity: number,
};