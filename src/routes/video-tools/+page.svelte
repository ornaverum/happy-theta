<script>
    import { Canvas, Layer } from 'svelte-canvas';
  
    const render = ({ context, width, height }) => {
      context.font = `${width / 10}px sans-serif`;
      context.fillStyle = 'tomato';
      context.fillText('hello world', width / 2, height / 2);
    };
  </script>
  
  <div class=''>
      <Canvas width={600} height={600} class='mx-auto'>
        <Layer {render} />
      </Canvas>
  </div>