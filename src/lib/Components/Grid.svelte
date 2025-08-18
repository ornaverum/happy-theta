<script lang='ts'>
	import type { SvelteComponent } from 'svelte';
	import {Stage, type KonvaMouseEvent} from 'svelte-konva';
    import type {Point, Vector} from "../types";
    import GridLogic from './GridLogic';
	import GridLines from './GridLines.svelte';

		interface Props {
			children?:any;
			numCells?: Point;
			initCellSize?: number;
			origin?: Point;
			gridLogic?: GridLogic|null;
			onStage?: boolean;
			handleDelete?: (e: KonvaMouseEvent)=> void;
			handleGridClick?: (e: KonvaMouseEvent)=> void;
			handleGridMouseMove?: (e: KonvaMouseEvent)=> void;
		}

		let {
			children,
			numCells = {x: 20, y:0},
			initCellSize = 20,
			origin = {x:10, y:0},
			gridLogic = $bindable(null),
			onStage = $bindable(false),
			handleDelete = (e: KonvaMouseEvent) => {},
			handleGridClick = (e: KonvaMouseEvent) => {},
			handleGridMouseMove = (e: KonvaMouseEvent) => {},
		}: Props = $props();


		let windowSize:Point = $state({x:0, y:0});
		let stageContainerSize: Point = $state({x:0, y:0});

		let maxStageSize: Point = $derived.by(() => {
			let gridAspectRatio:number = (numCells.x + 2)/(numCells.y + 2);
			let containerAspectRatio:number = windowSize.x / windowSize.y;
			let szX:number = 200;
			let szY:number = 200;

			if (gridAspectRatio > 1){  // Landscape
				szX = 0.5*Math.max(windowSize.x, 200);
				szY = szX/gridAspectRatio;
			}

			if (gridAspectRatio <= 1){ //|| szY > stageContainerSize.y){ // portrait, or width is too much for screen height
				szY = 0.5*Math.max(windowSize.y, 200);
				szX = szY*gridAspectRatio;
			}

			return {x: szX, y: szY};
		});

		let cellSize:number = $derived.by(() => {
			let szX = maxStageSize.x / (numCells.x + 2);
			let szY = maxStageSize.y / (numCells.y + 2);
			return Math.min(szX, szY) || initCellSize;
		});

		$effect(() => {
			gridLogic = new GridLogic( {
				numCells: {...numCells},
				origin: {...origin},
				cellSize: cellSize
			});
		});

</script>

<svelte:window bind:innerWidth={windowSize.x} bind:innerHeight={windowSize.y}/>

<div id='stageContainer' class='min-w-11/12 mx-auto'>
	<Stage width={maxStageSize.x} height={maxStageSize.y} id='main_stage'
			onmouseleave={() => {onStage = false;}}
			onmouseenter={() => {onStage = true;}}
			onclick={handleGridClick}
			onmousemove={handleGridMouseMove}
		>
		<GridLines {gridLogic}/>

		{@render children?.()}

	</Stage>
</div>

