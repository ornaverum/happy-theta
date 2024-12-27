<script lang='ts'>
    import Grid from "./Grid.svelte";
    import GridLogic from "./GridLogic";
    import type {Point} from "../types";
    import {Stage, Layer, Rect, Circle, Text, type KonvaMouseEvent} from "svelte-konva";
    import {setContext} from "svelte";
	import { BarsFromLeftOutline } from "flowbite-svelte-icons";

    interface Props {
        title?: string;
        id?: number;
        handleDelete?: (e: MouseEvent)=> void;
        gridLogic?: GridLogic;
    }

    let {
        title = $bindable('Title'),
        id = 0,
        handleDelete = (e: MouseEvent) => {},
        gridLogic = new GridLogic({})
    }: Props = $props();

    let numCells: Point = gridLogic.numCells;
    let width: number = gridLogic.size.x;
    let height: number = gridLogic.size.y;

    let onStage:boolean = $state(false);


    interface EnergyBar {
        id: number,
        name: string,
        origin: Point,
        width: number,
        color: string,
        opacity?: number,
    }

    const initialPositions:(yPt:number)=>Point = (yPt:number)=>{
        let pt:Point = {x: gridLogic.getStageFromPoint({x:5, y:0}).x, 
            y: gridLogic.getStageFromPoint({x:0, y:yPt+0.15}).y };
        return pt;
    }

    let energyBars: EnergyBar[] = $state([
        {id: 0, name: 'Kinetic Energy', symbol:'K', origin: {...initialPositions(0)}, width: 1, color: 'blue'},
        {id: 1, name: 'Gravitational Potential Energy', symbol:'Ug', origin: {...initialPositions(1)}, width: 1, color: 'green'},
        {id: 2, name: 'Elastic Potential Energy', symbol:'Uel', origin: {...initialPositions(2)}, width: 0, color: 'yellow'},
        {id: 3, name: 'Thermal Energy', symbol:'Eth', origin: {...initialPositions(3)}, width: 0, color: 'red'},
        {id: 4, name: 'Total Energy', symbol:'E', origin: {...initialPositions(4)}, width: 2, color: 'purple'},
    ]);


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
        energyBars[bar].width = snap.x; //- gridLogic.getStageFromPoint(originPoint).x;
    }


    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        let pt:Point = {x:e.evt.layerX, y:e.evt.layerY};
        let snap:Point = gridLogic.getPointFromStage(pt);
        if (snap.x >= 0 && snap.x <= numCells.x && snap.y >= 0 && snap.y <= numCells.y) {
            let bar:number = Math.floor(snap.y);
            snap = {x: Math.max(Math.round(snap.x),0.2)-5, y: bar};
            pt = gridLogic.getStageFromPoint(snap);
            previewEnergy.origin.y = initalStagePositions[bar].y;
            // previewEnergy.origin = {x:pt.x-gridLogic.cellSize/3/2, y: initalStagePositions[bar].y};
            previewEnergy.width = snap.x; //- gridLogic.getStageFromPoint(originPoint).x;
            previewEnergy.color = energyBars[bar].color;
        }
    }


    let previewTotalEnergy: EnergyBar = $derived.by(() => {
        let w = 0;
        energyBars.forEach((bar:EnergyBar)=>{
            if(bar.id !== 4)
                w+=Math.floor(bar.width);
        });
        return {id: -1, name: 'Total Energy Preview', symbol:'E', origin: {...initialPositions(4)}, width: w, color: 'purple', opacity: 0.3};
        // return {id: -1, name: 'Total Energy Preview', symbol:'E', origin: {...initialPositions(4)}, width:3, color: 'purple'};
    });


    let previewEnergy: EnergyBar = $state({id: -1, name: 'Preview', origin: {...initialPositions(0)}, width: 0, color: 'purple', opacity: 0.3});

</script>

{#snippet drawEnergyBar(bar:EnergyBar)}
        <Rect x={bar.origin.x} 
            y={bar.origin.y} 
            width={bar.width*gridLogic.cellSize} 
            height={0.7*gridLogic.cellSize} 
            fill={bar.color}
            stroke='#445544'
            strokeWidth={1}
            opacity={bar.opacity || 0.7}
            />
{/snippet}

<main class="flex flex-col bg-gray-50 justify-center">

	<div id='capture'  class='mx-auto w-max'>

		
		<div class='flex flex-row flex-wrap'>
			<div id='fbd' class='px-4 flex flex-col'>
				<div id='fbd-label' class='ml-4 text-lg font-bold flex flex-row rounded-xl border-1'>
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
                        <Text x={gridLogic.getStageFromPoint({x:0, y:0}).x-50} y={bar.origin.y} text={bar.symbol} fontSize={0.5*gridLogic.cellSize} fill={bar.color} stroke='black' strokeWidth={0.5}/>
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
                        {@render drawEnergyBar(previewTotalEnergy)}
                        {@render drawEnergyBar(previewEnergy)}
                    </Layer>
				</Stage>
			</div>
		</div>
	</div>
</main>