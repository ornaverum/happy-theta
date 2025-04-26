<script lang="ts">
	import {getContext, setContext} from 'svelte';
	import {onMount} from 'svelte';

	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';
	import ItemContainer from '$lib/Components/ItemContainer.svelte';
	import type { FBD } from '$lib/types';


    import { Button, Toggle, Label, Select, Input, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, CirclePlusOutline, FileExportOutline, EditOutline, RefreshOutline} from 'flowbite-svelte-icons';

	import FreeBodyDiagram from '$lib/Components/FreeBodyDiagram.svelte';

	let name: string = 'Free Body Diagram';

	let width = 400;
    let height = 400;

	let id_num: number = 0;

	let dataSets: FBD[] = $state([]);
	let id_ind = 0;

	const defaultFBD: FBD = {
		id: id_ind,
		title: 'Title',
		width: width,
		height: height,
		marginY: 5,
		forceList: [],
	}

	const addNewFBD = () => {
		let fbd = {...defaultFBD, id: id_ind++};
		dataSets = [...dataSets, fbd];
	}

	let forceList = $state([]);

	addNewFBD();

	let showControlButtons = $state(true);
	
	const saveData = () => {
		console.log('saveData from free-body-diagram page');
	}
	const loadData = () => {
		console.log('loadData from free-body-diagram page');
	}
	const refreshAllData = () => {
		console.log('refreshAllData from free-body-diagram page');
		dataSets = [];
		addNewFBD();
	}
	
	let btnActions = getContext('btnActions');
	onMount( ()=>{
		btnActions.saveData = saveData;
		btnActions.loadData = loadData;
		btnActions.refreshAllData = refreshAllData;
	}
	);
</script>

<ul class='list-none'>
	{#each dataSets as fbd}
		<li class='p-4'>
			<ItemContainer>
				<FreeBodyDiagram {...fbd} bind:forceList={fbd.forceList} bind:title={fbd.title} {showControlButtons}/>
			</ItemContainer>
		</li>
	{/each}
</ul>
{#if showControlButtons	}
	<div class='flex flex-row p-4 w-1/3 justify-around'>
		<Button color='alternative' on:click={addNewFBD}><CirclePlusOutline/>Add New Diagram</Button>
	</div>
{/if}