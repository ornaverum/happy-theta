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
    taoItem: TaoItem,
    components: Point,
    color: string;
};

export type BaseData<T> = {
    id: number,
    title: string,
    data: T
}

export type DataSets = {
    type: string,
    id: number,
    title: string,
    instances: BaseData<any>[]
}

export type FBD = BaseData<{
    forceList: Force[],
}>

export type MD = BaseData<{
    posList: Point[],
    accList: Vector[],
}>