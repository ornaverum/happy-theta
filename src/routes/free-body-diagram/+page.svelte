<script lang="ts">
	import { run } from 'svelte/legacy';

	import { Stage, Layer, Line} from 'svelte-konva';
  	import DragArrow from '../../Components/DragArrow.svelte';
	import html2canvas from 'html2canvas';

    import { Button, Toggle, Label, Select, Input, Hr } from 'flowbite-svelte';
    import {TrashBinOutline, CirclePlusOutline, FileExportOutline, EditOutline, RefreshOutline} from 'flowbite-svelte-icons';
	import EditLabel from '../../Components/EditLabel.svelte';

	let name: string = 'Free Body Diagram';

	let width = 500;
    let height = 500;

	let gridPointList: number[] = [];
	for (let i = -5; i <= 5; i++) {
		gridPointList.push(i);
	}

	let gridList: any[] = [];
	let id_num: number = 0;
	let gridSize = Math.min(height, width);
	let cellSize = gridSize/11.0;
	let gridCenter = gridSize/2.0;
	let snapToGrid = true;
	let showNetForce = $state(false);

	let showControlButtons:boolean = $state(true);

	const colorList = ['red', 'green', 'blue', 'purple', 'orange', 'brown', 'pink', 'cyan', 'magenta', 'yellow'];
		// brown and magenta need work


	const colorVariants: { [key: string]: string } = {
		red: 'bg-red-500',
		green: 'bg-green-500',
		blue: 'bg-blue-500',
		purple: 'bg-purple-500',
		orange: 'bg-orange-500',
		black: 'bg-black-500',
		brown: 'bg-brown-500',
		pink: 'bg-pink-500',
		cyan: 'bg-cyan-500',
		magenta: 'bg-magenta-500',
		yellow: 'bg-yellow-200',
	};


    let fontColorList: string[] = [];
    for (let i = 0; i < colorList.length; i++) {
        fontColorList.push('bg-' + colorList[i] + '-500');
    } 

	for (let i = -5; i <= 5; i++) {
		let startParallel = i * cellSize + gridCenter;
		let startPerp = -5 * cellSize + gridCenter;
		let endPerp = 5 * cellSize + gridCenter;
		gridList.push({
			id: id_num++,
			x0: startParallel,
			y0: startPerp,
			x1: startParallel,
			y1: endPerp,
			strokeWidth: i==0 ? 4 : 2,
		});
		gridList.push({
			id: id_num++,
			x0: startPerp,
			y0: startParallel,
			x1: endPerp,
			y1: startParallel,
			strokeWidth: i==0 ? 5 : 2,
		});
	}


	type VectorArrow = {
		id: number,
		gridCenter: number,
		cellSize: number,
		snapToGrid: boolean,
		pos0: {x: number, y: number},
		pos1: {x: number, y: number},
		stroke: string,
	};

	type TaoItem = {
		id: number,
		symbol: string,
		type: string,
		agent: string,
		object: string,
        color: string,
	};
	
	type Force = {
		id: number,
		symbol: string,
		type: string,
		agent: string,
		object: string,
		components: {
			x: number,
			y: number,
		},
		color: string;
		draggable: boolean;
		editText: boolean;
	};

	type Pt = {
        x: number,
        y: number,
    };

	let netForce: Force = $state({
		id: -1,
		symbol: 'F_net',
		type: 'Net Force',
		agent: '-',
		object: 'System',
		color: 'black',
		components: {
			x: 0,
			y: 0,
		},
		draggable: false,
		editText: false,
	});
	
	let forceList: Force[] = $state([]);
	let lastForceId = 0;

	let arrowList: VectorArrow[] = [];

	let taoList: TaoItem[] = [];

	let addNewForce = (comps: Pt) => {
		console.log("Adding new force with components = " + JSON.stringify(comps));
		let newForce: Force = {
			id: lastForceId++,
			symbol: 'F',
			type: 'Enter Type',
			agent: 'Enter Agent',
			object: 'Enter Object',
			components: comps,
			color: colorList[(lastForceId-1) % colorList.length],
			draggable: true,
			editText: false,
		};
		forceList = [...forceList, newForce];

		forceList.forEach((force) => {
			console.log("Force id = " + force.id + " and components = " + JSON.stringify(force.components));
		});	
	}


	run(() => {
		netForce.components.x = 0;
		netForce.components.y = 0;
		forceList.forEach((force) => {
			netForce.components.x += force.components.x;
			netForce.components.y += force.components.y;
		});
	});


	function removeForce(forceId:number) {
		console.log("Removing force with id = " + forceId);
        forceList = forceList.filter(force => force.id !== forceId);
    }


	const deleteAll = () => {
		forceList = [];
		lastForceId = 0;
	}

	let divToCapture: HTMLDivElement = $state();

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


	// addNewForce({x:1, y:1});
	// Add initial arrow for testing

	const getCompsFromEvt = (evt:CustomEvent) => {
		let comps = {
			x: Math.round((evt.detail.evt.layerX - gridCenter) / cellSize),
			y: -Math.round((evt.detail.evt.layerY - gridCenter) / cellSize),
		};
		return comps;
	};


	let FBDLabel:string = 'Free Body Diagram';
	let editFBDLabel: boolean = false;

	const handleCloseInput = (key:string, flag:boolean) => {
		console.log("Key pressed = " + key);
		if (key == 'Enter')
			flag = false;
	}

