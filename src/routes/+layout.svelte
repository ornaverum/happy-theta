<script>
	import '../app.css';
	import { page } from '$app/stores';
	import { base } from '$app/paths';
	import { DarkMode } from 'flowbite-svelte';
	import { Navbar, NavBrand, NavLi, NavUl, NavHamburger } from 'flowbite-svelte';
	let darkmodebtn =
		'text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-4 focus:ring-gray-200 dark:focus:ring-gray-700 rounded-lg text-lg p-2.5 fixed right-4 top-2 z-50';
	import { Footer, FooterBrand, FooterCopyright, FooterIcon, FooterLink, FooterLinkGroup } from 'flowbite-svelte';
	/** @type {{children?: import('svelte').Snippet}} */
	let { children } = $props();

	let activeURL = $state($page.url.pathname)
</script>

<!-- <DarkMode btnClass={darkmodebtn} /> -->
 <!-- <DarkMode></DarkMode> -->

<Navbar let:hidden let:toggle >
	<NavBrand href="/">
		<object data="/IALogo.svg" class="me-3 h-6 sm:h-9" title="Inertial Apple Logo"></object>
		<span class="self-center whitespace-nowrap text-xl font-semibold dark:text-white">Inertial Apple</span>

	</NavBrand>
	<NavHamburger class='ml-16' />
	<NavUl {hidden}>
	  <NavLi href="{base}/">Home</NavLi>
	  <NavLi href="{base}/free-body-diagram">Free Body Diagram</NavLi>
	  <NavLi href="{base}/motion-diagram">Motion Diagram</NavLi>
	  <NavLi href="{base}/graph-maker">Graph Maker</NavLi>
	  <!-- <NavLi href="{base}/grapher">Grapher</NavLi> -->
	  <!-- <NavLi href="{base}/vid-analysis">Video Analysis</NavLi> -->
	  <!-- <NavLi href="{base}/equation-editor">Equation Editor</NavLi> -->
	</NavUl>
  </Navbar>

{@render children?.()}


<Footer class="fixed bottom-0 z-20 w-full p-4 bg-white border-t border-gray-200 shadow md:flex md:items-center md:justify-between md:p-6 dark:bg-gray-800 dark:border-gray-600">
	<div class="sm:flex sm:items-center sm:justify-between">
	<FooterCopyright href="/" by="Jack Neel Waddell" year={2024} />
	<FooterLinkGroup ulClass="flex flex-wrap items-center mt-3 text-sm text-gray-500 dark:text-gray-400 sm:mt-0">
	  <!-- <FooterLink href="/">About</FooterLink>
	  <FooterLink href="/">Privacy Policy</FooterLink>
	  <FooterLink href="/">Licensing</FooterLink>
	  <FooterLink href="/">Contact</FooterLink> -->
	</FooterLinkGroup>
	</div>
  </Footer>


