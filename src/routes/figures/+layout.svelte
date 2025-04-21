<script>
	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';
	let { children } = $props();
</script>

<div class="w-max mx-auto w-7/12">
    <CaptureDiv>
        {@render children()}
    </CaptureDiv>
</div>

