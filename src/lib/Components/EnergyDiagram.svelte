<script lang='ts'>
    import Grid from "./Grid.svelte";
    import GridLogic from "./GridLogic";
    import type {Point, EnergyBar} from "../types";
    import {Stage, Layer, Rect, Circle, Text, type KonvaMouseEvent} from "svelte-konva";
    import {setContext, getContext} from "svelte";
	import { BarsFromLeftOutline } from "flowbite-svelte-icons";
    import {onMount} from 'svelte';

    interface Props {
        title?: string;
        id?: number;
        height?: number;
        width?: number;
        numCells?: Point;
        handleDelete?: (e: MouseEvent)=> void;
        workFlag?: boolean;
        margin?: Point;
        energyBars: EnergyBar[];
    }

    let {
        title = $bindable('Title'),
        id = 0,
        height = 200,
        width = 500,
        numCells = {x: 10, y:5},
        margin = {x:5, y:5},
        handleDelete = (e: MouseEvent) => {},
        workFlag = false,
        energyBars = $bindable([])
    }: Props = $props();

    let onStage:boolean = $state(false);
	let originPoint = {x:5, y:1};

    numCells.y = energyBars.length;
    height = 40*(energyBars.length);

    let showControlButtons = getContext('ctrl');

    let windowSize:Point = $state({x:0, y:0});
	let stageContainerSize: Point = $state({x:0, y:0});

    let maxStageSize: Point = $derived.by(() => {
        let szX: number = 0.9*Math.max(stageContainerSize.x, 200);
        let szY: number = 0.9*Math.max(stageContainerSize.y, 200);
	    return {x: Math.max(szX, szY), y: Math.max(szX, szY)};
    });

    let gridLogic:GridLogic = $derived(new GridLogic({maxSize:{...maxStageSize}, margin:{...margin}, numCells:{...numCells}, origin:{...origin} }));

    const initialPositions:(yPt:number)=>Point = (yPt:number)=>{
        let pt:Point = {x: gridLogic.getStageFromPoint({x:5, y:0}).x, 
            y: gridLogic.getStageFromPoint({x:0, y:yPt+0.15}).y };
        return pt;
    }

    const initalStagePositions:Point[] = [
        {...gridLogic.getStageFromPoint({x:0-0.15, y:0+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:1+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:2+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:3+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:4+0.15})},
    ]
    
    let stagePositions:Point[] = $state(initalStagePositions);

    const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        let pt:Point = {x:e.evt.layerX, y:e.evt.layerY};
        let snap:Point = gridLogic.getPointFromStage(pt);
        let bar:number = Math.floor(snap.y);
        snap = {x: Math.max(Math.round(snap.x),0.2)-5, y: bar};
        pt = gridLogic.getStageFromPoint(snap);
        stagePositions[bar] = {x:pt.x-gridLogic.cellSize/3/2, y: initalStagePositions[bar].y};
        energyBars[bar].value = snap.x; //- gridLogic.getStageFromPoint(originPoint).x;
    }


    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        let pt:Point = {x:e.evt.layerX, y:e.evt.layerY};
        let snap:Point = gridLogic.getPointFromStage(pt);
        if (snap.x >= 0 && snap.x <= numCells.x && snap.y >= 0 && snap.y <= numCells.y) {
            let bar:number = Math.floor(snap.y);
            snap = {x: Math.max(Math.round(snap.x),0.2)-5, y: bar};
            pt = gridLogic.getStageFromPoint(snap);
            previewEnergy.id = bar;
            // previewEnergy.origin = {x:pt.x-gridLogic.cellSize/3/2, y: initalStagePositions[bar].y};
            previewEnergy.value = snap.x; //- gridLogic.getStageFromPoint(originPoint).x;
            previewEnergy.color = energyBars[bar].color;
        }
    }


    let previewTotalEnergy: EnergyBar = $derived.by(() => {
        let w = 0;
        energyBars.forEach((bar:EnergyBar)=>{
            if(bar.id !== 4)
                w+=Math.floor(bar.value);
        });
        return {id: 4, name: 'Total Energy Preview', symbol:'E', origin: {...initialPositions(4)}, value: w, color: 'purple', opacity: 0.3};
        // return {id: -1, name: 'Total Energy Preview', symbol:'E', origin: {...initialPositions(4)}, width:3, color: 'purple'};
    });


    let previewEnergy: EnergyBar = $state({id: 4, name: 'Preview', symbol: 'E', value: 0, color: 'purple', opacity: 0.3});

</script>

{#snippet drawEnergyBar(bar:EnergyBar)}
        <Rect x={initialPositions(bar.id).x} 
            y={initialPositions(bar.id).y} 
            width={bar.value*gridLogic.cellSize} 
            height={0.7*gridLogic.cellSize} 
            fill={bar.color}
            stroke='#445544'
            strokeWidth={1}
            opacity={bar.opacity || 0.7}
            />
{/snippet}

<div id='energy' class='flex flex-col bg-gray-100 w-full rounded-xl shadow-lg items-center'
    bind:clientWidth={stageContainerSize.x}
    bind:clientHeight={stageContainerSize.y}>
    <div id='energy-label' class='ml-4 text-lg font-bold'>
        Energy Diagram
    </div>
    <Stage 
        width={width}
        height={height}
        id='energy-stage'
        onmouseleave={() => {onStage = false;}}
        onmouseenter={() => {onStage = true;}}
        onclick={handleGridClick}
        onmousemove={handleGridMouseMove}
        >
        <Layer id='labels'>
            {#each energyBars as bar}
                <Text x={gridLogic.getStageFromPoint({x:0, y:0}).x-50} y={initalStagePositions[bar.id].y} text={bar.symbol} fontSize={0.5*gridLogic.cellSize} fill={bar.color} stroke='black' strokeWidth={0.5}/>
            {/each}
        </Layer>
        <Grid {gridLogic}/>
            <Layer>
                {#each energyBars as bar}
                    {@render drawEnergyBar(bar)}
                {/each}
                <!-- <Circle bind:x={pos.x} bind:y ={pos.y} radius={50} fill='black' draggable ondragmove={(e)=>{
                    pos = {x: e.evt.layerX, y: 200};
                }}/> -->
                <!-- {@render drawEnergyBar(previewTotalEnergy)} -->
                {#if onStage}
                    {@render drawEnergyBar(previewEnergy)}
                {/if}
            </Layer>
    </Stage>
</div>