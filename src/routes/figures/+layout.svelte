<script lang="ts">
	import { setContext, getContext } from 'svelte';
	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';

	let { children } = $props();
	let showControlButtons = $state(false);
	let refreshAction = getContext('refreshAction');

	const testContextFunction = () => {console.log('              testContextFunction from layout')}
	setContext('testContextFromLayout', testContextFunction);


	let testContextFunctionFromCapDiv = $state(()=>{});
	setContext('testContextFromCapDiv', testContextFunctionFromCapDiv);

	testContextFunctionFromCapDiv();
</script>

<div class="w-max mx-auto w-7/12">
	{@render children?.()}
</div>

