/* planets.js — data for every body.
   Sizes and distances are compressed so everything fits on screen; orbital
   and rotation PERIODS are real, so relative speeds are accurate.
   radius/distance: scene units | orbitDays: days per orbit | spinHours: hours per
   rotation (negative = spins backwards) | tilt: axial tilt in degrees
   palette: [position 0–1, [r,g,b]] colour stops for the procedural texture
   bands: horizontal stripes (gas giants) | seed: noise seed | atmo: glow colour */
const PLANETS = [
  { name: 'Mercury', radius: 1.2, distance: 16, orbitDays: 88,    spinHours: 1408,  tilt: 0.03, seed: 1, bands: 0, bump: 1.0,
    palette: [[0,[70,66,62]],[.5,[130,124,116]],[1,[190,182,170]]],
    fact: 'The smallest planet and the closest to the Sun. Its cratered surface looks a lot like our Moon.',
    stats: { Diameter: '4,879 km', Day: '176 Earth days', Year: '88 Earth days', Moons: '0' } },
  { name: 'Venus', radius: 2.2, distance: 23, orbitDays: 225,    spinHours: -5832, tilt: 177, seed: 2, bands: 0, bump: .3, atmo: [1,.75,.4],
    palette: [[0,[170,120,60]],[.5,[220,180,110]],[1,[245,225,170]]],
    fact: 'The hottest planet, wrapped in thick clouds. It spins backwards, so the Sun rises in the west.',
    stats: { Diameter: '12,104 km', Day: '116 Earth days', Year: '225 Earth days', Moons: '0' } },
  { name: 'Earth', radius: 2.3, distance: 31, orbitDays: 365.25, spinHours: 24,   tilt: 23.4, seed: 3, bands: 0, bump: .8, atmo: [.3,.6,1], earth: true,
    palette: [[0,[10,30,90]],[.46,[20,70,160]],[.5,[60,120,60]],[.68,[120,140,80]],[.85,[140,120,90]],[1,[240,240,245]]],
    fact: 'Our home, and the only place we know of with life. Liquid water covers about 70% of its surface.',
    stats: { Diameter: '12,742 km', Day: '24 hours', Year: '365 days', Moons: '1' },
    moon: { radius: .6, distance: 4.2, orbitDays: 27.3 } },
  { name: 'Mars', radius: 1.6, distance: 39, orbitDays: 687,    spinHours: 24.6,  tilt: 25.2, seed: 4, bands: 0, bump: 1.4, atmo: [1,.5,.3],
    palette: [[0,[90,40,25]],[.5,[170,80,45]],[1,[225,150,100]]],
    fact: 'A cold desert world with the tallest volcano in the solar system, Olympus Mons.',
    stats: { Diameter: '6,779 km', Day: '24.6 hours', Year: '687 Earth days', Moons: '2' } },
  { name: 'Jupiter', radius: 6.5, distance: 56, orbitDays: 4333, spinHours: 9.9,  tilt: 3.1, seed: 5, bands: 14, bump: .05,
    palette: [[0,[120,80,50]],[.3,[200,160,120]],[.6,[230,210,180]],[1,[170,115,80]]],
    fact: 'The largest planet. Its Great Red Spot is a storm that has raged for centuries.',
    stats: { Diameter: '139,820 km', Day: '9.9 hours', Year: '11.9 Earth years', Moons: '95' } },
  { name: 'Saturn', radius: 5.5, distance: 76, orbitDays: 10759, spinHours: 10.7, tilt: 26.7, seed: 6, bands: 10, bump: .05, ring: true,
    palette: [[0,[170,140,90]],[.5,[230,210,150]],[1,[205,180,125]]],
    fact: 'Famous for its bright rings of ice and rock. It is so light that it would float in water.',
    stats: { Diameter: '116,460 km', Day: '10.7 hours', Year: '29.5 Earth years', Moons: '146' } },
  { name: 'Uranus', radius: 3.6, distance: 94, orbitDays: 30687, spinHours: -17.2, tilt: 97.8, seed: 7, bands: 4, bump: 0, atmo: [.5,.9,.95],
    palette: [[0,[120,200,210]],[1,[170,235,240]]],
    fact: 'An ice giant that rolls around the Sun on its side, tilted almost 98 degrees.',
    stats: { Diameter: '50,724 km', Day: '17.2 hours', Year: '84 Earth years', Moons: '28' } },
  { name: 'Neptune', radius: 3.5, distance: 110, orbitDays: 60190, spinHours: 16.1, tilt: 28.3, seed: 8, bands: 5, bump: 0, atmo: [.3,.45,1],
    palette: [[0,[30,60,160]],[.5,[60,100,220]],[1,[110,150,245]]],
    fact: 'The windiest planet, with supersonic storms. It is the farthest planet from the Sun.',
    stats: { Diameter: '49,244 km', Day: '16.1 hours', Year: '165 Earth years', Moons: '16' } }
];
const SUN_INFO = { name: 'Sun', fact: 'Our star. It holds 99.8% of the solar system\'s mass and its gravity keeps every planet in orbit.',
  stats: { Diameter: '1,391,000 km', Surface: '5,500 °C', Type: 'G-type star', Age: '4.6 billion years' } };

