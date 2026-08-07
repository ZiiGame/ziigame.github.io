const obs=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)e.target.classList.add('show')}),{threshold:.15});
document.querySelectorAll('.reveal').forEach(x=>obs.observe(x));
const b=document.getElementById('menuBtn'),m=document.getElementById('menu');
b.addEventListener('click',()=>m.classList.toggle('open'));