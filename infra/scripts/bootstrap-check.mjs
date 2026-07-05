const humanBootstrapItems = [
  [
    'Supabase project',
    'Create a Free project, then link locally or in protected CI with `supabase link --project-ref <ref>`.',
  ],
  [
    'Supabase secrets',
    'Set scheduler, encryption, OAuth, OpenAI, Brevo, Telegram, and operator alert secrets in Supabase/GitHub/Vercel stores.',
  ],
  [
    'Vercel project',
    'Import the public personal repository as a Hobby static Vite project using the committed `vercel.json`.',
  ],
  [
    'OAuth apps',
    'Register Google and GitHub OAuth apps and add Supabase callback plus final frontend redirect URLs.',
  ],
  [
    'GitHub security',
    'Verify required checks, CodeQL, Dependabot, secret scanning, and push protection in the hosted repository.',
  ],
  [
    'Production deploy',
    'Deploy only after human approval, then run login, API, queue, worker, and cleanup smoke checks.',
  ],
];

console.log('R-19 deployment bootstrap check');
console.log(
  'This command is read-only. It does not create accounts, link projects, deploy, or print secrets.',
);

for (const [name, action] of humanBootstrapItems) {
  console.log(`- ${name}: ${action}`);
}
