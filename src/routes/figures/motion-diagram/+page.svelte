<script lang="ts">
	import MotionDiagram from '$lib/Components/MotionDiagram.svelte';
	import type { MD, DataSets } from '$lib/types';
	import type { KonvaMouseEvent } from 'svelte-konva';
	import {setContext, getContext} from 'svelte';
	import EditLabel from '$lib/Components/EditLabel.svelte';

	import {onMount} from 'svelte';

    import { Label, Select, Input, Button, Toggle} from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, CirclePlusOutline} from 'flowbite-svelte-icons';

	interface Props {
		name?: string;
		showControlButtons?: boolean;
		saveData?: () => void;
		loadData?: () => void;
		refreshAllData?: () => void;
	}

	let { name = 'Motion Diagram' }: Props = $props();
	let showControlButtons: boolean;

	let width = 800;
    let height = 100;

	let mdSets: DataSets = $state({
		title: 'Title',
		type: 'motion-diagram',
		id: 0,
		instances: []}
	);

	let id_ind = $state(0);

	const defaultMD: MD = {
		id: 0,
		title: 'Title',
		data: {
			posList: [],
			accList: [],
		},
	};

	const addNewMD = () => {
		let md = {...defaultMD, id: id_ind++};
		mdSets.instances = [...mdSets.instances, md];
	}

	const handleDelete = (e: KonvaMouseEvent) => {
		// const target = e.target;
		// const id = target.attrs()['data-id'];
		// if (id) {
		// 	console.log('handleDelete from page ', id);
		// 	mdArray = mdArray.filter(md => md.id !== Number(id));
		// }
	}

	const labelTitle = ()=>{
		mdSets.instances.forEach((md,i) => {
			md.title = String.fromCharCode(65 + i);;
		});
		// mdSets.instances = [...mdArray];
	}

	const saveData = () => {
		console.log('saveData from motion-diagram page');
	}
	const loadData = () => {
		console.log('loadData from motion-diagram page');
	}

	const refreshAllData = () => {
		mdSets.instances = [];
		addNewMD();
	}
	
	let btnActions = getContext('btnActions');
	onMount( ()=>{
		if (btnActions) {
			btnActions.saveData = saveData;
			btnActions.loadData = loadData;
			btnActions.refreshAllData = refreshAllData;
			// document.querySelector('#autolabel')?.addEventListener('click', labelTitle);
		}
	});

	addNewMD();
	
	let defaultParams = {
		size: {x: 500, y:500},
		cellSize: 50,
		numCells: {x:10, y:10},
		origin: {x:5, y:0}
	}
</script>



<ul class='list-none'>
	{#each mdSets.instances as md}
		<li class='py-4'>
			<MotionDiagram {...defaultParams} bind:posList={md.data.posList} bind:accList={md.data.accList} bind:title={md.title} {handleDelete}/>
		</li>
	{/each}
</ul>

<Button color='alternative' onclick={()=>addNewMD()} class='w-full'><CirclePlusOutline/>Add New Diagram</Button>

