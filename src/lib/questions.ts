export interface Question {
  number: number;
  block: string;
  blockNumber: number;
  template: string;
  focus: string;
}

export const BLOCKS = [
  "How They See the Problem",
  "How They Think Differently",
  "How They Actually Do It",
  "Who It's For and What It Costs",
  "Proof and Perspective",
];

export const QUESTIONS: Question[] = [
  {
    number: 1,
    block: BLOCKS[0],
    blockNumber: 1,
    template:
      "What problem does this service solve, stated the way your buyer would say it — not how you'd say it on your website?",
    focus:
      "Gets the real problem in customer language, not marketing language.",
  },
  {
    number: 2,
    block: BLOCKS[0],
    blockNumber: 1,
    template:
      "What do most buyers try before they find you, and why do those approaches eventually fail or fall short?",
    focus:
      "Surfaces the competitive landscape through the buyer's failed journey — not a feature comparison chart.",
  },
  {
    number: 3,
    block: BLOCKS[0],
    blockNumber: 1,
    template:
      "What's the most common misconception buyers have about solving this problem? What do they believe that's wrong?",
    focus:
      "Extracts the mindset shift — the thing the buyer needs to unlearn before the company's approach makes sense.",
  },
  {
    number: 4,
    block: BLOCKS[0],
    blockNumber: 1,
    template:
      'If you could grab a prospect by the shoulders and say "stop doing THIS," what would it be?',
    focus:
      "Gets the emotional, opinionated version of what's broken in the market. This is where brand flavor lives.",
  },
  {
    number: 5,
    block: BLOCKS[0],
    blockNumber: 1,
    template:
      "What's the hidden cost or risk of solving this problem the wrong way that most buyers don't see until it's too late?",
    focus: "Pulls out the stakes — why getting this wrong actually hurts.",
  },
  {
    number: 6,
    block: BLOCKS[1],
    blockNumber: 2,
    template:
      "What do you believe about this service or how it should be delivered that most of your competitors would disagree with?",
    focus:
      "The contrarian belief. This is the single highest-value question in the set.",
  },
  {
    number: 7,
    block: BLOCKS[1],
    blockNumber: 2,
    template:
      "Is there a decision most buyers make early in the process that you think they're getting backwards? What should they do instead?",
    focus:
      'Gets the "they\'re thinking about it in the wrong order" POV — a reframe that positions the company as the expert.',
  },
  {
    number: 8,
    block: BLOCKS[1],
    blockNumber: 2,
    template:
      "What's something you deliberately choose NOT to do that other providers in your space commonly offer? Why?",
    focus:
      "What they exclude is as differentiating as what they include. This question finds it.",
  },
  {
    number: 9,
    block: BLOCKS[1],
    blockNumber: 2,
    template:
      "If you had to explain your approach using a metaphor or comparison to something outside your industry, what would it be?",
    focus:
      "Gets the mental model they use internally — the way they actually think about the work, not the polished marketing version.",
  },
  {
    number: 10,
    block: BLOCKS[1],
    blockNumber: 2,
    template:
      "What would a buyer who's worked with a competitor first notice is different about working with you — not better, just different?",
    focus:
      'Forces experiential differentiation instead of claims. "Better" invites BS. "Different" invites specifics.',
  },
  {
    number: 11,
    block: BLOCKS[2],
    blockNumber: 3,
    template:
      "Walk me through the first 30 days after a customer says yes. What happens, in what order, and why that order?",
    focus:
      'Gets the implementation sequence and the reasoning behind it — the "we do it this way because..." that reveals process philosophy.',
  },
  {
    number: 12,
    block: BLOCKS[2],
    blockNumber: 3,
    template:
      "Where in your process do you spend more time or money than your competitors probably do? Why is that worth it?",
    focus:
      "Finds the non-obvious investment — the thing they over-index on because they believe it matters more than the market gives it credit for.",
  },
  {
    number: 13,
    block: BLOCKS[2],
    blockNumber: 3,
    template:
      "What's a step in your process that a buyer might question or push back on? How do you explain why it's there?",
    focus:
      "Gets the friction point they've chosen to keep because they know it produces better outcomes — and the defense of that choice.",
  },
  {
    number: 14,
    block: BLOCKS[2],
    blockNumber: 3,
    template:
      "What's the most common way this service fails when delivered by someone else, and what specifically do you do to prevent that?",
    focus:
      "Extracts failure patterns AND the systematic response. This is pure differentiation fuel.",
  },
  {
    number: 15,
    block: BLOCKS[2],
    blockNumber: 3,
    template:
      "Is there a specific tool, material, method, or framework you use that you'd want a buyer to understand? What makes it important?",
    focus:
      'Gets the proprietary or preferred methodology — the "believable system" behind the claims.',
  },
  {
    number: 16,
    block: BLOCKS[3],
    blockNumber: 4,
    template:
      "Describe your ideal customer for this service — not demographics, but the situation they're in when they need you. What's happening in their world?",
    focus:
      "Gets the trigger event and context, not a firmographic profile. This is what makes content resonate.",
  },
  {
    number: 17,
    block: BLOCKS[3],
    blockNumber: 4,
    template:
      "When should someone NOT hire you for this? Who's a bad fit and why?",
    focus:
      "Disqualification criteria are more revealing than qualification criteria. This also builds trust with the reader.",
  },
  {
    number: 18,
    block: BLOCKS[3],
    blockNumber: 4,
    template:
      "What should a buyer expect to invest — not just in dollars, but in their own time, attention, and internal resources — to get a good outcome?",
    focus:
      "Gets the real cost picture including the buyer's side of the equation, which most competitors leave vague.",
  },
  {
    number: 19,
    block: BLOCKS[4],
    blockNumber: 5,
    template:
      "Without naming names, describe a specific situation where your approach made a measurable difference. What was the situation, what did you do, and what changed?",
    focus:
      "Gets a mini case study with specifics — the kind of proof that AI systems and buyers both find credible.",
  },
  {
    number: 20,
    block: BLOCKS[4],
    blockNumber: 5,
    template:
      "If you were advising a friend and you had zero skin in the game — you wouldn't get the work either way — what would you tell them to look for when evaluating providers for this service?",
    focus:
      'The "honest broker" question. Strips away self-interest and gets the genuine buying criteria the company actually believes in.',
  },
];
