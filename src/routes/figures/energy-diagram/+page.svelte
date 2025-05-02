<script lang="ts">
	import {getContext, setContext} from 'svelte';
	import {onMount} from 'svelte';
	import type { EnergyBar, DataSets, EngD } from '$lib/types';

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

	import EnergyDiagram from '$lib/Components/EnergyDiagram.svelte';
	// import EnergyDiagramWork from '$lib/Components/EnergyDiagramWork.svelte';
	import ItemContainer from '$lib/Components/ItemContainer.svelte';

	let name: string = 'Energy Diagram';

	let id_ind: number = $state(0);


	let defaultParams = {
		size: {x: 500, y: 200},
		showControlButtons: true,
		margin: {x:5, y:5},
		numCells: {x: 10, y:5},
	}

	const refreshAll = () => {
		engSets.instances = [];
		engSets.instances.push(defaultED);
	}

	let engSets: DataSets = $state({
		title: 'Title',
		type: 'energy-diagram',
		id: 0,
		instances: []}
	);

	let showControlButtons = $state(false);
	
	const saveData = () => {
		console.log('saveData from energy-diagram page');
	}
	const loadData = () => {
		console.log('loadData from energy-diagram page');
	}
	const refreshAllData = () => {
		engSets.instances = [];
		addNewED();
	}

	const defaultED: EngD = {
		id: 0,	
		title: 'Title',
		data: {
			energyBars: [{id: 0, name: 'Kinetic Energy', symbol:'K', value: 1, color: 'blue'},
				{id: 1, name: 'Gravitational Potential Energy', symbol:'Ug', value: 1, color: 'green'},
				{id: 2, name: 'Elastic Potential Energy', symbol:'Uel', value: 0, color: 'yellow'},
				{id: 3, name: 'Thermal Energy', symbol:'Eth', value: 0, color: 'red'},
				{id: 4, name: 'Total Energy', symbol:'E', value: 2, color: 'purple'},],
		}
	};

	const defaultW: EngD = {
		id: id_ind,	
		title: 'Title',
		data: {
			energyBars: [{id: 0, name: 'Work', symbol:'W', value: 1, color: 'orange',},]
		}
	}

	const addNewED = ()=>{
			engSets.instances.push({...defaultED, id:id_ind++});
	}

	const addNewW = () =>{
			engSets.instances.push({...defaultW, id:id_ind++});
	}

	let btnActions = getContext('btnActions');
	onMount( ()=>{
			if (btnActions) {
				btnActions.saveData = saveData;
				btnActions.loadData = loadData;
				btnActions.refreshAllData = refreshAllData;
			}
			addNewED(false);
		}
	);
</script>

<ul class='list-none'>
	{#each engSets.instances as eng}
		<li class='p-4'>
			<EnergyDiagram {...defaultParams} bind:energyBars={eng.data.energyBars} bind:title={eng.title} showControlButtons={true}/>
		</li>
	{/each}
</ul>
{#if true	}
	<div class='flex flex-row p-4 w-1/3 justify-around'>
		<Button color='alternative' on:click={addNewED}><CirclePlusOutline/>Add New Energy State</Button>
		<Button color='alternative' on:click={addNewW}><CirclePlusOutline/>Add New Energy Transfer</Button>
	</div>
{/if}
