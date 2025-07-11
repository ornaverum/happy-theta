<script lang="ts">
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect, type KonvaMouseEvent} from 'svelte-konva';
	import Grid from './Grid.svelte';
	import GridLogic from './GridLogic';

    import EditLabel from './EditLabel.svelte';

    let name: string = 'Free Body Diagram';


    import type { Point, Vector, Force } from '$lib/types';
    import { Label, Select, Input, Button, Toggle, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, EditOutline, ArrowRightOutline, RefreshOutline, CirclePlusOutline, TagOutline} from 'flowbite-svelte-icons';


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
        width = 400,
        height = 400,
        title = $bindable('Title'),
        numCells = {x: 10, y:10},
        showControlButtons,
        id = 0,
        margin = {x:5, y:5},
        forceList = $bindable([]),
        handleDelete = (e: MouseEvent) => {},
    }: Props = $props();

    let originPoint:Point = {x:5, y:5};
    let gridLogic = new GridLogic({size:{x:width, y:height}, margin:{...margin}, numCells:{...numCells}, origin:{...originPoint}});

    let originStage: Point = gridLogic.getStageFromPoint(originPoint);
    let nextId:number = $state(0);
    let previewForcePoint:Point = $state({x:0, y:0});
    let arrowProps = {strokeWidth: 3, stroke: 'green', fill: 'green', opacity: 1}
	let editTitle:boolean = $state(false);

	let toggleChecked:boolean = $state(false);
	let onStage:boolean = $state(false);
    let showNetForce:boolean = $state(true);


    let netForceVector:Point = $state({...originStage});
    const handleGridMouseMove:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
		let pt:Point = gridLogic.getSnappedPointFromStage({x:e.evt.layerX, y:e.evt.layerY});
		previewForcePoint = {...pt};
	}

	const handleGridClick:(e: KonvaMouseEvent)=>void = (e: KonvaMouseEvent) => {
        addForce();
	}

    const defaultForce: Force = {
        id: 0,
        components: {x:0, y: 1},
        tao: {
            symbol: "F",
            type: "force",
            agent: "agent",
            object: "object",
            color: "green",
            editText: false,
        }
    }

    const addForce:Function = () => {
        let newForce:Force = defaultForce;
        newForce.id = nextId++;
        newForce.components = {...previewForcePoint};
        forceList = [...forceList, newForce];

        updateNetForce();
    }

    const deleteForce:Function = (id:number) => {
        forceList = forceList.filter((force:Force) => force.id !== id);
        updateNetForce();

    };

    const updateNetForce:Function = () => {
        netForceVector = {...originPoint};
        forceList.forEach((force:Force) => {
            netForceVector.x += (force.components.x -originPoint.x);
            netForceVector.y += force.components.y -originPoint.y;
        });
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

<main class="flex flex-col bg-gray-100 w-full rounded-xl shadow-lg p-4">
    <!-- <EditLabel bind:title/> -->
    <EditLabel bind:text={title} {showControlButtons} size={'xl2'} />
    <div class='flex flex-row flex-wrap justify-around'>
        <div id='fbd' class='px-4 flex flex-col flex-wrap'>
            <div id='fbd-label' class='ml-4 text-md font-bold select-none'>
                Free Body Diagram
            </div>
            <Stage 
                width={width}
                height={height}
                id='fbd-stage'
                onclick={handleGridClick}
                onmousemove={handleGridMouseMove}
                onmouseleave={() => {onStage = false;}}
				onmouseenter={() => {onStage = true;}}
            >
                <Grid {gridLogic}/>
                {#if onStage}
                    <Layer>
                        {@render drawForce(previewForcePoint, 
                            {id: 'preview', opacity: 0.5, color: colorList[nextId%12].cc, strokeWidth: 3})}
                    </Layer>
                {/if}
                
                <Layer>
                    {#each forceList as force, i}
                        {@render drawForce(force.components, {id: force.id+'', opacity: 1, color: colorList[force.id%12].cc, strokeWidth: 3})}
                    {/each}
                </Layer>
                {#if showNetForce}
                    <Layer>
                        {#if forceList.length == 0 || (netForceVector.x == originPoint.x && netForceVector.y == originPoint.y)}
                            <Circle opacity={0.6} fill='black' {...originStage} radius = {8} id={'net'} />
                        {:else}
                            {@render drawForce(netForceVector, {id: 'net', opacity: 0.5, color: 'black', strokeWidth: 6})}
                        {/if}
                    </Layer>
                {/if}
            </Stage>
        </div>
        <div id="tao-chart" class='max-w-lg px-4 top-0 flex-auto'>
            <div id='fbd-label' class='mx-auto text-md font-bold flex flex-row rounded-xl border-1'>
                <p>Type/Agent/Object Chart</p>
            </div>
            {#if forceList.length == 0}
                <div class='mx-auto my-4 p-2 text-xl font-bold rounded-xl border-1'>
                    <p>No Forces Yet</p>
                    <p class='text-sm'>Add a force by clicking on the FBD</p>
                </div>
            {:else}
            <div id='tao-title' class= " p-2.5 m-1 gap-2 font-bold rounded-xl my-auto grid grid-cols-[0.25fr_1fr_2fr_2fr_2fr_0.25fr]">
                <p></p>
                <p class='justify-center mx-auto'>Symbol</p>
                <p class='justify-center mx-auto'>Type</p>
                <p class='justify-center mx-auto'>Agent</p>
                <p class='justify-center mx-auto'>Object</p>
                <p></p>
            </div>
            {/if}
            <div id='tao-items' class=''>
                {#each forceList as force (force.id)}
                <div id='tao-item' onblur={(e)=>{force.tao.editText = false;}} class= {`${colorList[force.id].tw} p-2.5 m-1 gap-2 font-bold rounded-xl grid grid-cols-[0.25fr_1fr_2fr_2fr_2fr_0.25fr] w-full`} >
                    <Button color="red" class="ml-2 mb-0 p-0 w-0"
                            on:click={() => {
                                force.tao.editText = !force.tao.editText;
                            }}
                            size="xs"
                        >
                            <EditOutline/>
                        </Button>
                        {#if force.tao.editText}
                            <Input id='tao-symbol' bind:value={force.tao.symbol} placeholder="Symbol" class='my-auto'
                                onkeydown={(evt) => { if (evt.key == 'Enter') { force.tao.editText = false;}}}
                            />
                            <Input id='tao-type' bind:value={force.tao.type} class='my-auto'
                                onkeydown={(evt) => { if (evt.key == 'Enter') { force.tao.editText = false;}}}
                            />
    
                            <Input id='tao-agent' bind:value={force.tao.agent} class='my-auto'
                                onkeydown={(evt) => { if (evt.key == 'Enter') { force.tao.editText = false;}}}
    
                            />
                            <Input id='tao-object' bind:value={force.tao.object} class='my-auto'
                                onkeydown={(evt) => { if (evt.key == 'Enter') { force.tao.editText = false;}}}
                            />
                        {:else}
                            <div class='mx-auto' ondblclick={()=>{force.tao.editText = true}}>{force.tao.symbol}</div>
                            <div class='mx-auto' ondblclick={()=>{force.tao.editText = true}}>{force.tao.type}</div>
                            <div class='mx-auto' ondblclick={()=>{force.tao.editText = true}}>{force.tao.agent}</div>
                            <div class='mx-auto' ondblclick={()=>{force.tao.editText = true}}>{force.tao.object}</div>
                            
                        {/if}
                        <Button color="red" class="mb-0 p-0 w-0"
                            on:click={() => deleteForce(force.id)}
                        >
                            <TrashBinOutline/>
                        </Button>
                    </div>
                {/each}
                <!-- <Button outline class='w-full'
                    on:click={() => {
                        addForce({x:1, y:1});
                    }}>
                    <CirclePlusOutline/> Add New Force
                </Button> -->
                {#if showNetForce}
                <Hr classHr="w-48 h-1 mx-auto my-7 rounded md:my-10"> = </Hr>
                <div id='netForce-item' class='mt-4 p-4 w-full inline-flex flex-row justify-center font-bold text-xl mx-auto bg-gray-500 text-white rounded-xl'>
                        <div>Net Force
                            {#if forceList.length == 0 || (netForceVector.x == originPoint.x && netForceVector.y == originPoint.y)}
                                = 0
                            {/if}
                        </div>
                    </div>
                {/if}

            </div>
        </div>
    </div>
</main>
