export type Point = {
    x: number,
    y: number,
};

export type Vector = {
    pos0: Point,
    pos1: Point,
};

export type TaoItem = {
    id: number,
    symbol: string,
    type: string,
    agent: string,
    object: string,
    color: string,
};

export type Force = {
    id: number,
    symbol: string,
    type: string,
    agent: string,
    object: string,
    components: Point,
    color: string;
    draggable: boolean;
    editText: boolean;
};

export type FBD = {
    id: number,
    title: string,
    width: number,
    height: number,
    marginY: number,
    forceList: Force[],
}

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