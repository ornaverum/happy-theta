<script lang="ts">
	import MotionDiagram from './../../Components/MotionDiagram.svelte';
	import type { MD } from '../../Components/kinematicsTypes';

	import { Stage, Layer, Line, Circle, Arrow} from 'svelte-konva';
	import html2canvas from 'html2canvas';

    import { Label, Select, Input, Button, Toggle } from 'flowbite-svelte';
    import {TrashBinOutline, FileExportOutline, CirclePlusOutline} from 'flowbite-svelte-icons';

	interface Props {
		name?: string;
	}

	let { name = 'Motion Diagram' }: Props = $props();
	let showControlButtons: boolean = $state(true);

	let width = 800;
    let height = 200;

	let mdArray: MD[] = $state([]);
	let id_ind = 0;

	const defaultMD: MD = {
		id: id_ind,
		width: width,
		height: height,
		title: 'Title',
		gridNum: 30,
		marginY: 5,
		posList: [],
		velList: [],
		accList: [],
	};


	const addNewMD = () => {
		let md = {...defaultMD, id: id_ind++};
		mdArray = [...mdArray, md];
	}

	let divToCapture: HTMLDivElement = $state(null);

	const saveDivAsImage = async () => {
		let tempCtrl = showControlButtons;
		await setControlButtons(false);
		const canvas = await html2canvas(divToCapture);
		const dataUrl = canvas.toDataURL('image/png');
		const link = document.createElement('a');
		link.href = dataUrl;
		link.download = 'div-image.png';
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
		await setControlButtons(tempCtrl);
	};

	async function setControlButtons(ctrl:boolean){
		showControlButtons = ctrl;
	} 

	const handleDelete = (e:CustomEvent) => {
		mdArray = mdArray.filter(md => md.id !== e.detail.id);
	}

	const labelTitle = ()=>{
		mdArray.forEach((md,i) => {
			md.title = String.fromCharCode(65 + i);;
		});
		mdArray = [...mdArray];
	}

	addNewMD();

</script>

<main class="flex flex-col justify-center p-4 rounded-xl">
	<div id='button-group' class = 'flex flex-row p-4 w-1/3 justify-around'>
		<Button on:click={saveDivAsImage}><FileExportOutline/></Button>
		<Button class='my-1' on:click={()=>labelTitle()}>Autolabel</Button>
		<Toggle bind:checked={showControlButtons}>Show Control Buttons</Toggle>
	</div>
	<div id='capture' bind:this={divToCapture} class='w-max mx-auto'>
		<ul class='list-none'>
			{#each mdArray as md}
				<li>
					<MotionDiagram {...md} bind:posList={md.posList} bind:velList={md.velList} bind:accList={md.accList} bind:title={md.title} {showControlButtons}/>
				</li>
			{/each}
		</ul>
	</div>
	<Button on:click={()=>addNewMD()}><CirclePlusOutline/>Add New Diagram</Button>	

</main>
