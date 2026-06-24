import { useEffect, useRef } from 'react';

export default function ViewportBackdrop() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let stars: { x: number; y: number; r: number; a: number; twinkle: number }[] = [];
    let frame = 0;
    let animId = 0;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      stars = Array.from({ length: 120 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 1.5 + 0.3,
        a: Math.random() * 0.7 + 0.3,
        twinkle: Math.random() * Math.PI * 2,
      }));
    };

    const draw = () => {
      animId = requestAnimationFrame(draw);
      frame++;
      const w = canvas.width;
      const h = canvas.height;

      const bgGrad = ctx.createLinearGradient(0, 0, 0, h);
      bgGrad.addColorStop(0, '#0d0221');
      bgGrad.addColorStop(0.5, '#150830');
      bgGrad.addColorStop(1, '#0a1628');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, w, h);

      stars.forEach((st) => {
        const twinkle = 0.5 + 0.5 * Math.sin(frame * 0.03 + st.twinkle);
        ctx.beginPath();
        ctx.arc(st.x, st.y, st.r * twinkle, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255,255,255,${st.a * twinkle})`;
        ctx.fill();
      });

      const ng = ctx.createRadialGradient(w * 0.3, h * 0.2, 0, w * 0.3, h * 0.2, w * 0.5);
      ng.addColorStop(0, 'rgba(138,43,226,0.08)');
      ng.addColorStop(1, 'transparent');
      ctx.fillStyle = ng;
      ctx.fillRect(0, 0, w, h);

      const ng2 = ctx.createRadialGradient(w * 0.8, h * 0.85, 0, w * 0.8, h * 0.85, w * 0.4);
      ng2.addColorStop(0, 'rgba(56,189,248,0.05)');
      ng2.addColorStop(1, 'transparent');
      ctx.fillStyle = ng2;
      ctx.fillRect(0, 0, w, h);
    };

    resize();
    window.addEventListener('resize', resize);
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none z-0"
      aria-hidden
    />
  );
}
