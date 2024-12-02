<script lang='ts'>

    import type { Dot, VectorArrow, Point } from '../kinematicsTypes.js';

	let name: string = 'Motion Diagram Position omponent';
	import { Stage, Layer, Line, Circle, Arrow, Text, Rect} from 'svelte-konva';

    let preViewYValue: number = 20;

    interface Props {
        posList?: Dot[];
        width?: number;
        height?: number;
        cellSize?: number;
        gridCenter?: number;
        yValue?: number;
        active?: boolean;
    }

    let {
        posList = $bindable([]),
        width = 800,
        height = 100,
        cellSize = 20,
        gridCenter = 400,
        yValue = $bindable(20),
        active = true
    }: Props = $props();

	let previewPos: Dot = $state({
        id: -1,
        x: gridCenter,
        y: height/2.0,
        radius: 8,
        fill: 'blue',
        opacity: 0.5,
    })
    
    const addNewDot = () => {
        let newPos = {... previewPos};
        newPos.opacity = 1.0;
        newPos.id = posList.length;
        posList = [...posList, newPos];
        yValue = preViewYValue;
    }

    const getPreviewPosition = (pos = {x:gridCenter, y:height/2.0}) => {
        if (pos.x < 0 || pos.x > width || pos.y < 0 || pos.y > height) {
            return {x: gridCenter, y: height/2.0};
        }
    
        let snappedPos = {...pos};
        snappedPos.x = Math.round((pos.x - gridCenter) / cellSize) * cellSize + gridCenter;
        preViewYValue = yValue;
        if (posList.length > 0){
            let lastDot = posList[posList.length-1];
            if (snappedPos.x == lastDot.x){
                preViewYValue = yValue + cellSize;
            } else if ( posList.length > 1){
                let secondLastDot = posList[posList.length-2];
                if (Math.sign(snappedPos.x - lastDot.x) * Math.sign(lastDot.x - secondLastDot.x) == -1){
                    preViewYValue = yValue + cellSize;
                }
            }
        }
    
        if (posList.length > 0){
            let lastDot = posList[posList.length-1];
    
            if (lastDot.x != snappedPos.x){
                // addDisplacementArrow(lastDot,{x: snappedPos.x, y: yValue});
            }
        }
    
        snappedPos.y = preViewYValue;
        return snappedPos;
    }

    const handleClick = (event:CustomEvent)=>{
        console.log('position clicked');
        addNewDot();
    }

    const handleMouseMove = (event:CustomEvent)=>{
        const nd = event.detail.currentTarget;
		let pos = {x: event.detail.evt.layerX, y: event.detail.evt.layerY};
        let snappedPos = getPreviewPosition(pos);
        previewPos = {
            id: 'preview',
            x: snappedPos.x,
            y: snappedPos.y,
            radius: 8,
            fill: 'blue',
            opacity: 0.5,
        }
    };
    
</script>

<Layer config={{id:'position_layer'}} 
>
    {#each posList as pos (pos.id)}
        <Circle config={pos} />
    {/each}
    {#if active}
        <Circle config={previewPos} />

        <Rect config={{
            x: 0,
            y: 0,
            height: height,
            width: width,
            fill: 'red',
            opacity: 0,
        }}
            on:click={handleClick}
            on:mousemove={handleMouseMove}
        />
    {/if}
</Layer>