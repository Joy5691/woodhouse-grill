/* Woodhouse Grill — content & menu data
   Transcribed from the restaurant's printed menu (assets/menu/*.jpg).
   ALL PRICES LIVE IN `menu` BELOW — the "Menu & Prices" section is the single place they are shown. */

window.WH = {
  phone: '+8801798474305',
  phoneDisplay: '01798-474305',
  whatsapp: '8801798474305',
  email: 'woodhousegrillbd@gmail.com',
  facebook: 'https://www.facebook.com/WoodhouseGrillBD',
  mapsUrl: 'https://www.google.com/maps/search/?api=1&query=Woodhouse+Grill+Banani+Dhaka',
  address: 'Level 4, House 56, Block F, Road 11, BTI Laureate, Banani, Dhaka 1213',
  hours: { open: 13, close: 24 }, // 1 PM – 12 AM, every day (Asia/Dhaka)

  sides: ['Potato Mashed', 'Mushroom Sautee', 'Corn on the Cob', 'Potato Wedges', 'Vegetable Sautee', 'Mexican Rice', 'Corn Salad', 'Saffron Rice', 'Garlic Coleslaw'],
  sauces: ['Hollandaise', 'Mushroom', 'Roast Bacon Glace', 'Pepper', 'BBQ', 'Apple', 'Cheese', 'Hot Chilli'],

  /* 3D Cut Studio — `id` links to a menu item for "View price" */
  cuts: [
    { id: 'ribeye', name: 'Ribeye', weight: '300g', bone: false, shape: 'ribeye', best: 2,
      desc: 'The most popular boneless cut — a perfect balance of fat marbling and meaty delight.' },
    { id: 'tomahawk', name: 'Tomahawk', weight: '500g', bone: true, shape: 'tomahawk', best: 2,
      desc: 'A one-of-a-kind bone-in rib steak, shaped like the axe it is named after.' },
    { id: 'tbone', name: 'T-Bone', weight: '250g', bone: true, shape: 'tbone', best: 2,
      desc: 'Prime-cut T-bone, marinated in our special sauce for more than 24 hours.' },
    { id: 'sirloin', name: 'Sirloin', weight: '300g', bone: false, shape: 'sirloin', best: 2,
      desc: 'Premium boneless cut with a succulent, meaty texture and a sweet fat edge.' },
    { id: 'picanha', name: 'Picanha', weight: '400g', bone: true, shape: 'picanha', best: 2,
      desc: 'Tender knuckle of rump, churrasco-style on the skewer with a high spice profile.' },
    { id: 'rump', name: 'Rump Steak', weight: '300g', bone: false, shape: 'rump', best: 2,
      desc: 'Known for its superb flavour and bold grain — a steak lover’s steak.' },
    { id: 'hanger', name: 'Hanger Steak', weight: '400g', bone: false, shape: 'hanger', best: 1,
      desc: 'Extremely tender with generous marbling, packed with rich, beefy flavour.' }
  ],

  /* Smokehouse bento — `id` links to a menu item */
  smoked: [
    { id: 'broncho', name: 'Broncho Ribs Platter', weight: '1600g · feeds the table', img: '1679711246825-1f2bd51b16d0',
      desc: 'Giant spare ribs smoked 6 hours till fall-off-the-bone, grilled with house BBQ sauce. Four sides included.' },
    { id: 'brisket500', name: 'Texas Smoked Brisket', weight: '500g / 1kg', img: '1623174025518-b49000fb653d',
      desc: 'Smoked for 6+ hours — a true Texas beauty that melts in the mouth.' },
    { id: 'duo', name: 'Smoke Mate Duo', weight: 'Sharing platter', img: '1529193591184-b1d58069ecdd',
      desc: 'Brisket, short ribs, smoked chicken, pepperoni & Hangman’s chicken.' },
    { id: 'shortHalf', name: 'Short Smoked Ribs', weight: 'Half / full slab', img: '1568360987818-833c9383a326',
      desc: 'Tender, juicy beef that releases smoky flavour with every bite.' },
    { id: 'austin', name: 'Austin Ribs', weight: '800g', img: '1565299524732-d2149c7eabf5',
      desc: 'Spare ribs with a blackened bark and rich smoky flavour.' }
  ],

  /* ===== THE MENU — single source of every price (BDT, all-inclusive) ===== */
  menu: [
    { id: 'west', title: 'West Texas Steaks', note: 'Sides any two · Sauces any two', icon: 'flame',
      items: [
        { id: 'ribeye', name: 'Ribeye', w: '300g', p: 2845, d: 'Boneless; perfect balance of fat marbling and meaty delight.', tag: 'Most popular' },
        { id: 'tomahawk', name: 'Tomahawk', w: '500g', p: 3475, d: 'Unique bone-in rib steak resembling the tomahawk axe.', tag: 'Signature' },
        { id: 'picanha', name: 'Picanha', w: '400g', p: 3145, d: 'Knuckle of rump, churrasco style, high spice profile.' },
        { id: 'hanger', name: 'Hanger Steak', w: '400g', p: 2825, d: 'Extremely tender, generous marbling, rich flavour.' },
        { id: 'sirloin', name: 'Sirloin', w: '300g', p: 2555, d: 'Succulent meaty texture with a sweet fat edge.' },
        { id: 'rump', name: 'Rump Steak', w: '300g', p: 2345, d: 'Known for its superb flavour & grains.' }
      ] },
    { id: 'east', title: 'East Texas Steaks', note: 'Marinated 24+ hours · Sides any two', icon: 'clock',
      items: [
        { id: 'tbone', name: 'T-Bone', w: '250g', p: 2485, d: 'Prime cut marinated in our special sauce for 24+ hours.' },
        { id: 'cheese', name: 'Cheese Steak', w: '200g', p: 1465, d: 'Rump steak topped with American Jack cheese sauce.' },
        { id: 'philly', name: 'Philly Cheese Steak', w: '200g', p: 1465, d: 'Sliced flank with mushroom & onion, smothered in cheese.' },
        { id: 'pepper', name: 'Pepper Steak', w: '200g', p: 1425, d: 'Flank marinated in house-made pepper sauce.' },
        { id: 'mushroom', name: 'Mushroom Steak', w: '200g', p: 1425, d: 'Flank marinated in button mushroom sauce.' }
      ] },
    { id: 'smoke', title: 'Smokehouse', note: 'Smoked 6+ hours · House BBQ sauce', icon: 'smoke',
      items: [
        { id: 'broncho', name: 'Broncho Ribs Platter', w: '1600g', p: 5995, d: 'Giant spare ribs + 4 sides: veg sautee, Mexican rice, poutine, garlic coleslaw.', tag: 'For sharing' },
        { id: 'shortFull', name: 'Short Smoked Ribs — Full Slab', w: 'Full', p: 5345, d: 'The whole slab, sides any two.' },
        { id: 'duo', name: 'Smoke Mate Duo', w: 'Platter', p: 4445, d: 'Brisket, short ribs, smoked & Hangman’s chicken, pepperoni. +2 sides ৳300 / +4 sides ৳500.', tag: 'For sharing' },
        { id: 'brisket1000', name: 'Texas Smoked Brisket', w: '1000g', p: 4584, d: 'Add 4 sides for ৳500.' },
        { id: 'austin', name: 'Austin Ribs', w: '800g', p: 3385, d: 'Spare ribs with blackened skin, sides any two.' },
        { id: 'shortHalf', name: 'Short Smoked Ribs — Half Slab', w: 'Half', p: 2865, d: 'Smoky in every bite, sides any two.' },
        { id: 'brisket500', name: 'Texas Smoked Brisket', w: '500g', p: 2585, d: 'Add 2 sides for ৳300.' }
      ] },
    { id: 'sea', title: 'Surf & Turf', note: 'Sea meets fire', icon: 'wave',
      items: [
        { id: 'surf', name: 'Surf & Turf', w: 'Platter', p: 3995, d: 'Grilled & golden calamari, dory, crispy prawn, beef medallions, hanger steak.' },
        { id: 'surfjr', name: 'Surf & Turf Junior', w: 'Platter', p: 2485, d: 'Dory, calamari rings, prawn & two beef medallions. Sides any one.' },
        { id: 'pescado', name: 'Sobre Pescado', w: '300g dory', p: 1685, d: 'Spicy pan-seared dory topped with calamari & shrimp gratinate.' }
      ] },
    { id: 'texmex', title: 'Tex-Mex & Birds', note: 'Sides any two', icon: 'chilli',
      items: [
        { id: 'fajitas', name: 'Flank Fajitas', w: '400g', p: 2925, d: 'Sizzling skirt steak strips, flame-tossed peppers & onions, table-top butter roast.', tag: 'Sizzling' },
        { id: 'hangman', name: 'Hangman’s Chicken', w: '', p: 900, d: 'Grilled & baked boneless thigh wrapped around mozzarella.' },
        { id: 'rusty', name: 'Rusty Chicken', w: '', p: 600, d: 'Flame-grilled chicken thighs, less spice.' }
      ] },
    { id: 'dessert', title: 'Desserts', note: 'Finish by the fire', icon: 'star',
      items: [
        { id: 'trifle', name: 'Trifle', w: '', p: 585, d: 'Oreo, custard crème, cream, nougat & chocolate shavings.' },
        { id: 'brulee', name: 'Butter Brûlée', w: '', p: 585, d: 'Creamy, buttery, caramelised crunch on top.' },
        { id: 'churros', name: 'Churros', w: '', p: 485, d: 'Cinnamon sugar, served warm with Nutella sauce.' }
      ] },
    { id: 'chillers', title: 'Chillers', note: 'Mocktails to match the steak', icon: 'glass',
      items: [
        { id: 'goblet', name: 'Patron’s Goblet', w: '', p: 320, d: 'Smoky richness with a hint of Irish sweetness.' },
        { id: 'bluemarg', name: 'Virgin Blue Margarita', w: '', p: 315 },
        { id: 'colaberry', name: 'Colaberry', w: '', p: 295 },
        { id: 'island', name: 'Island Blue', w: '', p: 295 },
        { id: 'mangoberry', name: 'Mangoberry', w: '', p: 295 },
        { id: 'doudou', name: 'Virgin Doudou', w: '', p: 290, d: 'Citrus burst with habanero.' },
        { id: 'applemint', name: 'Apple Mint Splash', w: '', p: 275 },
        { id: 'night', name: 'Color of Night', w: '', p: 275 },
        { id: 'strawmint', name: 'Strawberry Mint Splash', w: '', p: 275 },
        { id: 'icetea', name: 'Flavored Ice Tea', w: '', p: 235 }
      ] },
    { id: 'coffee', title: 'Coffee & Shakes', note: 'Hot & cold', icon: 'cup',
      items: [
        { id: 'smoothie', name: 'Smoothies', w: 'Blueberry · Raspberry · Strawberry · Mango · Tropical', p: 315 },
        { id: 'frapp', name: 'Frappuccino', w: 'Irish · Tiramisu · Popcorn · Caramel Latte', p: 315 },
        { id: 'capp', name: 'Caramel Cappuccino', w: '', p: 225 },
        { id: 'latte', name: 'Latte Macchiato', w: '', p: 215 },
        { id: 'americano', name: 'Americano', w: '', p: 165 },
        { id: 'espresso', name: 'Espresso', w: '', p: 135 }
      ] },
    { id: 'soda', title: 'Soda & Water', note: '', icon: 'drop',
      items: [
        { id: 'ginger', name: 'Ginger Ale', w: '', p: 350 },
        { id: 'cokezero', name: 'Coke Zero', w: '', p: 350 },
        { id: 'imported', name: 'Coke / Sprite (Imported)', w: '', p: 350 },
        { id: 'sodawater', name: 'Soda Water', w: '', p: 230 },
        { id: 'soft', name: 'Coke / Sprite / Fanta', w: 'Regular / Large', p: '112 / 177' },
        { id: 'water', name: 'Drinking Water', w: '', p: 20 }
      ] }
  ]
};
