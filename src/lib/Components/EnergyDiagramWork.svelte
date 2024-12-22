<script lang='ts'>
    import Grid from "./Grid.svelte";
    import GridLogic from "./GridLogic";
    import type {Point} from "../types";
    import {Stage, Layer, Rect, Circle, Text, type KonvaMouseEvent} from "svelte-konva";
	import { BarsFromLeftOutline } from "flowbite-svelte-icons";

    interface Props {
        width?: number;
        height?: number;
        title?: string;
        id?: number;
        margin?: Point;
        handleDelete?: (e: MouseEvent)=> void;
    }

    let {
        width = 600,
        height = 300,
        title = $bindable('Title'),
        id = 0,
        margin = {x:5, y:5},
        handleDelete = (e: MouseEvent) => {},
    }: Props = $props();

    let numCells: Point = {x: 10, y:1};
    let originPoint:Point = {x:5, y:1};

    let gridLogic = new GridLogic({x:width, y:height}, {...margin}, {...numCells}, {...originPoint});
    
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
        {id: 0, name: 'Work', symbol:'W', origin: {...initialPositions(0)}, width: 1, color: 'orange'},
    ]);


    const initalStagePositions:Point[] = [
        {...gridLogic.getStageFromPoint({x:0-0.15, y:0+0.15})},
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
                        {@render drawEnergyBar(previewEnergy)}
                    </Layer>
				</Stage>
			</div>
		</div>
	</div>
</main>