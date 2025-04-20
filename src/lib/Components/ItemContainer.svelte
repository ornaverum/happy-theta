<script lang='ts'>
    interface Props {
		children? : any;
		saveData?: ()=> void;
		loadData?: ()=> void;
		refreshAll?: ()=> void;
	}

	let { 
		children, 
		saveData=()=>{}, 
		loadData=()=>{}, 
		refreshAll=()=>{} }: Props = $props();

</script>


<div id='controls'>
    {@render children?.()}
</div>	