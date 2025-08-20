export type Point = {
    x: number,
    y: number,
};

export type Vector = {
    pos0: Point,
    pos1: Point,
};

export type TaoItem = {
    id?: number,
    symbol: string,
    type: string,
    agent: string,
    object: string,
    color: string,
    editText: boolean
};

export type Force = {
    id: number,
    tao: TaoItem,
    components: Point,
};    


// export type Energy = {
//     id: number,
//     energies: {
//         K: number,
//         Ug: number,
//         Us: number,
//         Eth: number,
//     },
//     transfers: {
//         W: number,
//         Q: number
//     }
// }

export type Energy = {
    id: number,
    energies: {
        K: number,
        Ug: number,
        Us: number,
        Eth: number,
    },
    transfers: {
        W: number,
        Q: number
    }
}

export type EnergyBar = {
    pos: number,   // position value on y axis
    name: string,
    symbol: string,
    value: number,
    color: string,
    opacity?: number,
}


export type Data<T> = {
    type: string,
    id: number,
    title: string,
    instances: BaseData<any>[]
}

export type BaseData<T> = {
    id: number,
    title: string,
    data: T
    params?: any
}

export type FBD = BaseData<{
    forceList: Force[],
}>

export type MD = BaseData<{
    posList: Point[],
    accList: Vector[],
}>

export type EngD = BaseData<{
    energyBars: EnergyBar[],
}>

export type GraphPath = {
    id: string,
    points: {x: number, y: number}[],
    data: string,
    curvature: number,
    stroke: string,
    strokeWidth: number,
    opacity: number,
};