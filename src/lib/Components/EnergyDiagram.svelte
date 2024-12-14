<script lang='ts'>
    import Grid from "./Grid.svelte";
    import GridLogic from "./GridLogic";
    import type {Point} from "../types";
    import {Stage, Layer, Rect, Circle, type KonvaMouseEvent} from "svelte-konva";

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

    let numCells: Point = {x: 10, y:5};
    let originPoint:Point = {x:0, y:1};

    let gridLogic = new GridLogic({x:width, y:height}, {...margin}, {...numCells}, {...originPoint});
    const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        console.log(gridLogic);
        console.log('click');
        energyBars.forEach((bar) => {
            console.log(bar, gridLogic.getStageFromPoint({...bar.origin}));
        })
    }

    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        // console.log('move');
    }

    let onStage:boolean = $state(false);


    interface EnergyBar {
        id: number,
        name: string,
        origin: Point,
        width: number,
        color: string,
    }

    const initialPositions:(yPt:number)=>Point = (yPt:number)=>{
        let pt:Point = {x: gridLogic.getStageFromPoint({x:0, y:0}).x-5, 
            y: gridLogic.getStageFromPoint({x:0, y:yPt}).y + 0.15*gridLogic.cellSize};
        return pt;
    }

    let energyBars: EnergyBar[] = $state([
        {id: 0, name: 'Kinetic Energy', origin: {...initialPositions(0)}, width: 1, color: 'blue'},
        {id: 1, name: 'Gravitational Potential Energy', origin: {...initialPositions(1)}, width: 1, color: 'green'},
        {id: 2, name: 'Elastic Potential Energy', origin: {...initialPositions(2)}, width: 2, color: 'yellow'},
        {id: 3, name: 'Thermal Energy', origin: {...initialPositions(3)}, width: 3, color: 'red'},
        {id: 4, name: 'Total Energy', origin: {...initialPositions(4)}, width: 1, color: 'purple'},
    ]);

    let posX:number = $state(0);
    let pos:Point = $state({x:200, y:200});
    $inspect(pos);

    const initalStagePositions:Point[] = [
        {...gridLogic.getStageFromPoint({x:0-0.15, y:0+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:1+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:2+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:3+0.15})},
        {...gridLogic.getStageFromPoint({x:0-0.15, y:4+0.15})},
    ]
    
    let stagePositions:Point[] = $state(initalStagePositions);
    let stageWidths:number[] = $state(Array(5).fill(0.05*gridLogic.cellSize|10));
</script>

{#snippet drawEnergyBar(bar:EnergyBar)}
        <Rect x={bar.origin.x} 
            y={bar.origin.y} 
            width={stageWidths[bar.id]} 
            height={0.7*gridLogic.cellSize} 
            fill={bar.color}
            stroke='#445544'
            strokeWidth={1}
            opacity={0.7}
            />
        <Rect bind:x={stagePositions[bar.id].x}
            bind:y={stagePositions[bar.id].y} 
            width={gridLogic.cellSize/3} 
            height={0.7*gridLogic.cellSize} 
            fill={bar.color}
            opacity={0.5}
            stroke='#aaaaaa'
            strokeWidth={1}
            draggable={true}
            ondragmove={(e) => {
                let snap:Point = {x: e.target.x()-gridLogic.cellSize, y:e.target.y()}//;gridLogic.getStageFromPoint(gridLogic.getSnappedPointFromStage(e.target.x(), e.target.y()));
                stageWidths[bar.id] = snap.x;
                stagePositions[bar.id] = {x:snap.x, y: initalStagePositions[bar.id].y};
            }}
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
                    <Layer>
                        {#each energyBars as bar}
                            {@render drawEnergyBar(bar)}
                        {/each}
                        <!-- <Circle bind:x={pos.x} bind:y ={pos.y} radius={50} fill='black' draggable ondragmove={(e)=>{
                            pos = {x: e.evt.layerX, y: 200};
                        }}/> -->
                    </Layer>
                    <Grid {gridLogic}/>

                    
				</Stage>
			</div>
		</div>
	</div>
</main>