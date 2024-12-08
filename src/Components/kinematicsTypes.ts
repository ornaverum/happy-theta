export type Point = {
    x: number,
    y: number,
};

export type VectorArrow = {
    id: number,
    pos0: Point,
    pos1: Point,
    stroke: string,
    opacity: number,
};

export type Position = {
    id: number,
    pos: Point,
    radius: number,
    fill: string,
    opacity: number,
};


export type MD = {
    id: number,
    title: string,
    width: number,
    height: number,
    gridNum: number,
    marginY: number,
    posList: Position[],
    velList: VectorArrow[],
    accList: VectorArrow[],
}

export type acceleration = {
    id: number,
    dir: number,
    Position: Position,
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