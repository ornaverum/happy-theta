'use strict';
/* Pass phrases for Happy Theta accounts.
   The site makes them up (users can ask for another, but can't type their own). Each one is a short,
   grammatical (if silly) sentence of 4–6 words, not counting "the"/"a"/"an", written in camelCase:
       theSleepyOtterJugglesTheSilverLantern     sevenPurpleOttersJuggleTheGoldenMoon
   Weakest pattern ≈ 32 bits, most ≈ 36–50 bits. With scrypt, per-email lockout and the per-IP limit,
   guessing online is hopeless.

   generate()   → a new phrase (crypto randomness)
   check(text)  → null if it's one of ours, else a message
   canonical(text) → what gets hashed: letters only, lower case. So "the sleepy otter…",
                 "TheSleepyOtter…" and "theSleepyOtter…" all sign in. */
const crypto = require('crypto');

const words = (s) => s.trim().split(/\s+/);

const ADJ = words(`
amber ancient arctic azure bashful bold bouncy brave breezy bright brisk bubbly busy calm careful cheerful
chilly chubby clever cloudy clumsy cobalt cosmic cozy crafty crimson crisp crunchy curious curly daring
dazzling dapper delicate dizzy dreamy dusty eager early electric elegant emerald fancy fearless feathery
fierce fizzy fluffy foggy friendly frosty fuzzy gentle giant giddy gigantic glassy gleaming glossy glowing
golden graceful grand grassy gritty grumpy happy hasty hidden hollow hungry icy jolly jumpy keen kind lanky
lazy leafy little lively lofty lonely loud lucky lumpy magic majestic mellow merry mighty misty modest molten
muddy narrow neat nervous nimble noble noisy nutty odd olive orange patient peaceful peppy perky plucky plump
polite polished proud purple quick quiet quirky radiant rainy rapid rosy round royal rugged rusty salty sandy
scarlet secret shaggy shiny silent silky silly silver simple sleek sleepy slim slow smooth snowy soft solar
sparkly speedy spicy spotted steady sticky stormy striped sturdy sunny swift tall tame tangy tidy timid tiny
tired toasty tropical velvet vivid warm wavy wiggly windy wise witty wobbly wooden woolly zany zesty cheeky
chunky crispy dainty droopy frozen gloomy hardy humble jazzy joyful loyal mossy nifty pale playful prickly
puzzled rocky rowdy rumbly scruffy shy snug spiky springy squeaky starry stubborn sugary tender thirsty
thoughtful thrifty tricky twinkly upbeat vast wild wintry zippy bumpy chatty chirpy crooked frisky glittery
jagged lunar minty musical nautical painted pebbly polar puffy ruby shimmering smoky soggy sour spry tawny
teal topaz trusty velvety violet brainy breezy cuddly fiery frilly gusty hefty husky jumbo lavish mighty
`);

const NOUN = words(`
acorn anchor apple arrow badger bagel balloon banana barrel basket beacon beaver bell bicycle biscuit
blanket blossom boat bonnet bottle boulder bracelet bridge broom bucket bubble button cabin camel candle
canoe canyon captain carpet carrot castle chair cherry chimney cliff clock cloud clover comet compass cookie
cottage cricket crown cupcake curtain daisy dolphin donkey dragon drum eagle easel elephant engine falcon
feather fence ferret fiddle finch flag flute forest fountain fox garden giraffe glacier goblet gopher guitar
hammock hamster harbor harp hedgehog helmet heron island jacket jaguar jellybean kayak kettle kitten koala
ladder lagoon lantern lemon lighthouse lizard llama lobster magnet maple marble meadow meteor mitten monkey
mountain muffin mushroom napkin needle nugget ocean orchard otter owl paddle pancake panda parrot peach
peacock pebble pelican penguin pepper pickle pigeon pillow pinecone pirate planet plum pocket pony poodle
pretzel puddle pumpkin puppet puppy quilt rabbit raccoon radish rainbow raven robot rocket saddle sailor
sandal satellite scooter seal shovel skunk sled snail sock spider spoon squirrel sunflower swan sweater
table teapot teacup telescope tiger toaster tortoise tractor trumpet tulip turnip turtle umbrella violin
waffle wagon walnut walrus whale whistle window wizard yak zebra beetle blueberry buttercup caterpillar
cheetah chipmunk coconut crayon dinosaur doorbell dumpling emu gadget gumdrop hat iceberg jigsaw kite
lemur meerkat moth narwhal noodle oyster pear pinwheel quokka salamander seagull skateboard sparrow stapler
sundae tadpole thimble toad toucan trampoline tuba vulture weasel wombat zeppelin acrobat astronaut baker
beekeeper chef dancer farmer gardener inventor juggler knight librarian magician painter pilot poet ranger
scientist sculptor tailor
`);

const VERB_T = words(`
admire borrow build carry catch chase collect count decorate deliver discover draw explore feed find fix
fold follow greet guard hug juggle kick launch lift measure mend munch nibble paint pat pull push rescue
ride roll sketch squeeze sniff spin stack stir swap tickle toss trade tug visit wash watch wrap bake balance
bounce brush climb cook copy fetch hide hold invent join knit love mail nudge open pack photograph plant
polish print race repair scrub sell serve shake share stamp study sweep teach thank tow trace tune unlock
weigh applaud befriend carve celebrate comb cuddle dazzle entertain escort guide hatch inspect lend notice
outrun pamper ponder protect salute scatter shelter spot summon surprise tame track trim whittle adopt crown
decode design dribble flip grab knead outsmart pedal scoop shuffle sort spray squash steer sprinkle toast
twirl unwrap weave
`);