/* Mean longitude at J2000 (degrees) — lets planets sit roughly where they really are on any date. */
const L0 = { Mercury: 252.25, Venus: 181.98, Earth: 100.46, Mars: 355.45, Jupiter: 34.4, Saturn: 49.94, Uranus: 313.23, Neptune: 304.88 };

/* Moons. n name | r radius (scene units, enlarged so they are visible) | m orbit radius as a multiple of the
   planet's radius (compressed for a clear view, order is real) | d real orbit period in days (negative =
   retrograde) | km diameter | dk real distance from planet (km) | c colour stops | f fact */
const MOONS = {
  Earth: [{ n: 'Moon', r: .62, m: 2.6, d: 27.32, km: 3474, dk: 384400, c: [[0,[70,70,72]],[1,[200,200,196]]], f: 'Our only natural satellite. Its gravity drives the ocean tides, and it always shows us the same face.' }],
  Mars: [
    { n: 'Phobos', r: .22, m: 2.2, d: .32, km: 22, dk: 9376, c: [[0,[60,56,54]],[1,[130,120,112]]], f: 'A tiny, potato-shaped moon that orbits so close it circles Mars three times a day.' },
    { n: 'Deimos', r: .16, m: 3.2, d: 1.26, km: 12, dk: 23460, c: [[0,[80,72,66]],[1,[160,148,136]]], f: 'The smaller and more distant of Mars\'s two moons.' }],
  Jupiter: [
    { n: 'Io', r: .55, m: 1.7, d: 1.77, km: 3643, dk: 421700, c: [[0,[170,130,30]],[1,[250,230,120]]], f: 'The most volcanically active world in the solar system, with hundreds of erupting volcanoes.' },
    { n: 'Europa', r: .5, m: 2.15, d: 3.55, km: 3122, dk: 671000, c: [[0,[150,120,90]],[1,[235,225,205]]], f: 'An icy shell hides a global ocean that may hold more water than all of Earth\'s seas.' },
    { n: 'Ganymede', r: .8, m: 2.65, d: 7.15, km: 5268, dk: 1070000, c: [[0,[90,82,74]],[1,[185,175,162]]], f: 'The largest moon in the solar system, bigger than the planet Mercury.' },
    { n: 'Callisto', r: .72, m: 3.2, d: 16.69, km: 4821, dk: 1883000, c: [[0,[48,42,38]],[1,[120,108,96]]], f: 'One of the most heavily cratered surfaces known, ancient and unchanged for billions of years.' }],
  Saturn: [
    { n: 'Enceladus', r: .3, m: 2.7, d: 1.37, km: 504, dk: 238000, c: [[0,[200,205,215]],[1,[255,255,255]]], f: 'Geysers of water ice spray from its south pole, feeding Saturn\'s E ring.' },
    { n: 'Tethys', r: .38, m: 3.1, d: 1.89, km: 1062, dk: 295000, c: [[0,[170,170,170]],[1,[235,235,235]]], f: 'A bright ball of almost pure water ice with a giant canyon and a huge crater.' },
    { n: 'Dione', r: .4, m: 3.5, d: 2.74, km: 1123, dk: 377000, c: [[0,[150,150,150]],[1,[225,225,225]]], f: 'An icy moon with long bright cliffs carved by ancient cracking.' },
    { n: 'Rhea', r: .5, m: 4, d: 4.52, km: 1527, dk: 527000, c: [[0,[130,130,130]],[1,[215,215,215]]], f: 'Saturn\'s second-largest moon, a cratered world of ice and rock.' },
    { n: 'Titan', r: .85, m: 4.7, d: 15.95, km: 5150, dk: 1222000, c: [[0,[170,110,40]],[1,[235,175,90]]], f: 'Has a thick orange atmosphere and lakes of liquid methane on its surface.' },
    { n: 'Iapetus', r: .45, m: 5.6, d: 79.32, km: 1469, dk: 3561000, c: [[0,[40,34,30]],[1,[225,220,210]]], f: 'A two-toned moon: one side is dark as coal and the other is bright as snow.' }],
  Uranus: [
    { n: 'Miranda', r: .22, m: 2, d: 1.41, km: 472, dk: 129900, c: [[0,[130,130,135]],[1,[220,220,225]]], f: 'A patchwork of strange canyons and ridges, as if it was torn apart and reassembled.' },
    { n: 'Ariel', r: .35, m: 2.5, d: 2.52, km: 1158, dk: 190900, c: [[0,[140,140,145]],[1,[225,225,230]]], f: 'The brightest of Uranus\'s moons, with deep valleys and few craters.' },
    { n: 'Umbriel', r: .35, m: 3, d: 4.14, km: 1169, dk: 266000, c: [[0,[60,60,65]],[1,[130,130,135]]], f: 'A dark, ancient, heavily cratered moon.' },
    { n: 'Titania', r: .45, m: 3.6, d: 8.71, km: 1577, dk: 436300, c: [[0,[100,95,92]],[1,[190,182,176]]], f: 'The largest moon of Uranus, scarred by huge canyons.' },
    { n: 'Oberon', r: .43, m: 4.2, d: 13.46, km: 1523, dk: 583500, c: [[0,[90,82,78]],[1,[170,160,152]]], f: 'An old, cratered moon, the outermost of Uranus\'s five major moons.' }],
  Neptune: [
    { n: 'Proteus', r: .3, m: 2.3, d: 1.12, km: 420, dk: 117600, c: [[0,[70,68,70]],[1,[140,138,140]]], f: 'A dark, irregular moon that is one of the largest non-round moons known.' },
    { n: 'Triton', r: .6, m: 3.3, d: -5.88, km: 2707, dk: 354800, c: [[0,[170,150,150]],[1,[245,235,235]]], f: 'Orbits backwards and has nitrogen geysers. It is probably a captured dwarf planet.' }]
};
PLANETS.forEach(p => { p.moons = MOONS[p.name] || []; p.L0 = L0[p.name]; });

