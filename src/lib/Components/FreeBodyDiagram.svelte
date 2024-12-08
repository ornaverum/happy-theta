<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import Grid from './Grid.svelte';
	import GridLogic from './GridLogic';
    let name: string = 'Free Body Diagram';
    import type { Point, Vector, Force } from '$lib/types';
    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline, CirclePlusOutline} from 'flowbite-svelte-icons';

    interface Props {
        width?: number;
        height?: number;
        title?: string;
        numCells?: Point;
        showControlButtons?: boolean;
        id?: number;
        margin?: Point;
        forceList?: Force[];
        handleDelete?: (e: MouseEvent)=> void;
    }

    let {
        width = 600,
        height = 600,
        title = $bindable('Title'),
        numCells = {x: 10, y:10},
        showControlButtons = true,
        id = 0,
        margin = {x:5, y:5},
        forceList = $bindable([]),
        handleDelete = (e: MouseEvent) => {},
    }: Props = $props();

    let origin:Point = {x:5, y:5};
    let nextId:number = 0;
    let previewForceVector:Vector = $state({pos0:{x:0, y:0}, pos1:{x:0, y:0}});
    let previewArray: number[] = $state([0, 0, 0, 0]);
    let arrowProps = {strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1}
    // let gridLogic = new GridLogic({x:width, y:height}, {x:5, y:5}, {x:10, }, {origin});
    let gridLogic = new GridLogic({x:width, y:height}, {...margin}, {...numCells}, {...origin});
	let editTitle:boolean = $state(false);

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);

    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		let pt:Point = gridLogic.getSnappedPointFromStage({x:e.evt.layerX, y:e.evt.layerY});
		let newPt: Point = gridLogic.getStageFromPoint(pt);
        let OPos:Point = gridLogic.getStageFromPoint(origin);

		previewForceVector = {pos0:OPos, pos1:newPt};
        previewArray = [OPos.x, OPos.y, newPt.x, newPt.y];
	}

	const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		// addPosition();
        addForce();
	}

    const addForce:Function = () => {
        let newForceVector = {...previewForceVector};
        let newForce = {id: nextId, pos0: {x:0, y:0}, pos1: {x:0, y:0}, force: {x:0, y:0}};
    }

</script>

{#snippet drawForces(xs:Point[])}
	<Layer>
		{#each xs as x}
			<Circle {...positionCircleProps} {...x} id={(nextId++)+''} />
		{/each}
	</Layer>
{/snippet}


<main class="flex flex-col bg-gray-50 justify-center">

	<div id='capture'  class='mx-auto w-max'>

		
		<div class='flex flex-row flex-wrap'>
			<div id='fbd' class='px-4 flex flex-col'>
				<div id='fbd-label' class='ml-4 text-lg font-bold flex flex-row rounded-xl border-1'>
					Free Body Diagram
				</div>
				<Stage 
                    width={width}
                    height={height}
                    id='fbd-stage'
                    onmouseleave={() => {onStage = false; console.log('mouseleave')}}
                    onmouseenter={() => {onStage = true; console.log('mouseenter')}}
                    onclick={handleGridClick}
                    onmousemove={handleGridMouseMove}
				>
                    <Grid {gridLogic}/>

                    <Layer>
                        <Arrow points={[...previewArray]} {...arrowProps} id={(nextId++)+''} opacity={1}/>
                    </Layer>

				</Stage>
			</div>
		</div>
	</div>

	

</main>
