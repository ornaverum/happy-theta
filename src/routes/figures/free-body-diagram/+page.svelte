<script lang="ts">
	import {getContext, setContext} from 'svelte';
	import {onMount} from 'svelte';

	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';
	import ItemContainer from '$lib/Components/ItemContainer.svelte';
	import type { FBD, DataSets, TaoItem } from '$lib/types';


    import { Button, Toggle, Label, Select, Input, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, CirclePlusOutline, FileExportOutline, EditOutline, RefreshOutline} from 'flowbite-svelte-icons';

	import FreeBodyDiagram from '$lib/Components/FreeBodyDiagram.svelte';

	let name: string = 'Free Body Diagram';

	let width = 400;
    let height = 400;

	let id_num: number = 0;

	let fbdSets: DataSets = $state({
		title: 'Title',
		type: 'free-body-diagram',
		id: 0,
		instances: []}
	);
	let id_ind = 0;

	const defaultFBD: FBD = {
		id: id_ind,
		title: 'Title',
		data: {
			forceList: [],
		}
	};

	const addNewFBD = () => {
		let fbd = {...defaultFBD, id: id_ind++};
		fbdSets.instances.push(fbd);
	}

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
		fbdSets.instances = [];
		addNewFBD();
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

	let defaultParams = {
		width: width,
		height: height,
		showControlButtons: true,
		marginY: 5,

	}
</script>

<ul class='list-none'>
	{#each fbdSets.instances as fbd}
		<li class='p-4'>
			<ItemContainer>
				<FreeBodyDiagram {...defaultParams} bind:forceList={fbd.data.forceList} bind:title={fbd.title} {showControlButtons}/>
			</ItemContainer>
		</li>
	{/each}
</ul>
{#if showControlButtons	}
	<div class='flex flex-row p-4 w-1/3 justify-around'>
		<Button color='alternative' on:click={addNewFBD}><CirclePlusOutline/>Add New Diagram</Button>
	</div>
{/if}