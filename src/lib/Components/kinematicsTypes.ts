export type Point = {
    x: number,
    y: number,
};

export type Velocity = {
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
    posList: Point[],
    accList: Vector[],
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