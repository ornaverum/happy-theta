<script lang='ts'>
    import Grid from "./Grid.svelte";
    import GridLogic from "./GridLogic";
    import type {Point} from "../types";
    import {Stage, Layer, Rect, type KonvaMouseEvent} from "svelte-konva";

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
        console.log('move');
    }

    let onStage:boolean = $state(false);


    interface EnergyBar {
        id: number,
        name: string,
        origin: Point,
        width: number,
        color: string,
    }

    let energyBars: EnergyBar[] = $state([
        {id: 0, name: 'Kinetic Energy', origin: {x:0, y:0}, width: 1, color: 'blue'},
        {id: 1, name: 'Gravitational Potential Energy', origin: {x:0, y:1}, width: 1, color: 'green'},
        {id: 2, name: 'Elastic Potential Energy', origin: {x:0, y:2}, width: 2, color: 'yellow'},
        {id: 3, name: 'Thermal Energy', origin: {x:0, y:3}, width: 3, color: 'red'},
        {id: 4, name: 'Total Energy', origin: {x:0, y:4}, width: 1, color: 'purple'},
    ]);

    let posX:number = $state(0);
</script>

{#snippet drawEnergyBar(bar:EnergyBar)}
        <Rect x={gridLogic.getStageFromPoint({...bar.origin}).x+2} 
            y={gridLogic.getStageFromPoint({...bar.origin}).y + 0.15*gridLogic.cellSize} 
            width={gridLogic.cellSize*bar.width} 
            height={0.7*gridLogic.cellSize} 
            fill={bar.color}
            stroke='#445544'
            strokeWidth={1}
            opacity={0.7}
            />
        <Rect bind:x={posX}
            y={gridLogic.getStageFromPoint({...bar.origin}).y + 0.15*gridLogic.cellSize} 
            width={3} 
            height={0.7*gridLogic.cellSize} 
            fill={bar.color}
            opacity={1}
            stroke='#aaaaaa'
            strokeWidth={1}
            draggable={true}
            ondragmove={(e) => {
                console.log(posX);
                bar.width= (posX);

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
                    onmouseleave={() => {onStage = false; console.log('mouseleave')}}
                    onmouseenter={() => {onStage = true; console.log('mouseenter')}}
                    onclick={handleGridClick}
                    onmousemove={handleGridMouseMove}
				>
                    <Grid {gridLogic}/>
                    <Layer>
                        {#each energyBars as bar}
                            {@render drawEnergyBar(bar)}
                        {/each}
                    </Layer>
				</Stage>
			</div>
		</div>
	</div>
</main>