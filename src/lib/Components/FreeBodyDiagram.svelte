<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import Grid from './Grid.svelte';
	import GridLogic from './GridLogic';
    let name: string = 'Free Body Diagram';
    import type { Point, Vector, Force } from '$lib/types';
    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline, CirclePlusOutline, TagOutline} from 'flowbite-svelte-icons';
    import { Table, TableBody, TableBodyCell, TableBodyRow, TableHead, TableHeadCell, Checkbox, TableSearch } from 'flowbite-svelte';


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

    let originPoint:Point = {x:5, y:5};
    let gridLogic = new GridLogic({size:{x:width, y:height}, margin:{...margin}, numCells:{...numCells}, origin:{...originPoint}});

    let originStage: Point = gridLogic.getStageFromPoint(originPoint);
    let nextId:number = 0;
    let previewForcePoint:Point = $state({x:0, y:0});
    let arrowProps = {strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1}
	let editTitle:boolean = $state(false);

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);
    let showNetForce:boolean = $state(false);


    let netForceVector:Point = $state({...originStage});
    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		let pt:Point = gridLogic.getSnappedPointFromStage({x:e.evt.layerX, y:e.evt.layerY});
		previewForcePoint = {...pt};
	}

	const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        addForce();
	}

    const addForce:Function = () => {
        let newForce:Force = {id: nextId++, 
            symbol: 'F',
            agent: 'A',
            object: 'O',
            type: 'force',
            components: {...previewForcePoint},
            color: 'green',
            draggable: true,
            editText: false,
        }
        forceList = [...forceList, newForce];

        netForceVector = {...originPoint};
        forceList.forEach((force:Force) => {
            netForceVector.x += (force.components.x -originPoint.x);
            netForceVector.y += force.components.y -originPoint.y;
        });
        console.log(netForceVector, originPoint)
    }


    const colorList = [
        {tw: 'bg-amber-400', cc: '#fb923c'},
        {tw: 'bg-blue-700', cc: '#1d4ed8'},
        {tw: 'bg-red-600', cc: '#dc2626'},
        {tw: 'bg-green-900', cc: '#14532d'},
        {tw: 'bg-purple-800', cc: '#6d28d9'},
        {tw: 'bg-orange-800', cc: '#9a3412'},
        {tw: 'bg-emerald-600', cc: '#059669'},
        {tw: 'bg-cyan-300', cc: '#6ee7b7'},
        {tw: 'bg-rose-600', cc: '#ec4899'},
        {tw: 'bg-violet-600', cc: '#7c3aed'},
        {tw: 'bg-lime-400', cc: '#a3e635'},
        {tw: 'bg-fuchsia-600', cc: '#d946ef'},
    ];

</script>


{#snippet drawForce(forceComp:Point, params:{
    id:string,
    opacity:number,
    color:string,
    strokeWidth:number,
    })}
    <Arrow points={[originStage.x, originStage.y, 
        gridLogic.getStageFromPoint(forceComp).x, 
        gridLogic.getStageFromPoint(forceComp).y]} 
        {...arrowProps} opacity = {params.opacity} fill={params.color} stroke={params.color} 
        strokeWidth={params.strokeWidth} id={params.id} />    
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
                    {#if onStage}
                        <Layer>
                            {@render drawForce(previewForcePoint, 
                                {id: 'preview', opacity: 0.5, color: 'black', strokeWidth: 3})}
                        </Layer>
                    {/if}
                    
                    <Layer>
                        {#each forceList as force, i}
                            {@render drawForce(force.components, {id: force.id+'', opacity: 1, color: colorList[force.id%12].cc, strokeWidth: 3})}
                        {/each}
                    </Layer>
                    {#if showNetForce}
                        <Layer>
                            {#if netForceVector.x == originPoint.x && netForceVector.y == originPoint.y}
                                <Circle opacity={0.6} fill='black' {...originStage} radius = {8} id={'net'} />
                            {:else}
                                {@render drawForce(netForceVector, {id: 'net', opacity: 0.5, color: 'black', strokeWidth: 6})}
                            {/if}
                        </Layer>
                    {/if}
				</Stage>
			</div>
            <div id= 'tao w-1/2'>
                <div id='fbd-label' class='mx-auto text-lg font-bold flex flex-row rounded-xl border-1'>
					<p>TAO Chart</p>
				</div>
                <div class='mx-auto w-full my-4 p-2 text-xl font-bold rounded-xl border-1'>
                    
                    {#if forceList.length == 0}
                        <div class=''>
                            <p>No Forces Yet</p>
                            <p class='text-sm'>Add a force by double clicking on the FBD or clicking the button below</p>
                        </div>
                    {:else}

                        <Table class=''>
                            <TableHead class='p-2.5 m-1 text-sm'>
                            <TableHeadCell>Symbol</TableHeadCell>
                            <TableHeadCell>Type</TableHeadCell>
                            <TableHeadCell>Agent</TableHeadCell>
                            <TableHeadCell>Object</TableHeadCell>
                            </TableHead>
                            <TableBody tableBodyClass="divide-y text-xs m-0 p-0">
                                {#each forceList as force (force.id)}
                                    <TableBodyRow class={`${colorList[force.id%12].tw} rounded-lg `}>
                                        <TableBodyCell class='text-black font-bold text-lg' contenteditable="true">{force.symbol}</TableBodyCell>
                                        <TableBodyCell class='text-black font-bold text-lg' contenteditable="true">{force.type}</TableBodyCell>
                                        <TableBodyCell class='text-black font-bold text-lg' contenteditable="true">{force.agent}</TableBodyCell>
                                        <TableBodyCell class='text-black font-bold text-lg ' contenteditable="true">{force.object}</TableBodyCell>
                                    </TableBodyRow>
                                {/each}
                            </TableBody>
                        </Table>
                        {#if showNetForce}
                            <div class="text-xl">Hide Net Force</div>
                        {:else}
                            <div class="text-xl">Show Net Force</div>
                        {/if}
                        <Toggle bind:checked={showNetForce} />
                    {/if}
                   
				</div>
            </div>
		</div>
	</div>
</main>
