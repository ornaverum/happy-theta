<script lang='ts'>

    import { Label, Input, Button } from 'flowbite-svelte';
    import { EditOutline } from 'flowbite-svelte-icons';

    import {onMount, getContext} from 'svelte';
    interface Props {
        text?: string;
        size?: string;
    }

    let { text = $bindable('Title'), size = 'xl'}: Props = $props();
    let editing: boolean = $state(false);

    let sizes = {
        xl2: {text: 'text-3xl', btn: 'lg'},
        xl: {text: 'text-2xl', btn: 'lg'},
        lg: {text: 'text-xl', btn: 'md'},
        md: {text: 'text-lg', btn: 'sm'},
        sm: {text: 'text-md', btn: 'xs'},
        xs: {text: 'text-sm', btn: 'xs'},
    };


    let fontSize:string = $state();
    let btnSize:string;

    onMount(() => {
        fontSize = sizes[size]['text'];
        btnSize = sizes[size]['btn'];
    });

    let showControlButtons = getContext('ctrl');


</script>

<div class='flex flex-row'>
    {#if showControlButtons()}
        <Button color='light' class='p-0 mx-3' size='xs' on:click={()=>{editing = !editing}}>
            <EditOutline size='xs'/>
        </Button>
    {/if}
    {#if editing && showControlButtons()}
        <Input bind:value={text} placeholder="Title" size={fontSize}
            onkeydown={(evt) => { if (evt.key == 'Enter') { editing = false;}}}
            onblur={()=>{editing = false;}}
        />
    {:else}
        <p ondblclick={()=>{editing = true;}} class='{fontSize} font-bold'>{text}</p>
    {/if}
</div>