/* Extra facts shown when you press "More details" */
const EXTRA = {
  Mercury: ['Rocky planet', .39, '167 °C', '3.7 m/s²'], Venus: ['Rocky planet', .72, '464 °C', '8.9 m/s²'], Earth: ['Rocky planet', 1, '15 °C', '9.8 m/s²'],
  Mars: ['Rocky planet', 1.52, '−65 °C', '3.7 m/s²'], Jupiter: ['Gas giant', 5.2, '−110 °C', '24.8 m/s²'], Saturn: ['Gas giant', 9.58, '−140 °C', '10.4 m/s²'],
  Uranus: ['Ice giant', 19.2, '−195 °C', '8.7 m/s²'], Neptune: ['Ice giant', 30.1, '−200 °C', '11.2 m/s²'] };
PLANETS.forEach(p => { const e = EXTRA[p.name];
  p.extra = { Type: e[0], 'From Sun': e[1] + ' AU', 'Avg temp': e[2], Gravity: e[3], 'Axial tilt': p.tilt + '°' };
  if (p.moons.length) p.extra['Major moons'] = p.moons.map(m => m.n).join(', '); });
SUN_INFO.extra = { 'Core temp': '15 million °C', Gravity: '274 m/s²', Mass: '333,000 Earths', Rotation: '25 days' };
