<script lang="ts">
    import { Canvas, Layer } from 'svelte-canvas';
    import { onMount } from 'svelte';
    import { Tween, Spring } from 'svelte/motion';
    import { quadOut as easing } from 'svelte/easing';
  
    // let position = new Tween([0.5, 0.5], {easing});
    let position = new Spring([0.5, 0.5]);
    
  
    onMount(() => {
      setInterval(() => 
        (position.target = [Math.random(), Math.random()]), 
        1000);
    });
  
    const render = ({ context, width, height }) => {
      const [x, y] = position.current;
      context.fillStyle = 'tomato';
      context.beginPath();
      context.arc(x * width, y * height, 20, 0, 2 * Math.PI);
      context.fill();
    };
  </script>
  
  <div class="mx-auto h-screen w-screen flex items-center justify-center">
      <Canvas>
        <Layer {render} />
      </Canvas>
  </div>
  