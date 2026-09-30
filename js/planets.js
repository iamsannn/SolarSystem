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
