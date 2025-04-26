<script lang="ts">
	import MotionDiagram from '$lib/Components/MotionDiagram.svelte';
	import type { MD } from '$lib/types';
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

	let mdArray: MD[] = $state([]);
	let id_ind = 0;

	const defaultMD: MD = {
		id: id_ind,
		width: width,
		height: height,
		title: 'Title',
		gridNum: 20,
		marginY: 5,
		posList: [],
		accList: [],
	};


	const addNewMD = () => {
		let md = {...defaultMD, id: id_ind++};
		mdArray = [...mdArray, md];
	}

	const handleDelete = (e: KonvaMouseEvent) => {
		const target = e.target;
		const id = target.attrs()['data-id'];
		if (id) {
			console.log('handleDelete from page ', id);
			mdArray = mdArray.filter(md => md.id !== Number(id));
		}
	}

	const labelTitle = ()=>{
		mdArray.forEach((md,i) => {
			md.title = String.fromCharCode(65 + i);;
		});
		mdArray = [...mdArray];
	}

	const saveData = () => {
		console.log('saveData from motion-diagram page');
	}
	const loadData = () => {
		console.log('loadData from motion-diagram page');
	}

	const refreshAllData = () => {
		mdArray = [];
		addNewMD();
	}
	
	let btnActions = getContext('btnActions');
	onMount( ()=>{
		btnActions.saveData = saveData;
		btnActions.loadData = loadData;
		btnActions.refreshAllData = refreshAllData;
			// console.log(document.querySelector('#savedata'));
			// document.querySelector('#savedata')?.addEventListener('click', saveData);
			// document.querySelector('#loaddata')?.addEventListener('click', loadData);
			// document.querySelector('#refreshalldata')?.addEventListener('click', refreshAllData);
			// document.querySelector('#autolabel')?.addEventListener('click', labelTitle);
		}
	);

	addNewMD();

</script>



<ul class='list-none'>
	{#each mdArray as md}
		<li>
			<MotionDiagram {...md} bind:posList={md.posList} bind:accList={md.accList} bind:title={md.title} {showControlButtons} {handleDelete}/>
		</li>
	{/each}
</ul>
<Button color='alternative' onclick={()=>addNewMD()}><CirclePlusOutline/>Add New Diagram</Button>

