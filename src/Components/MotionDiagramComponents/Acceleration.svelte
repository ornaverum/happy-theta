<script lang='ts'>
	import type { acceleration, Dot, VectorArrow } from '../kinematicsTypes.js';
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect} from 'svelte-konva';

	// export let accList: VectorArrow[] = [];

	interface Props {
		accList?: acceleration[];
		active?: boolean;
		width?: number;
		height?: number;
		cellSize?: number;
		gridCenter?: number;
		yValue?: number;
		posList?: Dot[];
	}

	let {
		accList = $bindable([]),
		active = true,
		width = 800,
		height = 100,
		cellSize = 20,
		gridCenter = 400,
		yValue = 20,
		posList = []
	}: Props = $props();

	let previewAcc: acceleration = $state({
		id: -1,
		dir: 1,
		dot: null,
		arrow: null
    })

	const getClosestPos = (pos: {x:number, y:number}) => {
		let closestDot = null;
		let minDist = 1000000;
		posList.forEach(dot => {
			let dist = Math.sqrt((dot.x - pos.x)**2 + (dot.y - pos.y)**2);
			if (dist < minDist){
				minDist = dist;
				closestDot = dot;
			}
		});
		if (closestDot == null){
			return {pos};
		}else {
			return {x:closestDot.x, y:closestDot.y};
		}
	}

	const getpreviewAcceleration = (pos = {x:gridCenter, y:height/2.0}) => {
        if (pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height) {
            return {x: gridCenter, y: height/2.0};
        }

        let snappedPos = {...pos};
		let yValue = height/2.0;


		if (posList.length > 0){
			snappedPos = {...getClosestPos(pos)};
			snappedPos.y -= cellSize/2;
		} else {
			snappedPos.x = Math.round((pos.x - gridCenter) / cellSize) * cellSize + gridCenter;
			snappedPos.y = yValue;
		}
    

		if (pos.x - snappedPos.x > cellSize/2){
			previewAcc.dir = 1;
			previewAcc.dot = null;
			previewAcc.arrow = {
				id: -1,
				pos0: {x: snappedPos.x - cellSize/2, y: snappedPos.y},
				pos1: {x: snappedPos.x + cellSize/2, y: snappedPos.y},
				stroke: 'red',
				opacity: 0.5,
			};

		} else if (snappedPos.x - pos.x > cellSize/2){
			previewAcc.dir = -1;
			previewAcc.dot = null;
			previewAcc.arrow = {
				id: -1,
				pos0: {x: snappedPos.x + cellSize/2, y: snappedPos.y},
				pos1: {x: snappedPos.x - cellSize/2, y: snappedPos.y},
				stroke: 'red',
				opacity: 0.5,
			};

		} else {
			previewAcc.dir = 0;
			previewAcc.arrow = null;
			previewAcc.dot = {
				id: -1,
				x: snappedPos.x,
				y: snappedPos.y,
				radius: 4,
				fill: 'red',
				opacity: 1,
			}
		};
    
    }


	const handleClick = (e:CustomEvent) => {
		accList = [...accList, {...previewAcc, id: accList.length}];
	}

	const handleMouseMove = (event:CustomEvent) =>{
		let pos = {x: event.detail.evt.layerX, y: event.detail.evt.layerY};
		getpreviewAcceleration(pos);
	};


</script>

<Layer config={{id:'accel_layer'}}
	>

	{#each accList as acc (acc.id)}
		{#if (acc.dot)}
			<Circle config={acc.dot}/>
		{:else if (acc.arrow)}
			<Arrow points= {[acc.arrow.pos0.x, acc.arrow.pos0.y, acc.arrow.pos1.x, acc.arrow.pos1.y]}
				stroke= {acc.arrow.stroke}
				opacity= {acc.arrow.opacity}
				strokeWidth= {4}
				/>
		{/if}
	{/each}
	{#if active}
        <Rect 
            x={0}
            y= {0}
            {height}
            {width}
            fill= 'white'
            opacity= {0}
            on:click={handleClick}
			on:mousemove={handleMouseMove}
        />
		{#if (previewAcc.dot)}
			<Circle {...previewAcc.dot}/>
		{:else if (previewAcc.arrow)}
			<Arrow points={[previewAcc.arrow.pos0.x, previewAcc.arrow.pos0.y, previewAcc.arrow.pos1.x, previewAcc.arrow.pos1.y]}
				stroke= {previewAcc.arrow.stroke}
				opacity= {previewAcc.arrow.opacity}
				strokeWidth= {4}
				/>
		{/if}

    {/if}
</Layer>