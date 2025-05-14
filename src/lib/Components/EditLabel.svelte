<script lang='ts'>

    import { Label, Input, Button } from 'flowbite-svelte';
    import { EditOutline } from 'flowbite-svelte-icons';

    import {onMount, getContext} from 'svelte';
    interface Props {
        text?: string;
        size?: string;
        vertical?: boolean;
    }

    let { text = $bindable('Title'), size = 'xl', vertical  = false}: Props = $props();
    let editing: boolean = $state(false);

    let sizes = {
        xl2: {text: 'text-3xl', btn: 'lg'},
        xl: {text: 'text-2xl', btn: 'lg'},
        lg: {text: 'text-xl', btn: 'md'},
        md: {text: 'text-lg', btn: 'sm'},
        sm: {text: 'text-md', btn: 'xs'},
        xs: {text: 'text-sm', btn: 'xs'},
    };


    let fontSize:string = $state('');
    let btnSize:string;

    onMount(() => {
        fontSize = sizes[size]['text'];
        btnSize = sizes[size]['btn'];
    });

    let showControlButtons = getContext('ctrl');
    let txtbx:HTMLElement | undefined = $state();
    let focus: void | undefined = $state();

    $effect( ()=>{
            focus = txtbx?.focus();
        }
    );

    const editOn = ()=>{
        editing = true;
        if (focus)
            focus();
    }

    const editOff = ()=>{
        editing = false;
    }

    const editToggle = ()=>{
        let fn = editing ? editOff: editOn;
        fn();
    }
    
</script>

<!-- <div class='flex flex-row'>
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
        <p contenteditable="true" class='{fontSize} font-bold'>{text}</p>
        <p ondblclick={()=>{editing = true;}} class='{fontSize} font-bold'>{text}</p>
    {/if}
</div> -->

<div class='flex flex-row'>
    {#if showControlButtons()}
        <Button color='light' class='p-0 mx-3' size='xs' 
            on:click={()=>{
                editing = !editing;
                if (focus)
                    focus();
            }}
        >
            <EditOutline size='xs'/>
        </Button>
    {/if}
        <div bind:this={txtbx}
            contenteditable={editing && showControlButtons()} class='{fontSize} font-bold w-full' 
            class:bg-white={editing && showControlButtons()}
            class:select-none={!editing}
            class:[writing-mode:sideways-lr]={vertical}
            ondblclick={editToggle}
            onkeydown={(evt) => { if (evt.key == 'Enter') { editOff()}}}
            onblur={editOff}
            onfocus={()=>{console.log('focus')}}
            >{text}
        </div>
</div>
