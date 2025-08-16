<script lang="ts">
	import '../app.css';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { DarkMode } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger, Tooltip } from 'flowbite-svelte';
	import { setContext, getContext } from 'svelte';
	import CaptureDiv from '$lib/Components/CaptureDiv.svelte';
	let darkmodebtn =
		'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-lg p-2.5 fixed right-4 top-2 z-50';
	import { Footer, FooterBrand, FooterCopyright, FooterIcon, FooterLink, FooterLinkGroup } from 'flowbite-svelte';
	let { children } = $props();



</script>

<!-- <DarkMode btnClass={darkmodebtn} /> -->
 <!-- <DarkMode></DarkMode> -->

<div class="h-screen max-w-full overflow-x-hidden bg-gradient-to-b from-white to-blue-200">
	<Navbar let:hidden let:toggle >
		<NavBrand href="/">
			<object data="/HappyThetaLogo.svg" class="max-h-12" title="Happy Theta Logo"></object>
			<!-- <object data="/HappyThetaLogo.svg" class="me-3 h-6 sm:h-9" title="Happy Theta Logo"></object> -->
			<!-- <span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">Inertial Apple</span> -->
	
		</NavBrand>
		<NavHamburger class='ml-16' />
		<NavUl {hidden}>
		  <NavLi href="{base}/">Home</NavLi>
		  <NavLi href="{base}/figures/free-body-diagram">Free Body Diagram</NavLi>
		  <NavLi href="{base}/figures/energy-diagram">Energy Diagram</NavLi>
		  <NavLi href="{base}/figures/motion-diagram">Motion Diagram</NavLi>
		  <NavLi href="{base}/figures/graph-maker">Graph Maker</NavLi>
		  <!-- <NavLi href="{base}/grapher">Grapher</NavLi> -->
		  <!-- <NavLi href="{base}/vid-analysis">Video Analysis</NavLi> -->
		  <!-- <NavLi href="{base}/equation-editor">Equation Editor</NavLi> -->
		</NavUl>
	  </Navbar>
	<div class="">
		{@render children?.()}
	</div>
	<div class=''>
	</div>
</div>
<!-- 
<Footer class="fixed bottom-0 z-20 w-full p-4 bg-white border-t border-gray-200 shadow md:flex md:items-center md:justify-between md:p-6 dark:bg-gray-800 dark:border-gray-600">
	<div class="sm:flex sm:items-center sm:justify-between">
	<FooterCopyright href="/" by="Jack Neel Waddell" year={2024} />
	<FooterLinkGroup ulClass="flex flex-wrap items-center mt-3 text-sm text-gray-500 dark:text-gray-400 sm:mt-0">
	</FooterLinkGroup>
	</div>
  </Footer> -->