const VERB_I = words(`
dance sing wander giggle nap sleep snore hum hop swim float glide sparkle shimmer wobble wiggle yawn
whistle laugh smile sneeze stroll tiptoe march gallop waddle twirl drift dream roam rest wait listen
chuckle blink shiver sway jog leap relax sit stand nest hover splash skate sail camp hike ramble scurry
hurry flutter linger lounge mumble nod perch prance rumble snooze squeak stretch tumble wink yodel
`);

const ADV = words(`
quietly boldly gently happily swiftly slowly proudly calmly loudly softly bravely kindly eagerly neatly
wisely gladly merrily lazily sleepily quickly briskly busily carefully cheerfully cleverly curiously
dizzily elegantly fiercely gracefully joyfully lightly loyally nimbly nervously noisily oddly patiently
playfully politely rapidly secretly shyly silently smoothly sneakily steadily sweetly tenderly warmly
wildly brightly clumsily cozily gleefully grandly humbly keenly mightily mysteriously peacefully sternly
suddenly tirelessly
`);

const PREP = words('under beside behind near above below inside around across beyond past toward along over beneath outside upon with');
const NUM = words('two three four five six seven eight nine ten eleven twelve');
const ARTICLES = new Set(['the', 'a', 'an']);

const uniq = (a) => [...new Set(a)];
const plural = (w) =>
	/(s|x|z|ch|sh)$/.test(w) ? w + 'es' : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + 'ies' : w + 's';
const third = plural; // he juggles / catches / carries — same spelling rules here

const L = {
	ADJ: uniq(ADJ),
	N: uniq(NOUN),
	NP: uniq(NOUN).map(plural),
	VT: uniq(VERB_T).map(third), // after a singular subject
	VTB: uniq(VERB_T), // after a plural subject
	VI: uniq(VERB_I).map(third),
	VIB: uniq(VERB_I),
	ADV: uniq(ADV),
	PREP: uniq(PREP),
	NUM: uniq(NUM)
};
const SETS = Object.fromEntries(Object.entries(L).map(([k, v]) => [k, new Set(v)]));

// ART = "the" or "a/an"; articles don't count toward the 4–6 words.
const TEMPLATES = [
	'ART ADJ N VI ADV', // theSleepyOtterDancesQuietly
	'ART ADJ N VT ART N', // aBraveFoxPaintsTheLantern
	'ART ADJ N VT ART ADJ N', // theCleverOwlBorrowsAGoldenKite
	'NUM ADJ NP VTB ART ADJ N', // sevenPurpleOttersJuggleTheSilverMoon
	'ART ADJ N VI PREP ART ADJ N', // theGiddyLlamaNapsUnderTheWoodenBridge
	'ART N VI PREP ART ADJ N', // aPenguinHumsBesideTheFrostyTeapot
	'NUM ADJ NP VIB ADV', // fourTinyRobotsWaddleProudly
	'ART ADJ N VT NUM ADJ NP', // theQuietWizardCollectsNineFuzzyMittens
	'ART ADJ N ADV VT ART ADJ N' // aWiseTigerGentlyPolishesTheRustyTrumpet
].map((t) => t.split(' '));

const pick = (arr) => arr[crypto.randomInt(arr.length)];
const cap = (w) => w[0].toUpperCase() + w.slice(1);

function generate() {
	const t = pick(TEMPLATES);
	const out = [];
	for (let i = 0; i < t.length; i++) {
		if (t[i] === 'ART') {
			out.push(null); // decided once the next word is known (a / an)
			continue;
		}
		out.push(pick(L[t[i]]));
	}
	for (let i = 0; i < out.length; i++)
		if (out[i] === null) out[i] = crypto.randomInt(2) ? 'the' : /^[aeiou]/.test(out[i + 1]) ? 'an' : 'a';
	return out.map((w, i) => (i ? cap(w) : w)).join('');
}

/* Split typed text into words: camelCase, spaces, hyphens all work. */
function tokens(text) {
	return String(text || '')
		.replace(/([a-z])([A-Z])/g, '$1 $2')
		.replace(/([A-Z])([A-Z][a-z])/g, '$1 $2')
		.split(/[^A-Za-z]+/)
		.filter(Boolean)
		.map((w) => w.toLowerCase());
}

const fits = (toks, t) =>
	toks.length === t.length && t.every((cat, i) => (cat === 'ART' ? ARTICLES.has(toks[i]) : SETS[cat].has(toks[i])));

function check(text) {
	const toks = tokens(text);
	const counted = toks.filter((w) => !ARTICLES.has(w)).length;
	if (counted < 4 || counted > 6 || !TEMPLATES.some((t) => fits(toks, t)))
		return 'Use a pass phrase made by the site (press "Another one" for a new one).';
	return null;
}

const canonical = (text) => String(text || '').replace(/[^A-Za-z]/g, '').toLowerCase();

/* Rough strength of each pattern, for the README / tests. */
function bits() {
	return TEMPLATES.map((t) => ({
		pattern: t.join(' '),
		bits: +t.reduce((b, c) => b + (c === 'ART' ? 1 : Math.log2(L[c].length)), Math.log2(TEMPLATES.length)).toFixed(1)
	}));
}

module.exports = { generate, check, canonical, tokens, bits, lists: L };
