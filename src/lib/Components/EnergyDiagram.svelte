<script lang='ts'>
    import Grid from "./Grid.svelte";
    import GridLogic from "./GridLogic";
    import type {Point} from "../types";
    import {Stage, type KonvaMouseEvent} from "svelte-konva";

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
        console.log('click');
    }

    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        console.log('move');
    }

    let onStage:boolean = $state(false);

    interface EnergyBar {
        id: number,
        origin: Point,
        width: number,
        color: string,
        handle:
    }
</script>

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
                    
				</Stage>
			</div>
		</div>
	</div>
</main>