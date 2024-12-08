
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
