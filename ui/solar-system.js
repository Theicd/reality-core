// REALITY CORE - Cinematic Solar System Renderer
class SolarSystemRenderer {
  constructor(canvasId) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.active = false;
    this.planets = [];
    this.hoverPlanet = null;
    this.animFrame = null;
    this.opacity = 0;
    this.time = 0;
    this._stars = this._genStars(600);
    this._nebula = this._genNebula(40);
    this.canvas.addEventListener('click', (e) => this.onClick(e));
    this.canvas.addEventListener('mousemove', (e) => this.onHover(e));
  }

  _genStars(n) {
    return Array.from({length:n}, () => ({
      x: Math.random(), y: Math.random(),
      s: Math.random()*1.8+0.2, b: Math.random()*0.7+0.3,
      sp: Math.random()*2+0.5, color: ['200,220,255','255,240,220','180,200,255','255,220,200'][Math.floor(Math.random()*4)]
    }));
  }
  _genNebula(n) {
    return Array.from({length:n}, () => ({
      x: Math.random(), y: Math.random(),
      r: Math.random()*80+30, c: [`rgba(0,100,200,${Math.random()*0.02})`,`rgba(100,0,150,${Math.random()*0.015})`,`rgba(0,80,100,${Math.random()*0.01})`][Math.floor(Math.random()*3)]
    }));
  }

  show(planets) {
    this.planets = planets || [];
    this.active = true;
    this.canvas.classList.add('active');
    this.opacity = 0;
    this.resize();
    this.render();
  }

  hide() {
    this.active = false;
    this.canvas.classList.remove('active');
    if (this.animFrame) cancelAnimationFrame(this.animFrame);
  }

  resize() {
    const r = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = r.width; this.canvas.height = r.height;
  }

  render() {
    if (!this.active) return;
    const ctx = this.ctx, w = this.canvas.width, h = this.canvas.height;
    const cx = w/2, cy = h/2;
    this.time += 0.004;
    if (this.opacity < 1) this.opacity = Math.min(1, this.opacity + 0.02);
    ctx.globalAlpha = this.opacity;
    ctx.clearRect(0,0,w,h);

    // Deep space background
    const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,Math.max(w,h)*0.7);
    bg.addColorStop(0,'#060c18'); bg.addColorStop(0.5,'#030810'); bg.addColorStop(1,'#010306');
    ctx.fillStyle = bg; ctx.fillRect(0,0,w,h);

    // Nebula clouds
    this._nebula.forEach(n => {
      ctx.fillStyle = n.c;
      ctx.beginPath(); ctx.arc(n.x*w, n.y*h, n.r, 0, Math.PI*2); ctx.fill();
    });

    // Twinkling stars
    this._stars.forEach(s => {
      const twinkle = 0.5 + Math.sin(this.time*s.sp + s.x*100)*0.3 + Math.sin(this.time*1.7+s.y*200)*0.2;
      ctx.fillStyle = `rgba(${s.color},${s.b*twinkle})`;
      ctx.beginPath(); ctx.arc(s.x*w, s.y*h, s.s, 0, Math.PI*2); ctx.fill();
      if (s.s > 1.2) { // bright star cross
        ctx.strokeStyle = `rgba(${s.color},${s.b*twinkle*0.3})`;
        ctx.lineWidth = 0.3;
        ctx.beginPath(); ctx.moveTo(s.x*w-3,s.y*h); ctx.lineTo(s.x*w+3,s.y*h); ctx.stroke();
        ctx.beginPath(); ctx.moveTo(s.x*w,s.y*h-3); ctx.lineTo(s.x*w,s.y*h+3); ctx.stroke();
      }
    });

    const os = Math.min(w,h) / 68;

    // --- SUN ---
    const sunR = 16;
    // Corona
    for (let i = 4; i > 0; i--) {
      const cr = ctx.createRadialGradient(cx,cy,sunR*0.5,cx,cy,sunR*(2+i*1.5));
      cr.addColorStop(0, `rgba(255,200,50,${0.04*i})`);
      cr.addColorStop(0.5, `rgba(255,120,20,${0.02*i})`);
      cr.addColorStop(1, 'transparent');
      ctx.fillStyle = cr; ctx.beginPath(); ctx.arc(cx,cy,sunR*(2+i*1.5),0,Math.PI*2); ctx.fill();
    }
    // Sun body with animated surface
    const sunGrad = ctx.createRadialGradient(cx-2,cy-2,0,cx,cy,sunR);
    sunGrad.addColorStop(0,'#fffbe8'); sunGrad.addColorStop(0.4,'#ffe066'); sunGrad.addColorStop(0.8,'#ff9900'); sunGrad.addColorStop(1,'#cc5500');
    ctx.fillStyle = sunGrad; ctx.beginPath(); ctx.arc(cx,cy,sunR,0,Math.PI*2); ctx.fill();
    // Sun flare
    ctx.strokeStyle = `rgba(255,200,100,${0.15+Math.sin(this.time*3)*0.1})`;
    ctx.lineWidth = 0.8;
    for (let a = 0; a < Math.PI*2; a += 0.4) {
      const len = sunR*(1.5+Math.sin(this.time*5+a*3)*0.5);
      ctx.beginPath(); ctx.moveTo(cx+Math.cos(a)*sunR*1.1, cy+Math.sin(a)*sunR*1.1);
      ctx.lineTo(cx+Math.cos(a)*len, cy+Math.sin(a)*len); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,250,220,0.9)'; ctx.font = 'bold 8px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText('SUN', cx, cy+sunR+12);

    // --- PLANETS ---
    const MOONS_VIS = {earth:1,mars:2,jupiter:4,saturn:3,uranus:2,neptune:1};
    const SIZES = {mercury:3,venus:5,earth:5.5,mars:4,jupiter:13,saturn:11,uranus:8,neptune:7.5};

    this.planets.forEach(p => {
      const orbitR = p.semiMajorAU * os;
      const angle = ((p.posAngle||0) + this.time * (50/p.orbitalPeriodDays)) * Math.PI / 180;
      const px = cx + Math.cos(angle) * orbitR;
      const py = cy + Math.sin(angle) * orbitR * 0.35; // Elliptical perspective
      const pr = (SIZES[p.id]||4);
      const isHover = this.hoverPlanet === p.id;

      // Orbit path (dashed, glowing)
      ctx.setLineDash([3,6]);
      ctx.strokeStyle = isHover ? 'rgba(0,229,255,0.2)' : 'rgba(0,229,255,0.04)';
      ctx.lineWidth = isHover ? 1 : 0.5;
      ctx.beginPath(); ctx.ellipse(cx,cy,orbitR,orbitR*0.35,0,0,Math.PI*2); ctx.stroke();
      ctx.setLineDash([]);

      // Planet atmospheric glow
      const gSize = pr * (isHover ? 5 : 3.5);
      const glow = ctx.createRadialGradient(px,py,pr*0.5,px,py,gSize);
      glow.addColorStop(0, p.color + (isHover ? '50' : '25'));
      glow.addColorStop(1, 'transparent');
      ctx.fillStyle = glow; ctx.beginPath(); ctx.arc(px,py,gSize,0,Math.PI*2); ctx.fill();

      // Planet body with shading
      const pGrad = ctx.createRadialGradient(px-pr*0.3,py-pr*0.3,0,px,py,pr);
      pGrad.addColorStop(0, this._lighten(p.color,40));
      pGrad.addColorStop(0.6, p.color);
      pGrad.addColorStop(1, this._darken(p.color,60));
      ctx.fillStyle = pGrad; ctx.beginPath(); ctx.arc(px,py,pr,0,Math.PI*2); ctx.fill();

      // Saturn rings
      if (p.id === 'saturn') {
        for (let ri = 0; ri < 3; ri++) {
          const ringR = pr*(1.6+ri*0.35);
          const ringA = 0.25 - ri*0.06;
          ctx.strokeStyle = `rgba(210,190,150,${ringA})`;
          ctx.lineWidth = 2-ri*0.5;
          ctx.beginPath(); ctx.ellipse(px,py,ringR,ringR*0.2,0.15,0,Math.PI*2); ctx.stroke();
        }
      }

      // Uranus ring (thin, tilted)
      if (p.id === 'uranus') {
        ctx.strokeStyle = 'rgba(126,200,227,0.15)'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.ellipse(px,py,pr*1.8,pr*1.8*0.1,1.3,0,Math.PI*2); ctx.stroke();
      }

      // Moons
      const moonCount = MOONS_VIS[p.id] || 0;
      for (let mi = 0; mi < moonCount; mi++) {
        const mAngle = this.time*(3+mi*1.5) + mi*2.1;
        const mDist = pr*(2+mi*0.8);
        const mx = px + Math.cos(mAngle)*mDist;
        const my = py + Math.sin(mAngle)*mDist*0.4;
        const mr = 1.2 + (p.id==='jupiter'?0.5:0);
        ctx.fillStyle = 'rgba(200,200,220,0.6)';
        ctx.beginPath(); ctx.arc(mx,my,mr,0,Math.PI*2); ctx.fill();
        // Moon glow
        ctx.fillStyle = 'rgba(200,200,220,0.1)';
        ctx.beginPath(); ctx.arc(mx,my,mr*2.5,0,Math.PI*2); ctx.fill();
      }

      // Earth special highlight
      if (p.id === 'earth') {
        // Pulsing marker
        const pulse = 0.5 + Math.sin(this.time*4)*0.3;
        ctx.strokeStyle = `rgba(0,229,255,${pulse*0.4})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px,py,pr+4+Math.sin(this.time*3)*2,0,Math.PI*2); ctx.stroke();
        ctx.fillStyle = '#00e5ff'; ctx.font = 'bold 9px Orbitron';
        ctx.fillText('EARTH', px, py+pr+14);
        ctx.fillStyle = `rgba(0,229,255,${0.4+pulse*0.3})`; ctx.font = '7px Rajdhani';
        ctx.fillText('◉ YOU ARE HERE', px, py+pr+23);
      } else {
        // Planet label
        ctx.fillStyle = isHover ? '#fff' : 'rgba(180,200,220,0.6)';
        ctx.font = `${isHover?'bold ':''} ${Math.max(7,8)}px Orbitron`;
        ctx.fillText(p.name.toUpperCase(), px, py+pr+12);
        if (isHover && p.moons > 0) {
          ctx.fillStyle = 'rgba(180,200,220,0.4)'; ctx.font = '7px Rajdhani';
          ctx.fillText(`${p.moons} moon${p.moons>1?'s':''}`, px, py+pr+21);
        }
      }

      // Distance label on hover
      if (isHover) {
        ctx.fillStyle = 'rgba(0,229,255,0.5)'; ctx.font = '7px Rajdhani';
        ctx.fillText(`${p.semiMajorAU} AU`, px, py-pr-8);
      }

      p._x = px; p._y = py; p._r = Math.max(pr, 14);
    });

    // Title
    ctx.fillStyle = 'rgba(0,229,255,0.4)'; ctx.font = '9px Orbitron'; ctx.textAlign = 'center';
    ctx.fillText('SOLAR SYSTEM — REAL-TIME ORBITAL POSITIONS', cx, 20);
    ctx.fillStyle = 'rgba(100,130,160,0.3)'; ctx.font = '7px Rajdhani';
    ctx.fillText('CLICK PLANET FOR DETAILS | SCROLL TO RETURN TO EARTH', cx, 34);

    ctx.globalAlpha = 1;
    this.animFrame = requestAnimationFrame(() => this.render());
  }

  _lighten(hex, pct) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.min(255,r+pct)},${Math.min(255,g+pct)},${Math.min(255,b+pct)})`;
  }
  _darken(hex, pct) {
    const r = parseInt(hex.slice(1,3),16), g = parseInt(hex.slice(3,5),16), b = parseInt(hex.slice(5,7),16);
    return `rgb(${Math.max(0,r-pct)},${Math.max(0,g-pct)},${Math.max(0,b-pct)})`;
  }

  onClick(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    for (const p of this.planets) {
      if (!p._x) continue;
      if (Math.sqrt((mx-p._x)**2+(my-p._y)**2) < p._r+10) { showPlanetInfo(p); return; }
    }
  }
  onHover(e) {
    const rect = this.canvas.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    this.hoverPlanet = null;
    for (const p of this.planets) {
      if (!p._x) continue;
      if (Math.sqrt((mx-p._x)**2+(my-p._y)**2) < p._r+10) {
        this.hoverPlanet = p.id; this.canvas.style.cursor = 'pointer'; return;
      }
    }
    this.canvas.style.cursor = 'default';
  }
}
window.solarSystem = null;
