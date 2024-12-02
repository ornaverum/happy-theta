<script lang='ts'>
    import { run } from 'svelte/legacy';

	import type { Dot, VectorArrow } from '../kinematicsTypes.js';
	import { Stage, Layer, Line, Circle, Arrow, Text} from 'svelte-konva';

    interface Props {
        velList?: VectorArrow[];
        posList?: Dot[];
    }

    let { velList = $bindable([]), posList = [] }: Props = $props();


    const addDisplacementArrow = (pos0:{x:number, y:number}, pos1:{x:number, y:number}) => {
        let newArrow: VectorArrow = {
            id: velList.length,
            pos0: pos0,
            pos1: pos1,
            stroke: 'green',
            opacity: 1.0,
        };
        velList = [...velList, newArrow];
    }
    run(() => {
        velList = [];
        for (let i = 0; i < posList.length - 1; i++) {
            let pos0 = posList[i];
            let pos1 = posList[i+1];
            if (pos0.x == pos1.x)
                continue;
            else 
                addDisplacementArrow(pos0, pos1);
        }

    });
</script>


<Layer config={{id:'velocity_layer'}}>
    {#each velList as arrow (arrow.id)}
        <Arrow config={{points: [arrow.pos0.x, arrow.pos0.y, arrow.pos1.x, arrow.pos1.y],
        stroke: arrow.stroke,
        opacity: arrow.opacity,
        strokeWidth: 4,
        }}/>
    {/each}
</Layer>