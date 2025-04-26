<script lang="ts">
	import {getContext, setContext} from 'svelte';
	import {onMount} from 'svelte';

	interface Props {
        test?: string;
    }

    let {
        test = 'test from page'
    }: Props = $props();

	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';

    import { Button, Toggle, Label, Select, Input, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, CirclePlusOutline, FileExportOutline, EditOutline, RefreshOutline} from 'flowbite-svelte-icons';
	import EditLabel from '$lib/Components/EditLabel.svelte';

	import Grid from '$lib/Components/Grid.svelte';
	import GridLogic from '$lib/Components/GridLogic';
	import EnergyDiagram from '$lib/Components/EnergyDiagram.svelte';
	// import EnergyDiagramWork from '$lib/Components/EnergyDiagramWork.svelte';
	import ItemContainer from '$lib/Components/ItemContainer.svelte';

	let name: string = 'Free Body Diagram';

	let width = 500;
    let height = 200;

	let margin = {x:5, y:5};
	let numCells = {x: 10, y:5};
	let originPoint = {x:5, y:1};

	let gridLogic = new GridLogic({size:{x:width, y:height}, margin:{...margin}, numCells:{...numCells}, origin:{...originPoint}});
	let gridLogicW = new GridLogic({size:{x:width, y:100}, margin:{...margin}, numCells:{x:10,y:1}, origin:{...originPoint},
		cellSize:gridLogic.cellSize});

	const refreshAll = () => {
		gridLogic = new GridLogic({size:{x:width, y:height}, margin:{...margin}, numCells:{...numCells}, origin:{...originPoint}});
		gridLogicW = new GridLogic({size:{x:width, y:100}, margin:{...margin}, numCells:{x:10,y:1}, origin:{...originPoint},
			cellSize:gridLogic.cellSize});
	}

	let showControlButtons = $state(false);
	
	const saveData = () => {
		console.log('saveData from energy-diagram page');
	}
	const loadData = () => {
		console.log('loadData from energy-diagram page');
	}
	const refreshAllData = () => {
		console.log('refreshAllData from energy-diagram page');	
	}


	let btnActions = getContext('btnActions');
	onMount( ()=>{
			if (btnActions) {
				btnActions.saveData = saveData;
				btnActions.loadData = loadData;
				btnActions.refreshAllData = refreshAllData;
			}
		}
	);
</script>

<ul class='list-none'>
	{#each engSets.instances as fbd}
		<li class='p-4'>
			<ItemContainer>
				<EnergyDiagram {...defaultParams} bind:forceList={fbd.data.forceList} bind:title={fbd.title} {showControlButtons}/>
			</ItemContainer>
		</li>
	{/each}
</ul>
{#if showControlButtons	}
	<div class='flex flex-row p-4 w-1/3 justify-around'>
		<Button color='alternative' on:click={addNewFBD}><CirclePlusOutline/>Add New Diagram</Button>
	</div>
{/if}

	<EnergyDiagram {gridLogic}/>
	<!-- <div class="p-0 my-0 w-max justify-center align-center mx-auto font-bold text-4xl">+</div> -->
	<EnergyDiagram gridLogic={gridLogicW} workFlag={true}/>
	<!-- <div class="p-0 my-0 w-max justify-center align-center mx-auto font-bold text-4xl">=</div> -->
	<EnergyDiagram {gridLogic}/>