</script>

<main class="flex flex-col bg-gray-50 justify-center">
	<div id='button-group' class = 'flex flex-row p-4'>
		<Button on:click={saveDivAsImage} class="mx-2"><FileExportOutline/></Button>
		<Button on:click={deleteAll} class="mx-2"><RefreshOutline/></Button>
		<Toggle class="mx-2" bind:checked={showNetForce}
			>Show Net Force</Toggle>
	</div >
	<div id='capture'  bind:this={divToCapture} class='mx-auto w-max'>
		<div id='fbd-label' class='w-3/4 mx-auto text-2xl font-bold flex flex-col rounded-xl border-1 my-4'>
			<EditLabel text='FBD Title' size='xl2' {showControlButtons}/>
			 <!-- <div contenteditable="true">{FBDLabel}</div> -->
		</div>
		
		<div class='flex flex-row flex-wrap'>
			<div id='fbd' class='px-4 flex flex-col'>
				<div id='fbd-label' class='ml-4 text-lg font-bold flex flex-row rounded-xl border-1'>
					Free Body Diagram
				</div>
				<Stage config={{width, height, id:'main_stage'}}
		
					on:dblclick={(evt) => {
						let comps = getCompsFromEvt(evt);
						console.log(comps);
						addNewForce(comps);
					}}
				>
					<Layer config={{id: 'grid_layer'}}>
						{#each gridList as item (item.id)}
							<Line config={{
								points: [item.x0, item.y0, item.x1, item.y1],
								stroke: 'gray',
								strokeWidth: item.strokeWidth,
								}} />
						{/each}
					</Layer>
					<Layer config={{id:'arrow_layer'}}>
						{#each forceList as force (force.id)}
							<DragArrow
								strokeColor={force.color}
								draggable={force.draggable}
								id={force.id}
								cellSize={cellSize}
								gridCenter={gridCenter}
								snapToGrid={true}
								bind:comps={force.components}
							/>
						{/each}
						{#if showNetForce}
							<DragArrow
								strokeColor={netForce.color}
								strokeSize={6}
								draggable={false}
								id={netForce.id}
								cellSize={cellSize}
								gridCenter={gridCenter}
								snapToGrid={true}
								opacity={0.5}
								bind:comps={netForce.components}
							/>
						{/if}
					</Layer>
		
		
				</Stage>
			</div>
			<div id="tao-chart" class='max-w-lg px-4 top-0 flex-auto'>
				<div id='fbd-label' class='mx-auto text-lg font-bold flex flex-row rounded-xl border-1'>
					<p>TAO Chart</p>
				</div>
				{#if forceList.length == 0}
					<div class='mx-auto my-4 p-2 text-xl font-bold rounded-xl border-1'>
						<p>No Forces Yet</p>
						<p class='text-sm'>Add a force by double clicking on the FBD or clicking the button below</p>
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
					<div id='tao-item' class= {`${colorVariants[force.color]} p-2.5 m-1 gap-2 font-bold rounded-xl grid grid-cols-[0.25fr_1fr_2fr_2fr_2fr_0.25fr] w-full`}>
						<Button color="red" class="mb-0 p-0 w-0"
								on:click={() => {
									force.editText = !force.editText;
								}}
								size="xs"
							>
								<EditOutline/>
							</Button>
							{#if force.editText}
								<Input id='tao-symbol' bind:value={force.symbol} placeholder="Symbol" class='my-auto'
									on:keydown={(evt) => { if (evt.key == 'Enter') { force.editText = false;}}}
								/>
								<Input id='tao-type' bind:value={force.type} class='my-auto'
									on:keydown={(evt) => { if (evt.key == 'Enter') { force.editText = false;}}}
								/>
		
								<Input id='tao-agent' bind:value={force.agent} class='my-auto'
									on:keydown={(evt) => { if (evt.key == 'Enter') { force.editText = false;}}}
		
								/>
								<Input id='tao-object' bind:value={force.object} class='my-auto'
									on:keydown={(evt) => { if (evt.key == 'Enter') { force.editText = false;}}}
								/>
							{:else}
								<div class='mx-auto' ondblclick={()=>{force.editText = true}}>{force.symbol}</div>
								<div class='mx-auto' ondblclick={()=>{force.editText = true}}>{force.type}</div>
								<div class='mx-auto' ondblclick={()=>{force.editText = true}}>{force.agent}</div>
								<div class='mx-auto' ondblclick={()=>{force.editText = true}}>{force.object}</div>
								
							{/if}
							<Button color="red" class="mb-0 p-0 w-0"
								on:click={() => removeForce(force.id)}
							>
								<TrashBinOutline/>
							</Button>
						</div>
					{/each}
					<Button outline class='w-full'
						on:click={() => {
							addNewForce({x:1, y:1});
						}}>
						<CirclePlusOutline/> Add New Force
					</Button>
					{#if showNetForce}
					<Hr classHr="w-48 h-1 mx-auto my-7 rounded md:my-10"> = </Hr>
					<div id='netForce-item' class='mt-4 p-4 w-full inline-flex flex-row justify-center font-bold text-xl mx-auto bg-gray-500 text-white rounded-xl'>
							<div>Net Force
								{#if (netForce.components.x == 0 && netForce.components.y == 0)}
									= 0
								{/if}
							</div>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>

	

</main>
