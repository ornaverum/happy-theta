<script lang='ts'>
    import GridLines from "./GridLines.svelte";
    import GridLogic from "./GridLogic";
    import Grid from "./Grid.svelte";
    import type {Point, EnergyBar} from "../types";
    import {Stage, Layer, Rect, Circle, Text, type KonvaMouseEvent} from "svelte-konva";
    import {setContext, getContext, tick} from "svelte";
	import { BarsFromLeftOutline } from "flowbite-svelte-icons";
    import {onMount} from 'svelte';

    interface Props {
        title?: string;
        id?: number;
        numCells?: Point;
        initCellSize?: number;
        handleDelete?: (e: MouseEvent)=> void;
        workFlag?: boolean;
        energyBars: EnergyBar[];
    }

    let {
        title = $bindable('Title'),
        id = 0,
        numCells = {x: 10, y:5},
        initCellSize = 20,
        handleDelete = (e: MouseEvent) => {},
        workFlag = false,
        energyBars = $bindable([])
    }: Props = $props();

    let onStage:boolean = $state(false);
	let origin = {x:5, y:1};

    numCells.y = energyBars.length;
    let cellSize = $state(initCellSize);

    let showControlButtons = getContext('ctrl');


    // let gridLogic:GridLogic|null = $state(new GridLogic({cellSize: cellSize, numCells: numCells}));
    let gridLogic:GridLogic|null = $state(null);

    let initialStagePositions:Point[] = $state([]);

    onMount(async () => {
        await tick();
        if (gridLogic && energyBars.length > 0) {
            initialStagePositions = energyBars.map( (bar, i) => 
                gridLogic.getStageFromPoint({x:0, y: bar.id })
            );
            console.log(initialStagePositions);
        }
    });

    $inspect(energyBars);
    $inspect(initialStagePositions);

    // Add a computed property to check if positions are ready
    let positionsReady = $derived(initialStagePositions.length > 0);




    const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        if (!gridLogic || !positionsReady) return;
        
        let pt:Point = {x:e.evt.layerX, y:e.evt.layerY};
        console.log('stage point', pt);
        let snap:Point = gridLogic.getSnappedPointFromStage(pt);
        console.log('snapped point', snap);
        let bar:number = snap.y;
        console.log('bar id', bar);
        // snap = {x: Math.max(Math.round(snap.x),0.2)-5, y: bar};
        // pt = gridLogic.getStageFromPoint(snap); 
        // stagePositions[bar] = {x:pt.x-gridLogic.cellSize/3/2, y: initialStagePositions[bar].y};
        energyBars[bar].value = snap.x; //- gridLogic.getStageFromPoint(originPoint).x;
    }


    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        if (!gridLogic || !positionsReady) return;
        
        let pt:Point = {x:e.evt.layerX, y:e.evt.layerY};
        let snap:Point = gridLogic.getPointFromStage(pt);
        snap.y = Math.ceil(snap.y);
        snap.x = Math.round(snap.x);

        console.log('event X, Y', e.evt.layerX, e.evt.layerY);
        console.log('snapped', snap);
        // if (snap.x >= 0 && snap.x <= numCells.x && snap.y >= 0 && snap.y <= numCells.y) {
        // console.log('snap', snap);
            let bar:number = (energyBars.length - snap.y);
            snap = {x: Math.max(Math.round(snap.x),0.2), y: bar};
            pt = gridLogic.getStageFromPoint(snap);
            previewEnergy.id = bar;
            // previewEnergy.origin = {x:pt.x-gridLogic.cellSize/3/2, y: initialStagePositions[bar].y};
            previewEnergy.value = snap.x; //- gridLogic.getStageFromPoint(originPoint).x;
            previewEnergy.color = energyBars[bar].color;
        // }
    }


    let previewTotalEnergy: EnergyBar = $derived.by(() => {
        if (!positionsReady || initialStagePositions.length <= 4) {
            return {id: 4, name: 'Total Energy Preview', symbol: 'E', origin: {x: 0, y: 0}, value: 0, color: 'purple', opacity: 0.3};
        }
        
        let w = 0;
        energyBars.forEach((bar:EnergyBar)=>{
            if(bar.id !== 4)
                w+=Math.floor(bar.value);
        });
        return {id: 4, name: 'Total Energy Preview', symbol:'E', origin: {...initialStagePositions[4]}, value: w, color: 'purple', opacity: 0.3};
        // return {id: -1, name: 'Total Energy Preview', symbol:'E', origin: {...initialPositions(4)}, width:3, color: 'purple'};
    });


    let previewEnergy: EnergyBar = $state({id: 5, name: 'Preview', symbol: 'E', value: 0, color: 'purple', opacity: 0.3});




</script>

{#snippet drawEnergyBar(bar:EnergyBar)}
    {#if positionsReady && initialStagePositions[bar.id]}
        <Rect x={initialStagePositions[bar.id].x}
            y={initialStagePositions[bar.id].y} 
            width={bar.value*gridLogic?.cellSize | 0}
            height={0.7*gridLogic?.cellSize | 0}
            fill={bar.color}
            stroke='#445544'
            strokeWidth={1}
            opacity={bar.opacity || 0.7}
            />
    {/if}
{/snippet}

{#snippet writeEnergyLabels(bar:EnergyBar)}
    {#if positionsReady && initialStagePositions[bar.id]}
        <Text x={initialStagePositions[bar.id].x} y={initialStagePositions[bar.id].y} text={bar.symbol} 
                fontSize={0.5*cellSize} fill={bar.color} stroke='black' strokeWidth={0.5}/>
    {/if}
{/snippet}

<div id='energy' class='flex flex-col bg-gray-100 w-full rounded-xl shadow-lg items-center'>
    <div id='energy-label' class='ml-4 text-lg font-bold'>
        Energy Diagram
    </div>
        <Grid {numCells} {initCellSize} {origin} bind:gridLogic bind:onStage
				{handleGridMouseMove} {handleGridClick}
			>
        {#if positionsReady}
            <Layer id='labels'>
                {#each energyBars as bar}
                    {@render writeEnergyLabels(bar)}
                {/each}
            </Layer>
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
        {/if}
    </Grid>
</div>